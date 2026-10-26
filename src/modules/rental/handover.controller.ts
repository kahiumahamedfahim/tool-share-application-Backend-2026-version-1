import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Req,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    UsePipes,
    ValidationPipe,
} from "@nestjs/common";

import { FilesInterceptor } from "@nestjs/platform-express";

import {
    diskStorage,
} from "multer";
import {
    extname,
    join,
} from "path";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";

import { HandoverService } from "./handover.service";

import {
    AssignHandoverRiderDto,
    EarlyReturnDecisionDto,
    ModeratorGateDto,
    VerifyHandoverOtpDto,
} from "./dto/handover.dto";

import { HandoverStage } from "./enum/handover-stage.enum";

import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { RolesGuard } from "src/roles.guard";
import { Roles } from "src/auth/roles.decorator";

import type { AuthenticatedRequest } from "src/auth/authenticated-request";

import { UserRole } from "../users/enums/user-role-enum";

// =====================================================
// HANDOVER CONTROLLER (PHASE 13)
// Chain of custody: media evidence + OTP +
// moderator warehouse gates.
// =====================================================

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIMETYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
];

@Controller("rentals/handover")
export class HandoverController {

    constructor(
        private readonly handoverService: HandoverService,
    ) { }

    // =====================================================
    // RIDER - SUBMIT STAGE MEDIA
    // multipart: files field "media"
    // =====================================================

    @Post(":rentalId/stage/:stage/media")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER)
    @UseInterceptors(
        FilesInterceptor("media", 7, {
            storage: diskStorage({
                destination: (
                    request,
                    file,
                    callback,
                ) => {
                    const rentalId =
                        (request.params as any)
                            .rentalId ?? "unknown";

                    /*
                     * Sanitize the folder name:
                     * only allow the characters that
                     * our own generated IDs use.
                     */

                    const safeRentalId =
                        String(rentalId).replace(
                            /[^A-Za-z0-9_-]/g,
                            "",
                        );

                    const directory = join(
                        process.cwd(),
                        "uploads",
                        "handover",
                        safeRentalId || "unknown",
                    );

                    try {
                        mkdirSync(directory, {
                            recursive: true,
                        });

                        callback(null, directory);
                    } catch (error) {
                        callback(
                            error as Error,
                            "",
                        );
                    }
                },

                filename: (
                    request,
                    file,
                    callback,
                ) => {
                    const extension =
                        extname(
                            file.originalname,
                        ).toLowerCase();

                    callback(
                        null,
                        `${randomUUID()}${extension}`,
                    );
                },
            }),

            limits: {
                fileSize: MAX_VIDEO_BYTES,
                files: 7,
            },

            fileFilter: (
                request,
                file,
                callback,
            ) => {
                if (
                    !ALLOWED_MIMETYPES.includes(
                        file.mimetype,
                    )
                ) {
                    return callback(
                        new BadRequestException(
                            "Only JPEG/PNG/WebP photos and MP4 videos are allowed",
                        ),
                        false,
                    );
                }

                callback(null, true);
            },
        }),
    )
    async submitRiderCheckpoint(
        @Param("rentalId") rentalId: string,
        @Param("stage") stage: HandoverStage,
        @UploadedFiles()
        files: Express.Multer.File[],
        @Req() req: AuthenticatedRequest,
    ) {
        const riderId = req.user.userId;

        /*
         * Store paths relative to the uploads
         * prefix so they resolve under
         * /uploads/handover/{rentalId}/... like
         * product images. The folder name is the
         * same sanitized value used by the storage
         * destination above.
         */

        const safeRentalId =
            String(rentalId).replace(
                /[^A-Za-z0-9_-]/g,
                "",
            );

        const handoverFiles = (files ?? []).map(
            (file) => ({
                path: `/uploads/handover/${safeRentalId || "unknown"}/${file.filename}`,
                mimetype: file.mimetype,
            }),
        );

        return this.handoverService.submitRiderCheckpoint(
            rentalId,
            riderId,
            stage,
            handoverFiles,
        );
    }

    // =====================================================
    // RIDER - VERIFY STAGE OTP
    // =====================================================

    @Post(":rentalId/stage/:stage/verify-otp")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async verifyStageOtp(
        @Param("rentalId") rentalId: string,
        @Param("stage") stage: HandoverStage,
        @Body() dto: VerifyHandoverOtpDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const riderId = req.user.userId;

        return this.handoverService.verifyStageOtp(
            rentalId,
            riderId,
            stage,
            dto.code,
        );
    }

    // =====================================================
    // RIDER - RESEND OTP
    // =====================================================

    @Post(":rentalId/stage/:stage/resend-otp")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER)
    async resendStageOtp(
        @Param("rentalId") rentalId: string,
        @Param("stage") stage: HandoverStage,
        @Req() req: AuthenticatedRequest,
    ) {
        const riderId = req.user.userId;

        return this.handoverService.resendStageOtp(
            rentalId,
            riderId,
            stage,
        );
    }

    // =====================================================
    // MODERATOR - WAREHOUSE GATE VERDICT
    // (moderator ID captured server-side from JWT)
    // =====================================================

    @Patch(":rentalId/stage/:stage/gate")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async submitModeratorGate(
        @Param("rentalId") rentalId: string,
        @Param("stage") stage: HandoverStage,
        @Body() dto: ModeratorGateDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const moderatorId = req.user.userId;

        return this.handoverService.submitModeratorGate(
            rentalId,
            moderatorId,
            stage,
            dto.approved,
            dto.note,
        );
    }

    // =====================================================
    // MODERATOR - EARLY RETURN DECISION
    // =====================================================

    @Patch(":rentalId/early-return")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async decideEarlyReturn(
        @Param("rentalId") rentalId: string,
        @Body() dto: EarlyReturnDecisionDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const moderatorId = req.user.userId;

        return this.handoverService.decideEarlyReturn(
            rentalId,
            moderatorId,
            dto.approved,
            dto.note,
        );
    }

    // =====================================================
    // CHAIN OF CUSTODY TIMELINE
    // (owner + renter + rider + moderator/admin)
    // =====================================================

    @Get(":rentalId/checkpoints")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.USER,
        UserRole.RIDER,
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    async getCheckpoints(
        @Param("rentalId") rentalId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const userId = req.user.userId;
        const userRole = req.user.role;

        return this.handoverService.getCheckpoints(
            rentalId,
            userId,
            userRole,
        );
    }

    // =====================================================
    // RIDER - MY HANDOVER TASKS
    // =====================================================

    @Get("my-tasks")
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER)
    async getMyHandoverTasks(
        @Req() req: AuthenticatedRequest,
    ) {
        const riderId = req.user.userId;

        return this.handoverService.getMyHandoverTasks(
            riderId,
        );
    }

    @Get(":rentalId/assignments")
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MODERATOR, UserRole.ADMIN)
    async getHandoverRiderAssignments(
        @Param("rentalId") rentalId: string,
    ) {
        return this.handoverService.getHandoverRiderAssignments(rentalId);
    }

    @Patch(":rentalId/stage/:stage/assign-rider")
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MODERATOR, UserRole.ADMIN)
    @UsePipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }))
    async assignRiderToHandoverStage(
        @Param("rentalId") rentalId: string,
        @Param("stage") stage: HandoverStage,
        @Body() dto: AssignHandoverRiderDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.handoverService.assignRiderToHandoverStage(
            rentalId,
            stage,
            dto.riderId,
            req.user.userId,
        );
    }
}
