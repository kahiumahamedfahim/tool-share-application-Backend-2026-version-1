import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import {
    DataSource,
    In,
    Repository,
} from "typeorm";

import {
    HandoverCheckpoint,
    CheckpointMedia,
} from "./entity/handover-checkpoint.entity";

import {
    ActualRental,
    ActualRentalStatus,
    RentalStateHistory,
} from "./entity/actual-rental.entity";
import {
    RentalPayment,
    RentalPaymentStatus,
} from "./entity/rental-payment.entity";
import { RentalRequest } from "./entity/rental-request.entity";
import { Product } from "../Product/Entity/product.entity";
import { User } from "../users/entity/user-entity";

import {
    CheckpointMediaType,
    HandoverCheckpointStatus,
    HandoverOtpPurpose,
    HandoverStage,
    HANDOVER_STAGE_ORDER,
    MODERATOR_GATE_STAGES,
    RIDER_MEDIA_STAGES,
    STAGE_OTP_PURPOSES,
} from "./enum/handover-stage.enum";

import { UserRole } from "../users/enums/user-role-enum";

import { HandoverOtpService } from "./handover-otp.service";
import { HandoverRiderAssignment } from "./entity/handover-rider-assignment.entity";

import { PusherService } from "src/pusher/pusher.service";
import {
    PUSHER_CHANNELS,
    PUSHER_EVENTS,
} from "src/pusher/pusher.constants";
import {
    PusherNotificationData,
    PusherNotificationType,
} from "src/pusher/pusher.types";

// =====================================================
// Uploaded file (as passed by the multer interceptor)
// =====================================================

export interface UploadedHandoverFile {
    path: string;
    mimetype: string;
}

// =====================================================
// Human readable stage labels
// =====================================================

const STAGE_LABELS: Record<HandoverStage, string> = {
    [HandoverStage.OWNER_HANDOVER]:
        "Product pickup from owner",
    [HandoverStage.WAREHOUSE_IN]:
        "Warehouse inspection (pickup leg)",
    [HandoverStage.DELIVERED_TO_RENTER]:
        "Product delivery to renter",
    [HandoverStage.RETURN_PICKUP]:
        "Product return pickup from renter",
    [HandoverStage.RETURN_WAREHOUSE_IN]:
        "Warehouse inspection (return leg)",
    [HandoverStage.OWNER_RETURN]:
        "Product return to owner",
};

// OTP purposes that email the OWNER

const OWNER_OTP_PURPOSES: HandoverOtpPurpose[] = [
    HandoverOtpPurpose.OWNER_HANDOVER,
    HandoverOtpPurpose.OWNER_RETURN,
];

// Media limits (plan § DB design)

const MAX_PHOTOS = 6;
const MAX_VIDEOS = 1;
const RENTAL_DATE_TIME_ZONE = "Asia/Dhaka";

@Injectable()
export class HandoverService {
    private readonly logger = new Logger(HandoverService.name);

    constructor(
        @InjectRepository(HandoverCheckpoint)
        private readonly checkpointRepository: Repository<HandoverCheckpoint>,

        @InjectRepository(HandoverRiderAssignment)
        private readonly riderAssignmentRepository: Repository<HandoverRiderAssignment>,

        @InjectRepository(CheckpointMedia)
        private readonly mediaRepository: Repository<CheckpointMedia>,

        @InjectRepository(ActualRental)
        private readonly actualRentalRepository: Repository<ActualRental>,

        @InjectRepository(RentalStateHistory)
        private readonly rentalStateHistoryRepository: Repository<RentalStateHistory>,

        @InjectRepository(RentalPayment)
        private readonly rentalPaymentRepository: Repository<RentalPayment>,

        @InjectRepository(RentalRequest)
        private readonly rentalRequestRepository: Repository<RentalRequest>,

        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly handoverOtpService: HandoverOtpService,

        private readonly pusherService: PusherService,

        private readonly dataSource: DataSource,
    ) { }

    // =====================================================
    // HELPERS
    // =====================================================

    private generateId(prefix: string): string {
        const random = Math.random()
            .toString(36)
            .slice(2, 8);

        return `${prefix}-${Date.now()}-${random}`;
    }

    private buildNotification(
        type: PusherNotificationType,
        title: string,
        message: string,
        actor?: User | null,
    ): PusherNotificationData {
        return {
            type,
            title,
            message,
            userId: actor?.userId ?? "",
            userName: actor
                ? `${actor.firstName} ${actor.lastName}`.trim()
                : "ToolShare",
            email: actor?.email ?? "",
            timestamp: new Date(),
        };
    }

    private async notify(
        channels: string[],
        event: string,
        data: PusherNotificationData,
    ): Promise<void> {
        for (const channel of channels) {
            try {
                await this.pusherService.trigger(
                    channel,
                    event,
                    data,
                );
            } catch {
                // Do not log Pusher credentials or request details.
                this.logger.warn(
                    `Notification publish failed for event "${event}" on channel "${channel}".`,
                );
            }
        }
    }

