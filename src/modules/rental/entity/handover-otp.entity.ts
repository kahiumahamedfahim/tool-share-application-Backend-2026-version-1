import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from "typeorm";

import { HandoverOtpPurpose } from "../enum/handover-stage.enum";

// =====================================================
// HANDOVER OTP
// One-time 6-digit codes for party handoffs.
//
// Security rules (enforced server-side):
// - Code is stored HASHED (sha256) — never raw.
// - Expires 10 minutes after issue.
// - Single use.
// - Max 5 verification attempts.
// - Issuing a new code invalidates previous ones.
// =====================================================

@Entity("handover_otps")
export class HandoverOtp {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // OTP ID
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    otpId!: string;

    // =========================
    // Rental + Stage
    // =========================

    @Column({
        type: "varchar",
        length: 50,
    })
    rentalId!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    stage!: string;

    // =========================
    // Purpose
    // =========================

    @Column({
        type: "enum",
        enum: HandoverOtpPurpose,
    })
    purpose!: HandoverOtpPurpose;

    // =========================
    // Code (hashed)
    // =========================

    @Column({
        type: "varchar",
        length: 255,
    })
    codeHash!: string;

    // =========================
    // Recipient
    // =========================

    @Column({
        type: "varchar",
        length: 255,
    })
    sentToEmail!: string;

    // =========================
    // Expiry & Attempts
    // =========================

    @Column({
        type: "timestamp",
    })
    expiresAt!: Date;

    @Column({
        type: "int",
        default: 0,
    })
    attempts!: number;

    // =========================
    // Usage
    // =========================

    @Column({
        type: "boolean",
        default: false,
    })
    isUsed!: boolean;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    usedAt?: Date | null;

    // Who verified it (the rider).

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    verifiedById?: string | null;

    // =========================
    // Timestamp
    // =========================

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt!: Date;
}
