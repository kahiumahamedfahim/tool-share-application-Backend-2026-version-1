import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { createHash, randomInt } from "crypto";

import { HandoverOtp } from "./entity/handover-otp.entity";
import {
    HandoverOtpPurpose,
} from "./enum/handover-stage.enum";

import { EmailService } from "src/email/email.service";

// =====================================================
// HANDOVER OTP SERVICE
//
// 6-digit codes, sha256-hashed at rest,
// 10-minute expiry, single use, max 5 attempts,
// new code invalidates previous ones.
// =====================================================

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class HandoverOtpService {

    constructor(
        @InjectRepository(HandoverOtp)
        private readonly handoverOtpRepository: Repository<HandoverOtp>,

        private readonly emailService: EmailService,
    ) { }

    // =====================================================
    // HELPERS
    // =====================================================

    private generateOtpId(): string {
        const random = Math.random()
            .toString(36)
            .slice(2, 8);

        return `OTP-${Date.now()}-${random}`;
    }

    private hashCode(code: string): string {
        return createHash("sha256")
            .update(code)
            .digest("hex");
    }

    private generateCode(): string {
        /*
         * randomInt is cryptographically secure
         * (node crypto) — no predictable sequences.
         */
        return randomInt(0, 1000000)
            .toString()
            .padStart(6, "0");
    }

    // =====================================================
    // SEND OTP
    // Invalidates any previous unused code for the
    // same rental + purpose, then emails a fresh one.
    // =====================================================

    async sendOtp(
        rentalId: string,
        stage: string,
        purpose: HandoverOtpPurpose,
        recipient: {
            email: string;
            firstName: string;
        },
        productName: string,
        stageLabel: string,
    ): Promise<HandoverOtp> {

        // -------------------------------------------------
        // Invalidate previous unused codes
        // -------------------------------------------------

        await this.handoverOtpRepository.update(
            {
                rentalId,
                purpose,
                isUsed: false,
            },
            { isUsed: true },
        );

        // -------------------------------------------------
        // Generate + hash
        // -------------------------------------------------

        const code = this.generateCode();

        const expiresAt = new Date(
            Date.now() + OTP_TTL_MINUTES * 60 * 1000,
        );

        const otp = this.handoverOtpRepository.create({
            otpId: this.generateOtpId(),
            rentalId,
            stage,
            purpose,
            codeHash: this.hashCode(code),
            sentToEmail: recipient.email,
            expiresAt,
            attempts: 0,
            isUsed: false,
        });

        const savedOtp =
            await this.handoverOtpRepository.save(otp);

        // -------------------------------------------------
        // Email the raw code (never stored raw)
        // -------------------------------------------------

        try {
            await this.emailService.handoverOtpEmail(
                recipient.email,
                recipient.firstName,
                {
                    rentalId,
                    productName,
                    stageLabel,
                    otpCode: code,
                    expiresAt,
                },
            );
        } catch {
            // Email failure must not corrupt the OTP
            // record; the caller may retry.
        }

        return savedOtp;
    }

    // =====================================================
    // VERIFY OTP
    // Single use, expiry-checked, attempt-limited.
    // =====================================================

    async verifyOtp(
        rentalId: string,
        purpose: HandoverOtpPurpose,
        code: string,
        verifiedById: string,
    ): Promise<HandoverOtp> {

        const otp =
            await this.handoverOtpRepository.findOne({
                where: {
                    rentalId,
                    purpose,
                    isUsed: false,
                },
                order: { createdAt: "DESC" },
            });

        if (!otp) {
            throw new NotFoundException(
                "No active verification code found. Please request a new one.",
            );
        }

        // -------------------------------------------------
        // Expiry
        // -------------------------------------------------

        if (otp.expiresAt.getTime() < Date.now()) {
            otp.isUsed = true;

            await this.handoverOtpRepository.save(otp);

            throw new BadRequestException(
                "This verification code has expired. Please request a new one.",
            );
        }

        // -------------------------------------------------
        // Attempts
        // -------------------------------------------------

        if (otp.attempts >= OTP_MAX_ATTEMPTS) {
            otp.isUsed = true;

            await this.handoverOtpRepository.save(otp);

            throw new BadRequestException(
                "Too many failed attempts. This code has been invalidated — please request a new one.",
            );
        }

        // -------------------------------------------------
        // Code check
        // -------------------------------------------------

        if (otp.codeHash !== this.hashCode(code)) {
            otp.attempts += 1;

            await this.handoverOtpRepository.save(otp);

            throw new BadRequestException(
                `Invalid verification code. ${OTP_MAX_ATTEMPTS - otp.attempts} attempt(s) remaining.`,
            );
        }

        // -------------------------------------------------
        // Success — single use
        // -------------------------------------------------

        otp.isUsed = true;
        otp.usedAt = new Date();
        otp.verifiedById = verifiedById;

        return this.handoverOtpRepository.save(otp);
    }
}