    /**
     * All party channels for a rental:
     * owner + renter + assigned rider (+ moderators).
     * Both owner and renter always see the track.
     */
    private partyChannels(
        rental: ActualRental,
        extraModerator = false,
    ): string[] {
        const channels: string[] = [
            PUSHER_CHANNELS.OWNER(rental.ownerId),
            PUSHER_CHANNELS.RENTER(rental.renterId),
            PUSHER_CHANNELS.ADMIN_MODERATOR,
        ];

        if (rental.riderId) {
            channels.push(
                `rider-${rental.riderId}-channel`,
            );
        }

        void extraModerator;

        return channels;
    }

    private eventForStage(
        stage: HandoverStage,
    ): string {
        const returnLegStages: HandoverStage[] = [
            HandoverStage.RETURN_PICKUP,
            HandoverStage.RETURN_WAREHOUSE_IN,
            HandoverStage.OWNER_RETURN,
        ];

        return returnLegStages.includes(stage)
            ? PUSHER_EVENTS.RETURN_VERIFICATION
            : PUSHER_EVENTS.HANDOVER_VERIFICATION;
    }

    // =====================================================
    // LOAD RENTAL (with authorization context)
    // =====================================================

    private async loadRental(
        rentalId: string,
    ): Promise<ActualRental> {
        const rental =
            await this.actualRentalRepository.findOne({
                where: { rentalId },
            });

        if (!rental) {
            throw new NotFoundException(
                "Rental not found",
            );
        }

        return rental;
    }

    /**
     * Only the assigned rider may execute rider stages.
     * (Actor matching, enforced server-side.)
     */
    private async assertAssignedRider(
        rental: ActualRental,
        riderId: string,
        stage: HandoverStage,
    ): Promise<void> {
        const assignment = await this.getCurrentRiderAssignment(
            rental.rentalId,
            stage,
        );
        const assignedRiderId = assignment?.riderId ??
            (stage === HandoverStage.OWNER_HANDOVER ? rental.riderId : null);

        if (!assignedRiderId) {
            throw new ForbiddenException(
                "No rider is assigned to this handover stage",
            );
        }

        if (assignedRiderId !== riderId) {
            throw new ForbiddenException(
                "Only the rider assigned to this handover stage can perform it",
            );
        }
    }

    private async getCurrentRiderAssignment(
        rentalId: string,
        stage: HandoverStage,
    ): Promise<HandoverRiderAssignment | null> {
        return this.riderAssignmentRepository.findOne({
            where: { rentalId, stage },
            order: { assignedAt: "DESC" },
        });
    }

    // =====================================================
    // SEQUENTIAL GATING
    // Stage N is only available after N-1 is VERIFIED.
    // =====================================================

    private stageIndex(
        stage: HandoverStage,
    ): number {
        return HANDOVER_STAGE_ORDER.indexOf(stage);
    }

    private async assertStageUnlocked(
        rentalId: string,
        stage: HandoverStage,
    ): Promise<void> {
        const index = this.stageIndex(stage);

        if (index <= 0) {
            return;
        }

        const previousStage =
            HANDOVER_STAGE_ORDER[index - 1];

        const previousCheckpoint =
            await this.checkpointRepository.findOne({
                where: {
                    rentalId,
                    stage: previousStage,
                    status:
                        HandoverCheckpointStatus.VERIFIED,
                },
            });

        if (!previousCheckpoint) {
            throw new BadRequestException(
                `Step "${STAGE_LABELS[stage]}" is locked. Complete "${STAGE_LABELS[previousStage]}" first.`,
            );
        }
    }

    // =====================================================
    // STAGE AVAILABILITY
    // What still needs to be done for a rental?
    // =====================================================

    private async getVerifiedStages(
        rentalId: string,
    ): Promise<HandoverCheckpoint[]> {
        return this.checkpointRepository.find({
            where: {
                rentalId,
                status:
                    HandoverCheckpointStatus.VERIFIED,
            },
            order: { verifiedAt: "ASC" },
        });
    }

    private computeNextStage(
        checkpoints: HandoverCheckpoint[],
    ): HandoverStage | null {
        for (const stage of HANDOVER_STAGE_ORDER) {
            const done = checkpoints.some(
                (checkpoint) =>
                    checkpoint.stage === stage,
            );

            if (!done) {
                return stage;
            }
        }

        return null;
    }

    // =====================================================
    // MEDIA VALIDATION
    // =====================================================

    private classifyAndValidateMedia(
        files: UploadedHandoverFile[],
    ): {
        mediaType: CheckpointMediaType;
        fileUrl: string;
    }[] {

        if (!files || files.length === 0) {
            throw new BadRequestException(
                "At least one photo is required",
            );
        }

        const photos = files.filter((file) =>
            file.mimetype.startsWith("image/"),
        );

        const videos = files.filter((file) =>
            file.mimetype.startsWith("video/"),
        );

        const unknown = files.filter(
            (file) =>
                !file.mimetype.startsWith("image/") &&
                !file.mimetype.startsWith("video/"),
        );

        if (unknown.length > 0) {
            throw new BadRequestException(
                "Only JPEG/PNG photos and MP4 videos are allowed",
            );
        }

        if (photos.length < 1) {
            throw new BadRequestException(
                "At least one photo is required",
            );
        }

        if (photos.length > MAX_PHOTOS) {
            throw new BadRequestException(
                `Maximum ${MAX_PHOTOS} photos allowed`,
            );
        }

        if (videos.length > MAX_VIDEOS) {
            throw new BadRequestException(
                `Maximum ${MAX_VIDEOS} video allowed`,
            );
        }

        return [
            ...photos.map((file) => ({
                mediaType: CheckpointMediaType.PHOTO,
                fileUrl: file.path,
            })),
            ...videos.map((file) => ({
                mediaType: CheckpointMediaType.VIDEO,
                fileUrl: file.path,
            })),
        ];
    }

    // =====================================================
    // RIDER - SUBMIT STAGE MEDIA
    // Creates the PENDING checkpoint with media and
    // sends the OTP to the responsible party
    // (except early-return, which waits for the
    // moderator).
    // =====================================================

    async submitRiderCheckpoint(
        rentalId: string,
        riderId: string,
        stage: HandoverStage,
        files: UploadedHandoverFile[],
        note?: string,
    ): Promise<HandoverCheckpoint> {

        // -------------------------------------------------
        // Stage must be a rider media stage
        // -------------------------------------------------

        if (!RIDER_MEDIA_STAGES.includes(stage)) {
            throw new BadRequestException(
                "This step is not a rider handover step",
            );
        }

        // -------------------------------------------------
        // Rental + actor check
        // -------------------------------------------------

        const rental = await this.loadRental(rentalId);

        await this.assertAssignedRider(rental, riderId, stage);

        if (
            rental.status ===
            ActualRentalStatus.COMPLETED ||
            rental.status ===
            ActualRentalStatus.CANCELLED
        ) {
            throw new BadRequestException(
                "This rental is already finished",
            );
        }

        // -------------------------------------------------
        // Sequential gating
        // -------------------------------------------------

        await this.assertStageUnlocked(rentalId, stage);

        // -------------------------------------------------
        // No duplicate checkpoint for the same stage
        // -------------------------------------------------

        const existing =
            await this.checkpointRepository.findOne({
                where: { rentalId, stage },
            });

        if (existing) {
            throw new BadRequestException(
                `Step "${STAGE_LABELS[stage]}" was already submitted. Use the verification step instead.`,
            );
        }

        // -------------------------------------------------
        // Media validation
        // -------------------------------------------------

        const mediaEntries =
            this.classifyAndValidateMedia(files);

        // -------------------------------------------------
        // Early return gate (Stage 4)
        // -------------------------------------------------

        const isEarlyReturn =
            stage === HandoverStage.RETURN_PICKUP &&
            Date.now() < rental.endDate.getTime();

        // -------------------------------------------------
        // Create checkpoint (PENDING) + media
        // -------------------------------------------------

        const checkpoint =
            this.checkpointRepository.create({
                checkpointId:
                    this.generateId("CHK"),
                rentalId,
                stage,
                actorId: riderId,
                status:
                    HandoverCheckpointStatus.PENDING,
                note,
                isEarlyReturn,
                earlyReturnApproved:
                    isEarlyReturn ? null : null,
            });

        const savedCheckpoint =
            await this.checkpointRepository.save(checkpoint);

        for (const entry of mediaEntries) {
            const media =
                this.mediaRepository.create({
                    checkpointId:
                        savedCheckpoint.checkpointId,
                    mediaType: entry.mediaType,
                    fileUrl: entry.fileUrl,
                });

            await this.mediaRepository.save(media);
        }

        // -------------------------------------------------
        // Early return: moderator must approve first
        // -------------------------------------------------

        const moderator =
            rental.moderatorId
                ? await this.userRepository.findOne({
                    where: {
                        userId: rental.moderatorId,
                    },
                })
                : null;

        const product =
            await this.productRepository.findOne({
                where: { productId: rental.productId },
            });

        if (isEarlyReturn) {
            await this.notify(
                [
                    PUSHER_CHANNELS.ADMIN_MODERATOR,
                    PUSHER_CHANNELS.OWNER(rental.ownerId),
                ],
                PUSHER_EVENTS.RETURN_VERIFICATION,
                this.buildNotification(
                    PusherNotificationType.NEGOTIATION_OFFER,
                    "Early Return Requested",
                    `The renter wants to return "${product?.name ?? "the product"}" before the rental end date. Moderator approval is required.`,
                    moderator,
                ),
            );

            return savedCheckpoint;
        }

        // -------------------------------------------------
        // Send OTP to the responsible party
        // -------------------------------------------------

        await this.sendStageOtp(
            rental,
            stage,
            product,
        );

        return savedCheckpoint;
    }

    // =====================================================
    // OTP DISPATCH
    // =====================================================

    private async sendStageOtp(
        rental: ActualRental,
        stage: HandoverStage,
        product: Product | null,
    ): Promise<void> {

        const purpose = STAGE_OTP_PURPOSES[stage];

        if (!purpose) {
            throw new BadRequestException(
                "This step does not require a verification code",
            );
        }

        const recipientId =
            OWNER_OTP_PURPOSES.includes(purpose)
                ? rental.ownerId
                : rental.renterId;

        const recipient =
            await this.userRepository.findOne({
                where: { userId: recipientId },
            });

        if (!recipient) {
            throw new NotFoundException(
                "Verification recipient not found",
            );
        }

        await this.handoverOtpService.sendOtp(
            rental.rentalId,
            stage,
            purpose,
            {
                email: recipient.email,
                firstName: recipient.firstName,
            },
            product?.name ?? "the product",
            STAGE_LABELS[stage],
        );
    }

    // =====================================================
    // RIDER - VERIFY STAGE OTP
    // On success the checkpoint becomes VERIFIED and
    // stage side-effects run (ACTIVE / cash / etc).
    // =====================================================

    async verifyStageOtp(
        rentalId: string,
        riderId: string,
        stage: HandoverStage,
        code: string,
    ): Promise<HandoverCheckpoint> {

        // -------------------------------------------------
        // Stage must be a rider OTP stage
        // -------------------------------------------------

        const purpose = STAGE_OTP_PURPOSES[stage];

        if (!purpose) {
            throw new BadRequestException(
                "This step does not require a verification code",
            );
        }

        // -------------------------------------------------
        // Rental + actor
        // -------------------------------------------------

        const rental = await this.loadRental(rentalId);

        await this.assertAssignedRider(rental, riderId, stage);

        // -------------------------------------------------
        // Checkpoint must exist and be PENDING
        // -------------------------------------------------

        const checkpoint =
            await this.checkpointRepository.findOne({
                where: { rentalId, stage },
            });

        if (!checkpoint) {
            throw new NotFoundException(
                `No media was submitted for "${STAGE_LABELS[stage]}" yet`,
            );
        }

        if (
            checkpoint.status !==
            HandoverCheckpointStatus.PENDING
        ) {
            throw new BadRequestException(
                "This step is already verified",
            );
        }

        // -------------------------------------------------
        // Early-return blocks verification until the
        // moderator approved it.
        // -------------------------------------------------

        if (
            checkpoint.isEarlyReturn &&
            checkpoint.earlyReturnApproved !== true
        ) {
            throw new BadRequestException(
                checkpoint.earlyReturnApproved === false
                    ? "Early return was rejected; wait until the scheduled rental end date"
                    : "Early return is waiting for moderator approval",
            );
        }

        // -------------------------------------------------
        // OTP verification (single use, hashed,
        // expiry + attempt limited)
        // -------------------------------------------------

        await this.handoverOtpService.verifyOtp(
            rentalId,
            purpose,
            code,
            riderId,
        );

        // -------------------------------------------------
        // Verify checkpoint
        // -------------------------------------------------

        checkpoint.status =
            HandoverCheckpointStatus.VERIFIED;

        checkpoint.verifiedAt = new Date();
        checkpoint.verifiedById = riderId;

        const savedCheckpoint =
            await this.checkpointRepository.save(checkpoint);

        // -------------------------------------------------
        // State history
        // -------------------------------------------------

        await this.appendStateHistory(
            rental,
            stage,
            riderId,
        );

        // -------------------------------------------------
        // Stage side-effects
        // -------------------------------------------------

        await this.applyStageSideEffects(
            rental,
            stage,
            savedCheckpoint.verifiedAt ?? new Date(),
            riderId,
        );

        // -------------------------------------------------
        // Notifications — both owner and renter see
        // the track.
        // -------------------------------------------------

        const rider =
            await this.userRepository.findOne({
                where: { userId: riderId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: rental.productId },
            });

        const isDelivery =
            stage === HandoverStage.DELIVERED_TO_RENTER;

        await this.notify(
            this.partyChannels(rental),
            this.eventForStage(stage),
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                isDelivery
                    ? "Product Delivered"
                    : `${STAGE_LABELS[stage]} — Verified`,
                isDelivery
                    ? `"${product?.name ?? "the product"}" was delivered to the renter. Rental day 1 starts ${rental.startDate.toISOString().slice(0, 10)}; the scheduled end date is ${rental.endDate.toISOString().slice(0, 10)}.`
                    : `"${product?.name ?? "the product"}": step "${STAGE_LABELS[stage]}" was verified.`,
                rider,
            ),
        );

        return savedCheckpoint;
    }

    // =====================================================
    // STAGE SIDE-EFFECTS
    // =====================================================

    private async applyStageSideEffects(
        rental: ActualRental,
        stage: HandoverStage,
        stageVerifiedAt: Date = new Date(),
        stageRiderId?: string,
    ): Promise<void> {

        if (
            stage === HandoverStage.DELIVERED_TO_RENTER
        ) {
            /*
             * Rental becomes ACTIVE and the cash
             * payment is marked collected by the rider
             * at the renter's door (Phase 12 flow).
             */

            const queryRunner =
                this.dataSource.createQueryRunner();

            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                if (
                    rental.status ===
                    ActualRentalStatus.PENDING_HANDOVER
                ) {
                    // Rental dates are date-only values normalized to UTC
                    // midnight elsewhere in the app. Use Dhaka's calendar
                    // date for the actual receipt, then start counting the
                    // following calendar day.
                    const dhakaDateParts = new Intl.DateTimeFormat("en-CA", {
                        timeZone: RENTAL_DATE_TIME_ZONE,
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    }).formatToParts(stageVerifiedAt);
                    const datePart = (type: string) => Number(
                        dhakaDateParts.find((part) => part.type === type)?.value,
                    );
                    const nextRentalDay = new Date(Date.UTC(
                        datePart("year"),
                        datePart("month") - 1,
                        datePart("day") + 1,
                    ));
                    const rentalEndDate = new Date(nextRentalDay);
                    rentalEndDate.setUTCDate(
                        rentalEndDate.getUTCDate() + rental.rentalDays,
                    );

                    rental.startDate = nextRentalDay;
                    rental.endDate = rentalEndDate;
                    rental.status =
                        ActualRentalStatus.ACTIVE;

                    await queryRunner.manager.save(rental);
                }

                const payment =
                    await queryRunner.manager.findOne(
                        RentalPayment,
                        {
                            where: {
                                rentalId:
                                    rental.rentalId,
                            },
                        },
                    );

                if (
                    payment &&
                    payment.status ===
                    RentalPaymentStatus.PENDING
                ) {
                    payment.status =
                        RentalPaymentStatus.COLLECTED_BY_RIDER;

                    payment.collectedById =
                        stageRiderId ?? null;

                    payment.collectedAt = new Date();

                    await queryRunner.manager.save(payment);
                }

                await queryRunner.commitTransaction();
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        }

        if (
            stage === HandoverStage.OWNER_RETURN
        ) {
            /*
             * The rider hands the collected cash to
             * the owner here. Payment moves to
             * DELIVERED_TO_OWNER; the owner still has
             * to confirm receipt (which completes
             * the rental).
             */

            const payment =
                await this.rentalPaymentRepository.findOne({
                    where: {
                        rentalId: rental.rentalId,
                    },
                });

            if (
                payment &&
                payment.status ===
                RentalPaymentStatus.COLLECTED_BY_RIDER
            ) {
                payment.status =
                    RentalPaymentStatus.DELIVERED_TO_OWNER;

                payment.deliveredById =
                    stageRiderId ?? null;

                payment.deliveredAt = new Date();

                await this.rentalPaymentRepository.save(
                    payment,
                );
            }
        }
    }

    // =====================================================
    // STATE HISTORY
    // =====================================================

    private async appendStateHistory(
        rental: ActualRental,
        stage: HandoverStage,
        actorId: string,
    ): Promise<void> {

        const history =
            this.rentalStateHistoryRepository.create({
                rentalId: rental.rentalId,
                status: stage,
                note: STAGE_LABELS[stage],
                actorId,
            });

        await this.rentalStateHistoryRepository.save(
            history,
        );
    }

    // =====================================================
    // MODERATOR - WAREHOUSE GATE
    // =====================================================

    async submitModeratorGate(
        rentalId: string,
        moderatorId: string,
        stage: HandoverStage,
        approved: boolean,
        note?: string,
    ): Promise<HandoverCheckpoint> {

        // -------------------------------------------------
        // Stage must be a moderator gate
        // -------------------------------------------------

        if (!MODERATOR_GATE_STAGES.includes(stage)) {
            throw new BadRequestException(
                "This step is a moderator warehouse inspection",
            );
        }

        const rental = await this.loadRental(rentalId);

        // -------------------------------------------------
        // Sequential gating
        // -------------------------------------------------

        await this.assertStageUnlocked(rentalId, stage);

        const existing =
            await this.checkpointRepository.findOne({
                where: { rentalId, stage },
            });

        if (
            existing &&
            existing.status !== HandoverCheckpointStatus.REJECTED
        ) {
            throw new BadRequestException(
                `Step "${STAGE_LABELS[stage]}" was already approved or is waiting for review`,
            );
        }

        // -------------------------------------------------
        // Moderator ID is captured server-side from
        // the JWT — never from the request body.
        // -------------------------------------------------

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        const checkpoint = existing ?? this.checkpointRepository.create({
                checkpointId:
                    this.generateId("CHK"),
                rentalId,
                stage,
                actorId: moderatorId,
                verifiedById: moderatorId,
                status: approved
                    ? HandoverCheckpointStatus.VERIFIED
                    : HandoverCheckpointStatus.REJECTED,
                note,
                verifiedAt: approved
                    ? new Date()
                    : null,
            });

        checkpoint.actorId = moderatorId;
        checkpoint.verifiedById = moderatorId;
        checkpoint.status = approved
            ? HandoverCheckpointStatus.VERIFIED
            : HandoverCheckpointStatus.REJECTED;
        checkpoint.note = note;
        checkpoint.verifiedAt = approved ? new Date() : null;

        const savedCheckpoint =
            await this.checkpointRepository.save(checkpoint);

        // -------------------------------------------------
        // State history
        // -------------------------------------------------

        await this.appendStateHistory(
            rental,
            stage,
            moderatorId,
        );

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const product =
            await this.productRepository.findOne({
                where: { productId: rental.productId },
            });

        await this.notify(
            this.partyChannels(rental),
            this.eventForStage(stage),
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                approved
                    ? "Warehouse Check Passed"
                    : "Warehouse Check Failed",
                approved
                    ? `The moderator verified "${product?.name ?? "the product"}" at the warehouse.`
                    : `The moderator found an issue with "${product?.name ?? "the product"}" at the warehouse. Contact the ToolShare moderator team.`,
                moderator,
            ),
        );

        return savedCheckpoint;
    }

    // =====================================================
    // MODERATOR - EARLY RETURN DECISION
    // =====================================================

    async decideEarlyReturn(
        rentalId: string,
        moderatorId: string,
        approved: boolean,
        note?: string,
    ): Promise<HandoverCheckpoint> {

        const rental = await this.loadRental(rentalId);

        const checkpoint =
            await this.checkpointRepository.findOne({
                where: {
                    rentalId,
                    stage:
                        HandoverStage.RETURN_PICKUP,
                },
            });

        if (!checkpoint) {
            throw new NotFoundException(
                "No return pickup was submitted yet",
            );
        }

        if (!checkpoint.isEarlyReturn) {
            throw new BadRequestException(
                "This return is not an early return",
            );
        }

        if (
            checkpoint.earlyReturnApproved !== null &&
            checkpoint.earlyReturnApproved !== undefined
        ) {
            throw new BadRequestException(
                "This early return was already decided",
            );
        }

        checkpoint.earlyReturnApproved = approved;
        checkpoint.note = note ?? checkpoint.note;

        const savedCheckpoint =
            await this.checkpointRepository.save(checkpoint);

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: rental.productId },
            });

        // -------------------------------------------------
        // Approved → send the renter's return OTP now.
        // -------------------------------------------------

        if (approved) {
            await this.sendStageOtp(
                rental,
                HandoverStage.RETURN_PICKUP,
                product,
            );
        }

        await this.notify(
            this.partyChannels(rental),
            PUSHER_EVENTS.RETURN_VERIFICATION,
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                approved
                    ? "Early Return Approved"
                    : "Early Return Rejected",
                approved
                    ? `The moderator approved the early return of "${product?.name ?? "the product"}". The renter's verification code was sent.`
                    : `The moderator rejected the early return of "${product?.name ?? "the product"}". The product must be returned on the agreed date.`,
                moderator,
            ),
        );

        return savedCheckpoint;
    }

    // =====================================================
    // CHAIN OF CUSTODY TIMELINE
    // Visible to BOTH owner and renter (plus the
    // assigned rider and moderators).
    // =====================================================

    async getCheckpoints(
        rentalId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<{
        rentalId: string;
        rentalStatus: ActualRentalStatus;
        startDate: string;
        endDate: string;
        nextStage: HandoverStage | null;
        complete: boolean;
        product: {
            productId: string;
            name: string;
        } | null;
        checkpoints: any[];
    }> {

        const rental = await this.loadRental(rentalId);

        // -------------------------------------------------
        // Access: owner, renter, assigned rider,
        // moderators/admins.
        // -------------------------------------------------

        const riderAssignment = userRole === UserRole.RIDER
            ? await this.riderAssignmentRepository.findOne({
                where: { rentalId, riderId: userId },
            })
            : null;

        const isParticipant =
            rental.ownerId === userId ||
            rental.renterId === userId ||
            rental.riderId === userId ||
            Boolean(riderAssignment);

        const isStaff =
            userRole === UserRole.MODERATOR ||
            userRole === UserRole.ADMIN;

        if (!isParticipant && !isStaff) {
            throw new ForbiddenException(
                "You are not allowed to view this custody track",
            );
        }

        // -------------------------------------------------
        // Checkpoints + media
        // -------------------------------------------------

        const checkpoints =
            await this.checkpointRepository.find({
                where: { rentalId },
                relations: {
                    media: true,
                    actor: true,
                    verifiedBy: true,
                },
                order: { createdAt: "ASC" },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: rental.productId },
            });

        // -------------------------------------------------
        // Next stage
        // -------------------------------------------------

        const verifiedCheckpoints =
            checkpoints.filter(
                (checkpoint) =>
                    checkpoint.status ===
                    HandoverCheckpointStatus.VERIFIED,
            );

        const nextStage =
            this.computeNextStage(verifiedCheckpoints);

        return {
            rentalId: rental.rentalId,
            rentalStatus: rental.status,
            startDate: rental.startDate.toISOString(),
            endDate: rental.endDate.toISOString(),
            nextStage,
            complete: nextStage === null,
            product: product
                ? {
                    productId: product.productId,
                    name: product.name,
                }
                : null,
            checkpoints: checkpoints.map(
                (checkpoint) => ({
                    checkpointId:
                        checkpoint.checkpointId,
                    stage: checkpoint.stage,
                    stageLabel:
                        STAGE_LABELS[checkpoint.stage],
                    status: checkpoint.status,
                    isEarlyReturn:
                        checkpoint.isEarlyReturn,
                    earlyReturnApproved:
                        checkpoint.earlyReturnApproved,
                    note: checkpoint.note,
                    actor: checkpoint.actor
                        ? {
                            userId:
                                checkpoint.actor.userId,
                            name:
                                `${checkpoint.actor.firstName} ${checkpoint.actor.lastName}`.trim(),
                        }
                        : { userId: checkpoint.actorId, name: "" },
                    verifiedBy: checkpoint.verifiedBy
                        ? {
                            userId:
                                checkpoint.verifiedBy.userId,
                            name:
                                `${checkpoint.verifiedBy.firstName} ${checkpoint.verifiedBy.lastName}`.trim(),
                            role: checkpoint.verifiedBy.role,
                        }
                        : null,
                    createdAt:
                        checkpoint.createdAt.toISOString(),
                    verifiedAt:
                        checkpoint.verifiedAt?.toISOString() ??
                        null,
                    media: (checkpoint.media ?? []).map(
                        (media) => ({
                            mediaType: media.mediaType,
                            fileUrl: media.fileUrl,
                            createdAt:
                                media.createdAt.toISOString(),
                        }),
                    ),
                }),
            ),
        };
    }

    // =====================================================
    // RIDER - MY HANDOVER TASKS
    // =====================================================

    async getMyHandoverTasks(
        riderId: string,
    ): Promise<
        {
            rentalId: string;
            rentalRequestId: string;
            status: ActualRentalStatus;
            nextStage: HandoverStage | null;
            nextStageLabel: string | null;
            startDate: string;
            endDate: string;
            totalPayable: string;
            pickupAddress: string;
            deliveryAddress: string;
            contactPhone: string;
            product: {
                productId: string;
                name: string;
            } | null;
            renter: {
                userId: string;
                name: string;
                email: string;
            } | null;
            owner: {
                userId: string;
                name: string;
                email: string;
            } | null;
            pendingCheckpoint: {
                stage: HandoverStage;
                isEarlyReturn: boolean;
                earlyReturnApproved: boolean | null;
            } | null;
        }[]
    > {

        const allRentals = await this.actualRentalRepository.find({
            where: {
                status: In([
                    ActualRentalStatus.PENDING_HANDOVER,
                    ActualRentalStatus.ACTIVE,
                ]),
            },
            order: { createdAt: "ASC" },
        });

        const tasks: any[] = [];

        for (const rental of allRentals) {
            const checkpoints =
                await this.checkpointRepository.find({
                    where: {
                        rentalId: rental.rentalId,
                    },
                });

            const verified =
                checkpoints.filter(
                    (checkpoint) =>
                        checkpoint.status ===
                        HandoverCheckpointStatus.VERIFIED,
                );

            const nextStage =
                this.computeNextStage(verified);

            if (!nextStage) {
                continue;
            }

            if (RIDER_MEDIA_STAGES.includes(nextStage)) {
                const assignment = await this.getCurrentRiderAssignment(
                    rental.rentalId,
                    nextStage,
                );
                const assignedRiderId = assignment?.riderId ??
                    (nextStage === HandoverStage.OWNER_HANDOVER ? rental.riderId : null);
                if (assignedRiderId !== riderId) {
                    continue;
                }
            } else if (rental.riderId !== riderId) {
                // Keep the previous handoff rider informed while the
                // product waits for a moderator's warehouse decision.
                continue;
            }

            // Pending (PENDING) checkpoint for the
            // next stage — waiting for OTP or
            // moderator decision.

            const pendingCheckpoint =
                checkpoints.find(
                    (checkpoint) =>
                        checkpoint.stage === nextStage &&
                        checkpoint.status ===
                        HandoverCheckpointStatus.PENDING,
                ) ?? null;

            const product =
                await this.productRepository.findOne({
                    where: {
                        productId: rental.productId,
                    },
                });

            const renter =
                await this.userRepository.findOne({
                    where: { userId: rental.renterId },
                });

            const owner =
                await this.userRepository.findOne({
                    where: { userId: rental.ownerId },
                });

            tasks.push({
                rentalId: rental.rentalId,
                rentalRequestId:
                    rental.rentalRequestId,
                status: rental.status,
                nextStage,
                nextStageLabel:
                    STAGE_LABELS[nextStage],
                startDate:
                    rental.startDate.toISOString(),
                endDate:
                    rental.endDate.toISOString(),
                totalPayable: rental.totalPayable,
                pickupAddress: rental.pickupAddress,
                deliveryAddress:
                    rental.deliveryAddress,
                contactPhone: rental.contactPhone,
                product: product
                    ? {
                        productId: product.productId,
                        name: product.name,
                    }
                    : null,
                renter: renter
                    ? {
                        userId: renter.userId,
                        name:
                            `${renter.firstName} ${renter.lastName}`.trim(),
                        email: renter.email,
                    }
                    : null,
                owner: owner
                    ? {
                        userId: owner.userId,
                        name:
                            `${owner.firstName} ${owner.lastName}`.trim(),
                        email: owner.email,
                    }
                    : null,
                pendingCheckpoint: pendingCheckpoint
                    ? {
                        stage:
                            pendingCheckpoint.stage,
                        isEarlyReturn:
                            pendingCheckpoint.isEarlyReturn,
                        earlyReturnApproved:
                            pendingCheckpoint.earlyReturnApproved,
                    }
                    : null,
            });
        }

        return tasks;
    }

    async getHandoverRiderAssignments(rentalId: string) {
        const rental = await this.loadRental(rentalId);
        const checkpoints = await this.checkpointRepository.find({
            where: { rentalId },
        });
        const verified = checkpoints.filter((checkpoint) =>
            checkpoint.status === HandoverCheckpointStatus.VERIFIED,
        );
        const nextStage = this.computeNextStage(verified);
        const assignments = await this.riderAssignmentRepository.find({
            where: { rentalId },
            order: { assignedAt: "ASC" },
        });

        return {
            rentalId,
            nextStage,
            assignmentLocked: nextStage
                ? checkpoints.some((checkpoint) => checkpoint.stage === nextStage)
                : true,
            assignments,
        };
    }

    async assignRiderToHandoverStage(
        rentalId: string,
        stage: HandoverStage,
        riderId: string,
        moderatorId: string,
    ) {
        if (!RIDER_MEDIA_STAGES.includes(stage)) {
            throw new BadRequestException("A rider can only be assigned to a physical handoff stage");
        }

        const [rental, rider] = await Promise.all([
            this.loadRental(rentalId),
            this.userRepository.findOne({ where: { userId: riderId } }),
        ]);
        if (!rider || rider.role !== UserRole.RIDER) {
            throw new BadRequestException("Selected user is not an active rider");
        }
        if (
            rental.status === ActualRentalStatus.COMPLETED ||
            rental.status === ActualRentalStatus.CANCELLED
        ) {
            throw new BadRequestException("A rider cannot be assigned to a finished rental");
        }

        const checkpoints = await this.checkpointRepository.find({
            where: { rentalId },
        });
        const verified = checkpoints.filter((checkpoint) =>
            checkpoint.status === HandoverCheckpointStatus.VERIFIED,
        );
        const nextStage = this.computeNextStage(verified);
        if (nextStage !== stage) {
            throw new BadRequestException("Assign a rider only for the next unlocked physical handoff stage");
        }
        if (checkpoints.some((checkpoint) => checkpoint.stage === stage)) {
            throw new BadRequestException("This handoff has already started; its rider assignment is locked");
        }

        const assignment = await this.dataSource.transaction(async (manager) => {
            const lockedRental = await manager.findOne(ActualRental, {
                where: { rentalId },
                lock: { mode: "pessimistic_write" },
            });
            if (!lockedRental) {
                throw new NotFoundException("Rental not found");
            }

            const latestCheckpoints = await manager.find(HandoverCheckpoint, {
                where: { rentalId },
            });
            const latestNextStage = this.computeNextStage(
                latestCheckpoints.filter((checkpoint) =>
                    checkpoint.status === HandoverCheckpointStatus.VERIFIED,
                ),
            );
            if (
                latestNextStage !== stage ||
                latestCheckpoints.some((checkpoint) => checkpoint.stage === stage)
            ) {
                throw new BadRequestException("The handoff started or advanced while this assignment was being saved");
            }

            const record = manager.create(HandoverRiderAssignment, {
                assignmentId: this.generateId("RIDERASSIGN"),
                rentalId,
                stage,
                riderId,
                assignedById: moderatorId,
            });
            lockedRental.riderId = riderId;
            await manager.save(lockedRental);
            return manager.save(record);
        });

        const moderator = await this.userRepository.findOne({
            where: { userId: moderatorId },
        });
        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(rental.ownerId),
                PUSHER_CHANNELS.RENTER(rental.renterId),
                `rider-${riderId}-channel`,
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.HANDOVER_VERIFICATION,
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Rider Assigned",
                `${rider.firstName} ${rider.lastName} was assigned to ${STAGE_LABELS[stage]}.`,
                moderator,
            ),
        );

        return assignment;
    }

    // =====================================================
    // RESEND OTP (rider)
    // =====================================================

    async resendStageOtp(
        rentalId: string,
        riderId: string,
        stage: HandoverStage,
    ): Promise<{ sentTo: string }> {

        const purpose = STAGE_OTP_PURPOSES[stage];

        if (!purpose) {
            throw new BadRequestException(
                "This step does not require a verification code",
            );
        }

        const rental = await this.loadRental(rentalId);

        await this.assertAssignedRider(rental, riderId, stage);

        const checkpoint =
            await this.checkpointRepository.findOne({
                where: { rentalId, stage },
            });

        if (!checkpoint) {
            throw new NotFoundException(
                `No media was submitted for "${STAGE_LABELS[stage]}" yet`,
            );
        }

        if (
            checkpoint.status !==
            HandoverCheckpointStatus.PENDING
        ) {
            throw new BadRequestException(
                "This step is already verified",
            );
        }

        if (
            checkpoint.isEarlyReturn &&
            checkpoint.earlyReturnApproved !== true
        ) {
            const earlyReturnWasRejected = checkpoint.earlyReturnApproved === false;
            if (!earlyReturnWasRejected || Date.now() < rental.endDate.getTime()) {
                throw new BadRequestException(
                    earlyReturnWasRejected
                        ? "Early return was rejected; wait until the scheduled rental end date"
                        : "Early return is waiting for moderator approval",
                );
            }

            // The early pickup was declined, but the scheduled return date
            // has now arrived. Reuse the rider's evidence as the normal
            // return pickup and issue the renter's OTP.
            checkpoint.isEarlyReturn = false;
            checkpoint.earlyReturnApproved = null;
            await this.checkpointRepository.save(checkpoint);
        }

        const product =
            await this.productRepository.findOne({
                where: { productId: rental.productId },
            });

        await this.sendStageOtp(
            rental,
            stage,
            product,
        );

        const recipientId =
            OWNER_OTP_PURPOSES.includes(purpose)
                ? rental.ownerId
                : rental.renterId;

        const recipient =
            await this.userRepository.findOne({
                where: { userId: recipientId },
            });

        return {
            sentTo: recipient?.email ?? "",
        };
    }
}
