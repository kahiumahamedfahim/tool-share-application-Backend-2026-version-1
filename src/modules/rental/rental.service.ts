import {
    BadRequestException,
    ConflictException,
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

// =====================================================
// Entities
// =====================================================

import { RentalRequest } from "./entity/rental-request.entity";
import {
    NegotiationOffer,
    NegotiationOfferStatus,
} from "./entity/negotiation-offer.entity";
import {
    ActualRental,
    ActualRentalStatus,
    RentalStateHistory,
} from "./entity/actual-rental.entity";
import {
    RentalPayment,
    RentalPaymentStatus,
} from "./entity/rental-payment.entity";
import {
    RentalCharge,
    RentalChargeEvent,
    RentalChargeEventAction,
    RentalChargePaymentMethod,
    RentalChargePayerRole,
    RentalChargeStatus,
    RentalChargeType,
} from "./entity/rental-charge.entity";
import { HandoverRiderAssignment } from "./entity/handover-rider-assignment.entity";
import {
    CheckpointMedia,
    HandoverCheckpoint,
} from "./entity/handover-checkpoint.entity";
import { HandoverOtp } from "./entity/handover-otp.entity";
import {
    HandoverCheckpointStatus,
    HandoverStage,
} from "./enum/handover-stage.enum";
import {
    ReviewRentalChargePaymentDto,
} from "./dto/rental-charge.dto";

import { Product } from "../Product/Entity/product.entity";
import { ProductAvailabilityStatus } from "../Product/enum/productavailabilityStatus.enum";
import { User } from "../users/entity/user-entity";

// =====================================================
// DTOs
// =====================================================

import { CreateRentalRequestDto } from "./dto/create-rental-request.dto";
import { CreateNegotiationOfferDto } from "./dto/create-negotiation-offer.dto";
import {
    NegotiationOfferAction,
    UpdateNegotiationOfferDto,
} from "./dto/update-negotiation-offer.dto";
import {
    OwnerRentalRequestAction,
} from "./dto/owner-rental-request-action.dto";
import {
    RenterRentalRequestAction,
} from "./dto/renter-rental-request-action.dto";
import {
    ChargesAction,
} from "./dto/accept-charges.dto";
import {
    ModeratorPickupReviewDto,
    ModeratorReturnReviewDto,
    ModeratorRentalRequestAction,
    ReviewRentalRequestDto,
} from "./dto/ReviewRentalRequestDto";

// =====================================================
// Enums / Shared
// =====================================================

import { RentalRequestStatus } from "./enum/rental-request-status.enum";
import { UserRole } from "../users/enums/user-role-enum";
import { PaginationDto } from "../pagination/pagination-dto";

// =====================================================
// Notifications / Email
// =====================================================

import { PusherService } from "src/pusher/pusher.service";
import {
    PUSHER_CHANNELS,
    PUSHER_EVENTS,
} from "src/pusher/pusher.constants";
import {
    PusherNotificationData,
    PusherNotificationType,
} from "src/pusher/pusher.types";

import { EmailService } from "src/email/email.service";

// =====================================================
// Types
// =====================================================

type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

type PaginatedRequests = {
    data: ReturnType<RentalService["shapeRequest"]>[];
    meta: PaginationMeta;
};

// Statuses that count as an "active" rental request
const ACTIVE_REQUEST_STATUSES: RentalRequestStatus[] = [
    RentalRequestStatus.PENDING,
    RentalRequestStatus.NEGOTIATING,
    RentalRequestStatus.PRICE_AGREED,
    RentalRequestStatus.APPROVED,
];

// Policy defaults
const DEFAULT_PLATFORM_COMMISSION_RATE = 10;
const DEFAULT_DELIVERY_FEE = 0;

@Injectable()
export class RentalService {
    private readonly logger = new Logger(RentalService.name);

    constructor(
        @InjectRepository(RentalRequest)
        private readonly rentalRequestRepository: Repository<RentalRequest>,

        @InjectRepository(NegotiationOffer)
        private readonly negotiationOfferRepository: Repository<NegotiationOffer>,

        @InjectRepository(ActualRental)
        private readonly actualRentalRepository: Repository<ActualRental>,

        @InjectRepository(RentalStateHistory)
        private readonly rentalStateHistoryRepository: Repository<RentalStateHistory>,

        @InjectRepository(RentalPayment)
        private readonly rentalPaymentRepository: Repository<RentalPayment>,

        @InjectRepository(RentalCharge)
        private readonly rentalChargeRepository: Repository<RentalCharge>,

        @InjectRepository(RentalChargeEvent)
        private readonly rentalChargeEventRepository: Repository<RentalChargeEvent>,

        @InjectRepository(HandoverRiderAssignment)
        private readonly handoverRiderAssignmentRepository: Repository<HandoverRiderAssignment>,

        @InjectRepository(HandoverCheckpoint)
        private readonly handoverCheckpointRepository: Repository<HandoverCheckpoint>,

        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly pusherService: PusherService,
        private readonly emailService: EmailService,

        private readonly dataSource: DataSource,
    ) { }

    // =====================================================
    // ID GENERATION
    // =====================================================

    private generateId(prefix: string): string {
        const random = Math.random()
            .toString(36)
            .slice(2, 8);

        return `${prefix}-${Date.now()}-${random}`;
    }

    // =====================================================
    // SHAPING HELPERS
    // =====================================================

    private shapeUser(
        user?: User | null,
    ): {
        userId: string;
        name: string;
        email: string;
    } | undefined {
        if (!user) {
            return undefined;
        }

        return {
            userId: user.userId,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
        };
    }

    private shapeRider(
        rider?: User | null,
    ): {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
    } | null {
        if (!rider) {
            return null;
        }

        return {
            userId: rider.userId,
            firstName: rider.firstName,
            lastName: rider.lastName,
            email: rider.email,
            phone: rider.phone,
        };
    }

    private shapeRequest(
        request: RentalRequest,
        viewerId?: string,
        viewerRole?: UserRole,
    ) {
        const shaped = {
            ...request,
            product: request.product
                ? {
                    productId: request.product.productId,
                    name: request.product.name,
                    pricePerDay: request.product.pricePerDay,
                    negotiationAllowed:
                        request.product.negotiationAllowed,
                    location: request.product.location
                        ? {
                            pickupAddress:
                                request.product.location.pickupAddress,
                        }
                        : null,
                }
                : undefined,
            renter: this.shapeUser(request.renter),
            owner: this.shapeUser(request.owner),
            moderator: this.shapeUser(request.moderator),
            rider: this.shapeRider(request.rider),
        };

        const isStaff =
            viewerRole === UserRole.MODERATOR ||
            viewerRole === UserRole.ADMIN;

        if (isStaff) {
            return shaped;
        }

        if (viewerId === request.ownerId) {
            delete (shaped as Partial<typeof shaped>).deliveryFee;
            delete (shaped as Partial<typeof shaped>).renterRentalFee;
            delete (shaped as Partial<typeof shaped>).renterDeliveryFee;
            return shaped;
        }

        if (viewerId === request.renterId) {
            delete (shaped as Partial<typeof shaped>).ownerRentalFee;
            delete (shaped as Partial<typeof shaped>).ownerDeliveryFee;
            return shaped;
        }

        delete (shaped as Partial<typeof shaped>).ownerRentalFee;
        delete (shaped as Partial<typeof shaped>).ownerDeliveryFee;
        delete (shaped as Partial<typeof shaped>).renterRentalFee;
        delete (shaped as Partial<typeof shaped>).renterDeliveryFee;
        return shaped;
    }

    private buildPaginationMeta(
        page: number,
        limit: number,
        total: number,
    ): PaginationMeta {
        return {
            page,
            limit,
            total,
            totalPages:
                total > 0
                    ? Math.ceil(total / limit)
                    : 0,
        };
    }

    // =====================================================
    // NOTIFICATION HELPERS
    // =====================================================

    private buildNotification(
        type: PusherNotificationType,
        title: string,
        message: string,
        actor?: User | null,
        rentalId?: string | null,
        link?: string | null,
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
            rentalId: rentalId ?? null,
            link: link ?? null,
        };
    }

    /**
     * Fire-and-forget pusher notification.
     * A notification failure must never break
     * the business operation.
     */
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

    // =====================================================
    // ACCESS CHECK HELPERS
    // =====================================================

    private assertRequestParticipant(
        request: RentalRequest,
        userId: string,
        userRole: UserRole,
    ): void {
        const isParticipant =
            request.renterId === userId ||
            request.ownerId === userId;

        const isStaff =
            userRole === UserRole.MODERATOR ||
            userRole === UserRole.ADMIN;

        if (!isParticipant && !isStaff) {
            throw new ForbiddenException(
                "You are not allowed to view this rental request",
            );
        }
    }

    private isModeratorOrAdmin(role: UserRole): boolean {
        return (
            role === UserRole.MODERATOR ||
            role === UserRole.ADMIN
        );
    }

    private async hasRiderWorkedOnRental(
        rentalId: string,
        userId: string,
    ): Promise<boolean> {
        return Boolean(await this.handoverRiderAssignmentRepository.findOne({
            where: { rentalId, riderId: userId },
        }));
    }

    // =====================================================
    // DATE HELPERS
    // =====================================================

    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setUTCDate(result.getUTCDate() + days);
        return result;
    }

    private datesOverlap(
        startA: Date,
        endA: Date,
        startB: Date,
        endB: Date,
    ): boolean {
        return !(
            endA.getTime() < startB.getTime() ||
            startA.getTime() > endB.getTime()
        );
    }

    // =====================================================
    // CREATE RENTAL REQUEST
    // =====================================================

    async createRentalRequest(
        dto: CreateRentalRequestDto,
        renterId: string,
    ): Promise<RentalRequest> {

        // -------------------------------------------------
        // Product validation
        // -------------------------------------------------

        const product =
            await this.productRepository.findOne({
                where: { productId: dto.productId },
                relations: { location: true },
            });

        if (!product) {
            throw new NotFoundException(
                "Product not found",
            );
        }

        if (product.ownerId === renterId) {
            throw new BadRequestException(
                "You cannot rent your own product",
            );
        }

        if (
            product.availabilityStatus !==
            ProductAvailabilityStatus.AVAILABLE
        ) {
            throw new BadRequestException(
                "This product is currently not available",
            );
        }

        // -------------------------------------------------
        // Rental duration policy
        // -------------------------------------------------

        if (
            dto.rentalDays < product.minRentalDays ||
            dto.rentalDays > product.maxRentalDays
        ) {
            throw new BadRequestException(
                `Rental duration must be between ${product.minRentalDays} and ${product.maxRentalDays} days`,
            );
        }

        // -------------------------------------------------
        // Start date policy
        // -------------------------------------------------

        const startDate = new Date(dto.startDate);

        if (Number.isNaN(startDate.getTime())) {
            throw new BadRequestException(
                "Invalid start date",
            );
        }

        const startOfDay = new Date(
            Date.UTC(
                startDate.getUTCFullYear(),
                startDate.getUTCMonth(),
                startDate.getUTCDate(),
            ),
        );

        const today = new Date();
        const todayUtc = new Date(
            Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate(),
            ),
        );

        if (startOfDay.getTime() < todayUtc.getTime()) {
            throw new BadRequestException(
                "Start date cannot be in the past",
            );
        }

        if (
            !product.allowSameDayRental &&
            startOfDay.getTime() === todayUtc.getTime()
        ) {
            throw new BadRequestException(
                "Same-day rental is not allowed for this product",
            );
        }

        const endDate = this.addDays(
            startOfDay,
            dto.rentalDays,
        );

        // -------------------------------------------------
        // Offer / negotiation validation
        // -------------------------------------------------

        const listedPricePerDay = Number(
            product.pricePerDay,
        );

        if (dto.offeredPricePerDay !== undefined) {
            if (!product.negotiationAllowed) {
                throw new BadRequestException(
                    "Negotiation is not allowed for this product",
                );
            }

            if (dto.offeredPricePerDay > listedPricePerDay) {
                throw new BadRequestException(
                    "Offered price cannot be higher than the listed price",
                );
            }
        }

        // -------------------------------------------------
        // Duplicate active request guard
        // -------------------------------------------------

        const existingActiveRequest =
            await this.rentalRequestRepository.findOne({
                where: {
                    productId: dto.productId,
                    renterId,
                    status: In(ACTIVE_REQUEST_STATUSES),
                },
            });

        if (existingActiveRequest) {
            throw new ConflictException(
                "You already have an active rental request for this product",
            );
        }

        // -------------------------------------------------
        // Overlap guard:
        // product must not already be APPROVED
        // for an overlapping period.
        // -------------------------------------------------

        const overlappingApproved =
            await this.rentalRequestRepository
                .createQueryBuilder("request")
                .where("request.productId = :productId", {
                    productId: dto.productId,
                })
                .andWhere(
                    "request.status = :status",
                    { status: RentalRequestStatus.APPROVED },
                )
                .andWhere(
                    "request.startDate <= :newEnd AND request.endDate >= :newStart",
                    {
                        newStart: startOfDay,
                        newEnd: endDate,
                    },
                )
                .getOne();

        if (overlappingApproved) {
            throw new BadRequestException(
                "The product is already approved for rental during the selected dates",
            );
        }

        // -------------------------------------------------
        // Create request
        // -------------------------------------------------

        const pickupAddress =
            product.location?.pickupAddress ?? "";

        const negotiationAllowed =
            dto.offeredPricePerDay !== undefined &&
            product.negotiationAllowed &&
            dto.offeredPricePerDay < listedPricePerDay;

        const request = this.rentalRequestRepository.create({
            rentalRequestId:
                this.generateId("REQ"),
            productId: dto.productId,
            renterId,
            ownerId: product.ownerId,
            startDate: startOfDay,
            rentalDays: dto.rentalDays,
            endDate,
            pickupAddress,
            deliveryLatitude: dto.deliveryLatitude,
            deliveryLongitude: dto.deliveryLongitude,
            deliveryAddress: dto.deliveryAddress,
            contactPhone: dto.contactPhone,
            renterMessage: dto.renterMessage,
            listedPricePerDay:
                product.pricePerDay.toString(),
            offeredPricePerDay:
                dto.offeredPricePerDay !== undefined
                    ? dto.offeredPricePerDay.toFixed(2)
                    : undefined,
            status: negotiationAllowed
                ? RentalRequestStatus.NEGOTIATING
                : RentalRequestStatus.PENDING,
        });

        const savedRequest =
            await this.rentalRequestRepository.save(request);

        // -------------------------------------------------
        // Initial negotiation offer
        // (renter's opening offer)
        // -------------------------------------------------

        if (negotiationAllowed) {
            const offer =
                this.negotiationOfferRepository.create({
                    offerId:
                        this.generateId("OFF"),
                    rentalRequestId:
                        savedRequest.rentalRequestId,
                    senderId: renterId,
                    offeredPricePerDay:
                        dto.offeredPricePerDay!.toFixed(2),
                    message:
                        dto.renterMessage,
                    status:
                        NegotiationOfferStatus.PENDING,
                });

            await this.negotiationOfferRepository.save(
                offer,
            );
        }

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const renter =
            await this.userRepository.findOne({
                where: { userId: renterId },
            });

        const notification =
            this.buildNotification(
                PusherNotificationType.NEW_RENTAL_REQUEST,
                "New Rental Request",
                `A renter has requested to rent "${product.name}".`,
                renter,
                savedRequest.rentalRequestId,
                `/rentals/request/${savedRequest.rentalRequestId}`,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(product.ownerId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.NEW_RENTAL_REQUEST,
            notification,
        );

        return savedRequest;
    }

    // =====================================================
    // OWNER - LIST RENTAL REQUESTS
    // =====================================================

    async getOwnerRentalRequests(
        ownerId: string,
        pagination: PaginationDto,
    ): Promise<PaginatedRequests> {

        const [requests, total] =
            await this.rentalRequestRepository.findAndCount({
                where: { ownerId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
                order: { createdAt: "DESC" },
                skip: (pagination.page - 1) * pagination.limit,
                take: pagination.limit,
            });

        return {
            data: requests.map((request) =>
                this.shapeRequest(request, ownerId, UserRole.USER),
            ),
            meta: this.buildPaginationMeta(
                pagination.page,
                pagination.limit,
                total,
            ),
        };
    }

    // =====================================================
    // RENTER - LIST RENTAL REQUESTS
    // =====================================================

    async getRenterRentalRequests(
        renterId: string,
        pagination: PaginationDto,
    ): Promise<PaginatedRequests> {

        const [requests, total] =
            await this.rentalRequestRepository.findAndCount({
                where: { renterId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
                order: { createdAt: "DESC" },
                skip: (pagination.page - 1) * pagination.limit,
                take: pagination.limit,
            });

        return {
            data: requests.map((request) =>
                this.shapeRequest(request, renterId, UserRole.USER),
            ),
            meta: this.buildPaginationMeta(
                pagination.page,
                pagination.limit,
                total,
            ),
        };
    }

    // =====================================================
    // RENTER - ACTIVE REQUEST FOR PRODUCT
    // =====================================================

    async getRenterActiveRequestForProduct(
        productId: string,
        renterId: string,
    ): Promise<{
        exists: boolean;
        rentalRequestId: string | null;
        status: RentalRequestStatus | null;
    }> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: {
                    productId,
                    renterId,
                    status: In(ACTIVE_REQUEST_STATUSES),
                },
            });

        if (!request) {
            return {
                exists: false,
                rentalRequestId: null,
                status: null,
            };
        }

        return {
            exists: true,
            rentalRequestId: request.rentalRequestId,
            status: request.status,
        };
    }

    // =====================================================
    // GET RENTAL REQUEST BY ID
    // =====================================================

    async getRentalRequestById(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        this.assertRequestParticipant(
            request,
            userId,
            userRole,
        );

        return this.shapeRequest(request, userId, userRole);
    }

    // =====================================================
    // OWNER - ACCEPT / REJECT RENTAL REQUEST
    // =====================================================

    async updateRentalRequestStatus(
        rentalRequestId: string,
        ownerId: string,
        action: OwnerRentalRequestAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        if (request.ownerId !== ownerId) {
            throw new ForbiddenException(
                "Only the product owner can respond to this request",
            );
        }

        if (
            request.status !== RentalRequestStatus.PENDING &&
            request.status !== RentalRequestStatus.NEGOTIATING
        ) {
            throw new BadRequestException(
                "This request cannot be updated anymore",
            );
        }

        const owner =
            await this.userRepository.findOne({
                where: { userId: ownerId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        if (action === OwnerRentalRequestAction.ACCEPT) {
            request.status =
                RentalRequestStatus.PRICE_AGREED;

            request.agreedPricePerDay =
                request.offeredPricePerDay ??
                request.listedPricePerDay;

            // Any open offers are settled by
            // the direct acceptance.
            await this.negotiationOfferRepository.update(
                {
                    rentalRequestId,
                    status:
                        NegotiationOfferStatus.PENDING,
                },
                { status: NegotiationOfferStatus.REJECTED },
            );
        } else {
            request.status = RentalRequestStatus.REJECTED;

            await this.negotiationOfferRepository.update(
                {
                    rentalRequestId,
                    status:
                        NegotiationOfferStatus.PENDING,
                },
                { status: NegotiationOfferStatus.REJECTED },
            );
        }

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        const isAccepted =
            action === OwnerRentalRequestAction.ACCEPT;

        // -------------------------------------------------
        // Auto-cancel other active requests for the same
        // product. An owner can only accept one request
        // per product; every other open request from any
        // other renter is rejected automatically.
        // -------------------------------------------------

        if (isAccepted) {
            await this.cancelOtherRequestsForProduct(
                request.productId,
                request.rentalRequestId,
                product?.name ?? "the product",
                owner,
            );
        }

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const notification =
            this.buildNotification(
                isAccepted
                    ? PusherNotificationType.RENTAL_REQUEST_ACCEPTED
                    : PusherNotificationType.RENTAL_REQUEST_REJECTED,
                isAccepted
                    ? "Rental Request Accepted"
                    : "Rental Request Rejected",
                `The owner of "${product?.name ?? "the product"}" has ${isAccepted ? "accepted" : "rejected"} your rental request.`,
                owner,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.RENTER(request.renterId),
            ],
            isAccepted
                ? PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED
                : PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
            notification,
        );

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            ownerId,
            UserRole.USER,
        );
    }

    // =====================================================
    // OWNER / RENTER - REJECT AFTER MODERATOR APPROVAL
    // Either party can reject an APPROVED request before
    // the moderator assigns a rider.
    // =====================================================

    async rejectAfterApproval(
        rentalRequestId: string,
        userId: string,
        action: OwnerRentalRequestAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        if (action !== OwnerRentalRequestAction.REJECT) {
            throw new BadRequestException(
                "Only rejection is allowed after moderator approval",
            );
        }

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        // Only the owner or the renter can reject
        if (
            request.ownerId !== userId &&
            request.renterId !== userId
        ) {
            throw new ForbiddenException(
                "Only the owner or the renter can reject this request",
            );
        }

        if (request.status !== RentalRequestStatus.APPROVED) {
            throw new BadRequestException(
                "Only approved requests can be rejected after moderator approval",
            );
        }

        // Cannot reject if a rider is already assigned
        if (request.riderId) {
            throw new BadRequestException(
                "Cannot reject: a rider has already been assigned to this rental",
            );
        }

        request.status = RentalRequestStatus.REJECTED;

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        const user =
            await this.userRepository.findOne({
                where: { userId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        const counterpartyId =
            request.ownerId === userId
                ? request.renterId
                : request.ownerId;

        const counterparty =
            await this.userRepository.findOne({
                where: { userId: counterpartyId },
            });

        const actorName =
            user
                ? `${user.firstName} ${user.lastName}`.trim()
                : "A party";

        const counterpartyName =
            counterparty
                ? `${counterparty.firstName} ${counterparty.lastName}`.trim()
                : "";

        // Notify both parties
        const notification =
            this.buildNotification(
                PusherNotificationType.RENTAL_REQUEST_REJECTED,
                "Rental Request Rejected",
                `${actorName} (${user?.role}) rejected the approved rental for "${product?.name ?? "the product"}".`,
                user,
                request.rentalRequestId,
                `/rentals/request/${request.rentalRequestId}`,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
            notification,
        );

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            userId,
            UserRole.USER,
        );
    }

    // =====================================================
    // OWNER - ACCEPT / REJECT PROPOSED CHARGES
    // Owner accepts or rejects moderator's proposed
    // charges. When both parties accept, status becomes
    // APPROVED and moderator is notified to assign rider.
    // =====================================================

    async ownerAcceptCharges(
        rentalRequestId: string,
        ownerId: string,
        action: ChargesAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        return this.handleChargeAcceptance(
            rentalRequestId,
            ownerId,
            action,
            "owner",
        );
    }

    // =====================================================
    // RENTER - ACCEPT / REJECT PROPOSED CHARGES
    // Renter accepts or rejects moderator's proposed
    // charges. When both parties accept, status becomes
    // APPROVED and moderator is notified to assign rider.
    // =====================================================

    async renterAcceptCharges(
        rentalRequestId: string,
        renterId: string,
        action: ChargesAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        return this.handleChargeAcceptance(
            rentalRequestId,
            renterId,
            action,
            "renter",
        );
    }

    // =====================================================
    // INTERNAL - HANDLE CHARGE ACCEPTANCE
    // =====================================================

    private async handleChargeAcceptance(
        rentalRequestId: string,
        userId: string,
        action: ChargesAction,
        party: "owner" | "renter",
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        // Only CHARGES_PROPOSED requests can be accepted/rejected
        if (request.status !== RentalRequestStatus.CHARGES_PROPOSED) {
            throw new BadRequestException(
                "Charges are not proposed for this request yet",
            );
        }

        // Verify the caller is the correct party
        if (
            party === "owner" &&
            request.ownerId !== userId
        ) {
            throw new ForbiddenException(
                "Only the owner can accept or reject these charges",
            );
        }

        if (
            party === "renter" &&
            request.renterId !== userId
        ) {
            throw new ForbiddenException(
                "Only the renter can accept or reject these charges",
            );
        }

        const user =
            await this.userRepository.findOne({
                where: { userId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        const counterpartyId =
            party === "owner"
                ? request.renterId
                : request.ownerId;

        const counterparty =
            await this.userRepository.findOne({
                where: { userId: counterpartyId },
            });

        if (action === ChargesAction.ACCEPT) {
            // Mark this party's acceptance
            if (party === "owner") {
                request.ownerChargesAccepted = true;
            } else {
                request.renterChargesAccepted = true;
            }

            // If both parties accepted, set status to APPROVED
            if (
                request.ownerChargesAccepted &&
                request.renterChargesAccepted
            ) {
                request.status = RentalRequestStatus.APPROVED;

                // Notify moderator that both parties accepted charges
                const moderator =
                    request.moderatorId
                        ? await this.userRepository.findOne({
                            where: { userId: request.moderatorId },
                        })
                        : null;

                const bothAcceptedNotification =
                    this.buildNotification(
                        PusherNotificationType.NEW_RENTAL_REQUEST,
                        "Charges Accepted by Both Parties",
                        `Both owner and renter accepted the proposed charges for "${product?.name ?? "the product"}". Please assign a rider.`,
                        user,
                        request.rentalRequestId,
                        `/rentals/request/${request.rentalRequestId}`,
                    );

                await this.notify(
                    [
                        PUSHER_CHANNELS.ADMIN_MODERATOR,
                    ],
                    PUSHER_EVENTS.NEW_RENTAL_REQUEST,
                    bothAcceptedNotification,
                );

                // Notify both parties
                const acceptedNotification =
                    this.buildNotification(
                        PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                        "Charges Accepted",
                        `Both parties accepted the charges. The moderator will now assign a rider.`,
                        user,
                        request.rentalRequestId,
                        `/rentals/request/${request.rentalRequestId}`,
                    );

                await this.notify(
                    [
                        PUSHER_CHANNELS.OWNER(request.ownerId),
                        PUSHER_CHANNELS.RENTER(request.renterId),
                    ],
                    PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                    acceptedNotification,
                );
            } else {
                // Only one party accepted — notify the other party
                const oneAcceptedNotification =
                    this.buildNotification(
                        PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                        `${party === "owner" ? "Owner" : "Renter"} Accepted Charges`,
                        `${user?.firstName ?? "A party"} accepted the proposed charges. Waiting for the other party to accept.`,
                        user,
                        request.rentalRequestId,
                        `/rentals/request/${request.rentalRequestId}`,
                    );

                await this.notify(
                    [
                        party === "owner"
                            ? PUSHER_CHANNELS.RENTER(request.renterId)
                            : PUSHER_CHANNELS.OWNER(request.ownerId),
                    ],
                    PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                    oneAcceptedNotification,
                );
            }
        } else {
            // REJECT — reset acceptance flags and set status to REJECTED
            request.ownerChargesAccepted = false;
            request.renterChargesAccepted = false;
            request.status = RentalRequestStatus.REJECTED;

            // Notify both parties and moderator
            const rejectedNotification =
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_REJECTED,
                    "Charges Rejected",
                    `${user?.firstName ?? "A party"} rejected the proposed charges for "${product?.name ?? "the product"}".`,
                    user,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                );

            await this.notify(
                [
                    PUSHER_CHANNELS.OWNER(request.ownerId),
                    PUSHER_CHANNELS.RENTER(request.renterId),
                    PUSHER_CHANNELS.ADMIN_MODERATOR,
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                rejectedNotification,
            );
        }

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            userId,
            UserRole.USER,
        );
    }

    // =====================================================
    // RENTER - CONFIRM / REJECT AFTER OWNER ACCEPTANCE
    // Renter confirms the agreed terms before moderator
    // assigns a rider. Both parties must confirm.
    // =====================================================

    async renterRentalRequestAction(
        rentalRequestId: string,
        renterId: string,
        action: RenterRentalRequestAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        // Only the renter can confirm/reject
        if (request.renterId !== renterId) {
            throw new ForbiddenException(
                "Only the renter can confirm or reject this request",
            );
        }

        // Request must be PRICE_AGREED (owner already accepted)
        if (request.status !== RentalRequestStatus.PRICE_AGREED) {
            throw new BadRequestException(
                "This request is not in price-agreed state. Owner must accept first.",
            );
        }

        const renter =
            await this.userRepository.findOne({
                where: { userId: renterId },
            });

        const owner =
            await this.userRepository.findOne({
                where: { userId: request.ownerId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        if (action === RenterRentalRequestAction.CONFIRM) {
            request.status = RentalRequestStatus.RENTAL_CONFIRMED;

            // -------------------------------------------------
            // Notify moderator that both parties confirmed
            // and rider assignment is needed
            // -------------------------------------------------

            const moderatorNotification =
                this.buildNotification(
                    PusherNotificationType.NEW_RENTAL_REQUEST,
                    "Rental Ready for Rider Assignment",
                    `Both owner and renter confirmed "${product?.name ?? "the product"}". Please assign a rider.`,
                    renter,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                );

            await this.notify(
                [
                    PUSHER_CHANNELS.ADMIN_MODERATOR,
                ],
                PUSHER_EVENTS.NEW_RENTAL_REQUEST,
                moderatorNotification,
            );

            // Notify owner that renter confirmed
            const ownerNotification =
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                    "Renter Confirmed",
                    `The renter confirmed your rental request for "${product?.name ?? "the product"}". Waiting for moderator to assign a rider.`,
                    renter,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                );

            await this.notify(
                [
                    PUSHER_CHANNELS.OWNER(request.ownerId),
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                ownerNotification,
            );

        } else {
            // REJECT
            request.status = RentalRequestStatus.REJECTED;

            // Notify both parties
            const notification =
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_REJECTED,
                    "Rental Request Rejected",
                    `The renter rejected the agreed terms for "${product?.name ?? "the product"}".`,
                    renter,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                );

            await this.notify(
                [
                    PUSHER_CHANNELS.OWNER(request.ownerId),
                    PUSHER_CHANNELS.RENTER(request.renterId),
                    PUSHER_CHANNELS.ADMIN_MODERATOR,
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                notification,
            );
        }

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            renterId,
            UserRole.USER,
        );
    }

    // =====================================================
    // AUTO-CANCEL OTHER ACTIVE REQUESTS FOR PRODUCT
    // Rejects every open request for the same product
    // except the accepted one, and notifies those renters.
    // =====================================================

    private async cancelOtherRequestsForProduct(
        productId: string,
        acceptedRentalRequestId: string,
        productName: string,
        owner: User | null,
    ): Promise<void> {

        /*
         * Fetch all open requests for the product and
         * filter out the accepted one in memory.
         */

        const allOpen =
            await this.rentalRequestRepository.find({
                where: {
                    productId,
                    status:
                        ACTIVE_REQUEST_STATUSES as unknown as RentalRequestStatus,
                },
                relations: { renter: true },
            });

        const toCancel =
            allOpen.filter(
                (req) =>
                    req.rentalRequestId !==
                    acceptedRentalRequestId,
            );

        if (toCancel.length === 0) {
            return;
        }

        for (const req of toCancel) {
            req.status = RentalRequestStatus.REJECTED;

            await this.negotiationOfferRepository.update(
                {
                    rentalRequestId:
                        req.rentalRequestId,
                    status:
                        NegotiationOfferStatus.PENDING,
                },
                { status: NegotiationOfferStatus.REJECTED },
            );

            await this.rentalRequestRepository.save(req);
        }

        // -------------------------------------------------
        // Notify each affected renter
        // -------------------------------------------------

        for (const req of toCancel) {
            const renter =
                await this.userRepository.findOne({
                    where: { userId: req.renterId },
                });

            if (!renter) {
                continue;
            }

            const notification =
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_REJECTED,
                    "Rental Request Cancelled",
                    `The owner accepted another rental request for "${productName}", so your request for that product has been automatically cancelled.`,
                    owner,
                    req.rentalRequestId,
                    `/rentals/request/${req.rentalRequestId}`,
                );

            await this.notify(
                [
                    PUSHER_CHANNELS.RENTER(req.renterId),
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                notification,
            );
        }
    }

    // =====================================================
    // NEGOTIATION - CREATE OFFER
    // =====================================================

    async createNegotiationOffer(
        dto: CreateNegotiationOfferDto,
        senderId: string,
    ): Promise<NegotiationOffer> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: {
                    rentalRequestId: dto.rentalRequestId,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        const isParticipant =
            request.renterId === senderId ||
            request.ownerId === senderId;

        if (!isParticipant) {
            throw new ForbiddenException(
                "Only the renter or the owner can negotiate",
            );
        }

        if (
            request.status === RentalRequestStatus.APPROVED ||
            request.status === RentalRequestStatus.REJECTED ||
            request.status === RentalRequestStatus.PRICE_AGREED ||
            request.status === RentalRequestStatus.EXPIRED
        ) {
            throw new BadRequestException(
                "Negotiation is closed for this request",
            );
        }

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        if (!product) {
            throw new NotFoundException("Product not found");
        }

        if (!product.negotiationAllowed) {
            throw new BadRequestException(
                "Negotiation is not allowed for this product",
            );
        }

        // -------------------------------------------------
        // Turn-based rule:
        // sender cannot send consecutive offers.
        // -------------------------------------------------

        const latestOffer =
            await this.negotiationOfferRepository.findOne({
                where: { rentalRequestId: request.rentalRequestId },
                order: { createdAt: "DESC" },
            });

        if (
            latestOffer &&
            latestOffer.senderId === senderId
        ) {
            throw new BadRequestException(
                "Please wait for the other party to respond before sending another offer",
            );
        }

        // -------------------------------------------------
        // Supersede any open offer.
        // -------------------------------------------------

        await this.negotiationOfferRepository.update(
            {
                rentalRequestId: request.rentalRequestId,
                status: NegotiationOfferStatus.PENDING,
            },
            { status: NegotiationOfferStatus.REJECTED },
        );

        const offer =
            this.negotiationOfferRepository.create({
                offerId: this.generateId("OFF"),
                rentalRequestId: request.rentalRequestId,
                senderId,
                offeredPricePerDay:
                    dto.offeredPricePerDay.toFixed(2),
                message: dto.message,
                status: NegotiationOfferStatus.PENDING,
            });

        const savedOffer =
            await this.negotiationOfferRepository.save(offer);

        // -------------------------------------------------
        // Request enters NEGOTIATING
        // -------------------------------------------------

        if (
            request.status !== RentalRequestStatus.NEGOTIATING
        ) {
            request.status =
                RentalRequestStatus.NEGOTIATING;

            await this.rentalRequestRepository.save(request);
        }

        // -------------------------------------------------
        // Notification to the counterparty
        // -------------------------------------------------

        const sender =
            await this.userRepository.findOne({
                where: { userId: senderId },
            });

        const counterpartyId =
            request.renterId === senderId
                ? request.ownerId
                : request.renterId;

        const notification =
            this.buildNotification(
                PusherNotificationType.NEGOTIATION_OFFER,
                "New Negotiation Offer",
                `A new price offer of ${dto.offeredPricePerDay.toFixed(2)} was made for "${product?.name ?? "the product"}".`,
                sender,
            );

        await this.notify(
            [
                request.renterId === counterpartyId
                    ? PUSHER_CHANNELS.RENTER(counterpartyId)
                    : PUSHER_CHANNELS.OWNER(counterpartyId),
            ],
            PUSHER_EVENTS.NEW_NEGOTIATION_OFFER,
            notification,
        );

        return savedOffer;
    }

    // =====================================================
    // NEGOTIATION - HISTORY
    // =====================================================

    async getNegotiationHistory(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<
        {
            offerId: string;
            rentalRequestId: string;
            senderId: string;
            offeredPricePerDay: string;
            message?: string;
            status: NegotiationOfferStatus;
            createdAt: Date;
            sender?: {
                userId: string;
                name: string;
                email: string;
            };
        }[]
    > {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        this.assertRequestParticipant(
            request,
            userId,
            userRole,
        );

        const offers =
            await this.negotiationOfferRepository.find({
                where: { rentalRequestId },
                relations: { sender: true },
                order: { createdAt: "ASC" },
            });

        return offers.map((offer) => ({
            offerId: offer.offerId,
            rentalRequestId: offer.rentalRequestId,
            senderId: offer.senderId,
            offeredPricePerDay: offer.offeredPricePerDay,
            message: offer.message,
            status: offer.status,
            createdAt: offer.createdAt,
            sender: this.shapeUser(offer.sender),
        }));
    }

    // =====================================================
    // NEGOTIATION - ACCEPT / REJECT OFFER
    // =====================================================

    async updateNegotiationOffer(
        offerId: string,
        responderId: string,
        action: NegotiationOfferAction,
    ): Promise<NegotiationOffer> {

        const offer =
            await this.negotiationOfferRepository.findOne({
                where: { offerId },
            });

        if (!offer) {
            throw new NotFoundException(
                "Negotiation offer not found",
            );
        }

        const request =
            await this.rentalRequestRepository.findOne({
                where: {
                    rentalRequestId: offer.rentalRequestId,
                },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        if (!product) {
            throw new NotFoundException("Product not found");
        }

        if (!product.negotiationAllowed) {
            throw new BadRequestException(
                "Negotiation is not allowed for this product",
            );
        }

        // Responder must be the counterparty
        const isCounterparty =
            (request.renterId === responderId ||
                request.ownerId === responderId) &&
            offer.senderId !== responderId;

        if (!isCounterparty) {
            throw new ForbiddenException(
                "Only the counterparty can respond to this offer",
            );
        }

        if (offer.status !== NegotiationOfferStatus.PENDING) {
            throw new BadRequestException(
                "This offer has already been resolved",
            );
        }

        if (
            request.status === RentalRequestStatus.APPROVED ||
            request.status === RentalRequestStatus.REJECTED ||
            request.status === RentalRequestStatus.PRICE_AGREED
        ) {
            throw new BadRequestException(
                "Negotiation is closed for this request",
            );
        }

        const responder =
            await this.userRepository.findOne({
                where: { userId: responderId },
            });

        if (action === NegotiationOfferAction.ACCEPT) {
            offer.status =
                NegotiationOfferStatus.ACCEPTED;

            await this.negotiationOfferRepository.save(offer);

            // Settle remaining open offers
            await this.negotiationOfferRepository.update(
                {
                    rentalRequestId:
                        request.rentalRequestId,
                    status:
                        NegotiationOfferStatus.PENDING,
                },
                {
                    status:
                        NegotiationOfferStatus.REJECTED,
                },
            );

            request.status =
                RentalRequestStatus.PRICE_AGREED;

            request.agreedPricePerDay =
                offer.offeredPricePerDay;

            await this.rentalRequestRepository.save(request);

            // -------------------------------------------------
            // Notification to the offer sender
            // -------------------------------------------------

            const notification =
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                    "Offer Accepted",
                    `Your offer of ${offer.offeredPricePerDay} for "${product?.name ?? "the product"}" was accepted. The request is now waiting for moderator review.`,
                    responder,
                );

            await this.notify(
                [
                    request.renterId === offer.senderId
                        ? PUSHER_CHANNELS.RENTER(offer.senderId)
                        : PUSHER_CHANNELS.OWNER(offer.senderId),
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                notification,
            );
        } else {
            offer.status =
                NegotiationOfferStatus.REJECTED;

            await this.negotiationOfferRepository.save(offer);

            // -------------------------------------------------
            // Notification to the offer sender
            // -------------------------------------------------

            const notification =
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_REJECTED,
                    "Offer Rejected",
                    `Your offer of ${offer.offeredPricePerDay} for "${product?.name ?? "the product"}" was rejected. You may send a new offer.`,
                    responder,
                );

            await this.notify(
                [
                    request.renterId === offer.senderId
                        ? PUSHER_CHANNELS.RENTER(offer.senderId)
                        : PUSHER_CHANNELS.OWNER(offer.senderId),
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                notification,
            );
        }

        return offer;
    }

    // =====================================================
    // MODERATOR - PRICE AGREED REVIEW QUEUE
    // =====================================================

    async getModeratorRentalRequests(
        pagination: PaginationDto,
    ): Promise<PaginatedRequests> {

        const [requests, total] =
            await this.rentalRequestRepository.findAndCount({
                where: {
                    status:
                        RentalRequestStatus.PRICE_AGREED,
                },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
                order: { createdAt: "ASC" },
                skip:
                    (pagination.page - 1) * pagination.limit,
                take: pagination.limit,
            });

        return {
            data: requests.map((request) =>
                this.shapeRequest(request, undefined, UserRole.MODERATOR),
            ),
            meta: this.buildPaginationMeta(
                pagination.page,
                pagination.limit,
                total,
            ),
        };
    }

    // =====================================================
    // MODERATOR - DASHBOARD STATS
    // =====================================================

    async getModeratorDashboardStats(): Promise<{
        totalRentals: number;
        activeRentals: number;
        pendingHandoverRentals: number;
        completedRentals: number;
        pendingReviews: number;
    }> {

        const [
            totalRentals,
            activeRentals,
            pendingHandoverRentals,
            completedRentals,
            pendingReviews,
        ] = await Promise.all([
            this.actualRentalRepository.count(),
            this.actualRentalRepository.count({
                where: { status: ActualRentalStatus.ACTIVE },
            }),
            this.actualRentalRepository.count({
                where: { status: ActualRentalStatus.PENDING_HANDOVER },
            }),
            this.actualRentalRepository.count({
                where: { status: ActualRentalStatus.COMPLETED },
            }),
            this.rentalRequestRepository.count({
                where: { status: RentalRequestStatus.PRICE_AGREED },
            }),
        ]);

        return {
            totalRentals,
            activeRentals,
            pendingHandoverRentals,
            completedRentals,
            pendingReviews,
        };
    }

    // =====================================================
    // MODERATOR - CLEANUP COMPLETED RENTALS (30 DAYS)
    // Permanently deletes completed rentals older than 30 days.
    // =====================================================

    async cleanupCompletedRentals(): Promise<{
        deletedRentals: number;
        cutoffDate: Date;
    }> {

        const cutoffDate = new Date();
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30);

        // Find completed rentals older than 30 days
        const oldRentals =
            await this.actualRentalRepository.find({
                where: {
                    status: ActualRentalStatus.COMPLETED,
                    updatedAt: {
                        // TypeORM uses moreThan/lessThan operators
                    } as any,
                },
            });

        // Filter in-memory for precise date comparison
        const toDelete = oldRentals.filter(
            (rental) =>
                rental.updatedAt.getTime() < cutoffDate.getTime(),
        );

        if (toDelete.length === 0) {
            return {
                deletedRentals: 0,
                cutoffDate,
            };
        }

        const rentalIds = toDelete.map((r) => r.rentalId);
        const rentalRequestIds = toDelete.map(
            (r) => r.rentalRequestId,
        );

        const queryRunner =
            this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Delete related records in dependency order
            // 1. Checkpoint media
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(CheckpointMedia)
                .where("checkpointId IN (SELECT checkpointId FROM handover_checkpoints WHERE rentalId IN (:...rentalIds))", {
                    rentalIds,
                })
                .execute();

            // 2. Handover checkpoints
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(HandoverCheckpoint)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            // 3. Handover OTPs
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(HandoverOtp)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            // 4. Rental state history
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(RentalStateHistory)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            // 5. Rental payments
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(RentalPayment)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            // 6. Actual rentals
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(ActualRental)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            // 7. Rental requests
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(RentalRequest)
                .where("rentalRequestId IN (:...rentalRequestIds)", {
                    rentalRequestIds,
                })
                .execute();

            await queryRunner.commitTransaction();

            return {
                deletedRentals: toDelete.length,
                cutoffDate,
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // =====================================================
    // MODERATOR - APPROVE / REJECT REQUEST
    // =====================================================

    async reviewRentalRequest(
        rentalRequestId: string,
        moderatorId: string,
        dto: ReviewRentalRequestDto,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        if (
            request.status !== RentalRequestStatus.RENTAL_CONFIRMED
        ) {
            throw new BadRequestException(
                "Only confirmed requests (owner accepted + renter confirmed) can be reviewed by moderator",
            );
        }

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        // -------------------------------------------------
        // Rider validation (APPROVE only)
        // -------------------------------------------------

        let rider: User | null = null;

        if (
            dto.action ===
            ModeratorRentalRequestAction.APPROVE &&
            !dto.riderId
        ) {
            throw new BadRequestException(
                "Assign a rider for the owner pickup before approving this rental",
            );
        }

        if (
            dto.action ===
            ModeratorRentalRequestAction.APPROVE &&
            dto.riderId
        ) {
            rider = await this.userRepository.findOne({
                where: { userId: dto.riderId },
            });

            if (
                !rider ||
                rider.role !== UserRole.RIDER
            ) {
                throw new BadRequestException(
                    "Selected rider is invalid",
                );
            }
        }

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        if (dto.action === ModeratorRentalRequestAction.APPROVE) {

            const partyCharges = [
                dto.ownerRentalFee,
                dto.ownerDeliveryFee,
                dto.renterRentalFee,
                dto.renterDeliveryFee,
            ];

            if (partyCharges.some((amount) => amount === undefined)) {
                throw new BadRequestException(
                    "Set rental and delivery charges separately for both owner and renter",
                );
            }

            // -------------------------------------------------
            // §22 overlap rule:
            // in-transaction final check before APPROVED.
            // -------------------------------------------------

            const overlapping =
                await this.rentalRequestRepository
                    .createQueryBuilder("request")
                    .where(
                        "request.productId = :productId",
                        { productId: request.productId },
                    )
                    .andWhere(
                        "request.status = :status",
                        {
                            status:
                                RentalRequestStatus.APPROVED,
                        },
                    )
                    .andWhere(
                        "request.rentalRequestId != :self",
                        { self: rentalRequestId },
                    )
                    .andWhere(
                        "request.startDate <= :selfEnd AND request.endDate >= :selfStart",
                        {
                            selfStart: request.startDate,
                            selfEnd: request.endDate,
                        },
                    )
                    .getOne();

            if (overlapping) {
                throw new BadRequestException(
                    "Cannot approve: the product is already approved for an overlapping rental period",
                );
            }

            request.status =
                RentalRequestStatus.CHARGES_PROPOSED;

            request.ownerRentalFee = dto.ownerRentalFee!.toFixed(2);
            request.ownerDeliveryFee = dto.ownerDeliveryFee!.toFixed(2);
            request.renterRentalFee = dto.renterRentalFee!.toFixed(2);
            request.renterDeliveryFee = dto.renterDeliveryFee!.toFixed(2);

            // Keep the legacy delivery field aligned with the renter's
            // delivery charge while existing payment clients are migrated.
            request.deliveryFee = dto.renterDeliveryFee!.toFixed(2);

            request.platformCommissionRate =
                (
                    dto.platformCommissionRate ??
                    DEFAULT_PLATFORM_COMMISSION_RATE
                ).toFixed(2);

            // Reset charge acceptance flags — both parties must accept
            request.ownerChargesAccepted = false;
            request.renterChargesAccepted = false;

            request.riderId = dto.riderId ?? null;
        } else {
            request.status = RentalRequestStatus.REJECTED;
        }

        request.moderatorId = moderatorId;
        request.reviewedAt = new Date();

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        // -------------------------------------------------
        // Emails to renter + owner
        // -------------------------------------------------

        const renter =
            await this.userRepository.findOne({
                where: { userId: request.renterId },
            });

        const owner =
            await this.userRepository.findOne({
                where: { userId: request.ownerId },
            });

        const agreedPricePerDay = Number(
            request.agreedPricePerDay ?? request.listedPricePerDay,
        );

        const rentalAmount =
            agreedPricePerDay * request.rentalDays;

        const emailDetails = {
            rentalRequestId: request.rentalRequestId,
            productName: product?.name ?? "the product",
            decision:
                dto.action ===
                    ModeratorRentalRequestAction.APPROVE
                    ? ("APPROVED" as const)
                    : ("REJECTED" as const),
            startDate: request.startDate,
            endDate: request.endDate,
            agreedPricePerDay,
            rentalDays: request.rentalDays,
            rentalAmount,
            ownerRentalFee: dto.ownerRentalFee ?? 0,
            ownerDeliveryFee: dto.ownerDeliveryFee ?? 0,
            renterRentalFee: dto.renterRentalFee ?? 0,
            renterDeliveryFee: dto.renterDeliveryFee ?? DEFAULT_DELIVERY_FEE,
            platformCommissionRate:
                dto.platformCommissionRate ??
                DEFAULT_PLATFORM_COMMISSION_RATE,
            riderName: rider
                ? `${rider.firstName} ${rider.lastName}`.trim()
                : null,
            riderEmail: rider?.email ?? null,
        };

        const renterEmailDetails = {
            ...emailDetails,
            partyRole: "RENTER" as const,
            partyRentalFee: dto.renterRentalFee ?? null,
            partyDeliveryFee: dto.renterDeliveryFee ?? null,
        };

        const ownerEmailDetails = {
            ...emailDetails,
            partyRole: "OWNER" as const,
            partyRentalFee: dto.ownerRentalFee ?? null,
            partyDeliveryFee: dto.ownerDeliveryFee ?? null,
        };

        if (renter) {
            try {
                await this.emailService.rentalRequestReviewed(
                    renter.email,
                    renter.firstName,
                    renterEmailDetails,
                );
            } catch {
                // Email failure must not break the flow.
            }
        }

        if (owner) {
            try {
                await this.emailService.rentalRequestReviewed(
                    owner.email,
                    owner.firstName,
                    ownerEmailDetails,
                );
            } catch {
                // Email failure must not break the flow.
            }
        }

        // -------------------------------------------------
        // Rider assignment email
        // -------------------------------------------------

        if (
            dto.action ===
            ModeratorRentalRequestAction.APPROVE &&
            rider
        ) {
            try {
                await this.emailService.riderAssignmentNotification(
                    rider.email,
                    rider.firstName,
                    {
                        rentalRequestId:
                            request.rentalRequestId,
                        productName:
                            product?.name ?? "the product",
                        pickupAddress:
                            request.pickupAddress,
                        deliveryAddress:
                            request.deliveryAddress,
                    },
                );
            } catch {
                // Email failure must not break the flow.
            }

            await this.notify(
                [
                    `rider-${rider.userId}-channel`,
                ],
                PUSHER_EVENTS.HANDOVER_VERIFICATION,
                this.buildNotification(
                    PusherNotificationType.NEW_RENTAL_REQUEST,
                    "Rider Assignment",
                    `You have been assigned to deliver "${product?.name ?? "the product"}".`,
                    moderator,
                ),
            );
        }

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const isApproved =
            dto.action ===
            ModeratorRentalRequestAction.APPROVE;

        const notification =
            this.buildNotification(
                isApproved
                    ? PusherNotificationType.RENTAL_REQUEST_ACCEPTED
                    : PusherNotificationType.RENTAL_REQUEST_REJECTED,
                isApproved
                    ? "Charges Proposed"
                    : "Rental Request Rejected",
                isApproved
                    ? `The moderator has proposed charges for "${product?.name ?? "the product"}". Please review and accept the rental fee, delivery charge, and platform commission.`
                    : `The moderator has ${isApproved ? "approved" : "rejected"} the rental request for "${product?.name ?? "the product"}".`,
                moderator,
                request.rentalRequestId,
                `/rentals/request/${request.rentalRequestId}`,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.OWNER(request.ownerId),
            ],
            isApproved
                ? PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED
                : PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
            notification,
        );

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            moderatorId,
            UserRole.MODERATOR,
        );
    }

    // =====================================================
    // MODERATOR - PICKUP CONDITION REVIEW
    // =====================================================

    async reviewRentalRequestPickup(
        rentalRequestId: string,
        moderatorId: string,
        dto: ModeratorPickupReviewDto,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        if (
            request.status !== RentalRequestStatus.APPROVED
        ) {
            throw new BadRequestException(
                "Pickup review is only available for approved requests",
            );
        }

        request.pickupConditionApproved =
            dto.pickupConditionApproved === true;

        request.pickupReviewNote = dto.pickupReviewNote;
        request.moderatorPickupReviewedAt = new Date();
        request.moderatorId = moderatorId;

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        const approved =
            dto.pickupConditionApproved === true;

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                approved
                    ? "Pickup Condition Verified"
                    : "Pickup Issue Reported",
                approved
                    ? `The moderator verified the pickup condition of "${product?.name ?? "the product"}".`
                    : `The moderator reported an issue with the pickup condition of "${product?.name ?? "the product"}".`,
                moderator,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.HANDOVER_VERIFICATION,
            notification,
        );

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            moderatorId,
            UserRole.MODERATOR,
        );
    }

    // =====================================================
    // MODERATOR - RETURN CONDITION REVIEW
    // =====================================================

    async reviewRentalRequestReturn(
        rentalRequestId: string,
        moderatorId: string,
        dto: ModeratorReturnReviewDto,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        if (
            request.status !== RentalRequestStatus.APPROVED
        ) {
            throw new BadRequestException(
                "Return review is only available for approved requests",
            );
        }

        request.returnConditionApproved =
            dto.returnConditionApproved === true;

        request.returnReviewNote = dto.returnReviewNote;
        request.moderatorReturnReviewedAt = new Date();
        request.moderatorId = moderatorId;

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        const approved =
            dto.returnConditionApproved === true;

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                approved
                    ? "Return Condition Verified"
                    : "Return Issue Reported",
                approved
                    ? `The moderator verified the returned condition of "${product?.name ?? "the product"}".`
                    : `The moderator reported damage or an issue with the returned condition of "${product?.name ?? "the product"}".`,
                moderator,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.RETURN_VERIFICATION,
            notification,
        );

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: {
                    product: { location: true },
                    renter: true,
                    owner: true,
                    moderator: true,
                    rider: true,
                },
            }) ?? updatedRequest,
            moderatorId,
            UserRole.MODERATOR,
        );
    }

    // =====================================================
    // MODERATOR - CREATE ACTUAL RENTAL (PHASE 11)
    // =====================================================

    async createActualRental(
        rentalRequestId: string,
        moderatorId: string,
    ): Promise<ActualRental> {

        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException(
                "Rental request not found",
            );
        }

        if (
            request.status !== RentalRequestStatus.APPROVED
        ) {
            throw new BadRequestException(
                "Only approved requests can become actual rentals",
            );
        }

        const existingRental =
            await this.actualRentalRepository.findOne({
                where: { rentalRequestId },
            });

        if (existingRental) {
            throw new ConflictException(
                "A rental already exists for this request",
            );
        }

        // -------------------------------------------------
        // Pricing snapshot
        // -------------------------------------------------

        const agreedPricePerDay = Number(
            request.agreedPricePerDay ??
            request.listedPricePerDay,
        );

        const rentalAmount =
            agreedPricePerDay * request.rentalDays;

        const deliveryFee =
            Number(request.renterDeliveryFee ?? request.deliveryFee ?? 0);

        const ownerRentalFee = Number(request.ownerRentalFee ?? 0);
        const ownerDeliveryFee = Number(request.ownerDeliveryFee ?? 0);
        const renterRentalFee = Number(request.renterRentalFee ?? rentalAmount);
        const renterDeliveryFee = Number(request.renterDeliveryFee ?? deliveryFee);
        const ownerTotalPayable = ownerRentalFee + ownerDeliveryFee;
        const renterTotalPayable = renterRentalFee + renterDeliveryFee;

        const platformCommissionRate = Number(
            request.platformCommissionRate ??
            DEFAULT_PLATFORM_COMMISSION_RATE,
        );

        const platformCommissionAmount =
            (rentalAmount * platformCommissionRate) / 100;

        const totalPayable = renterTotalPayable;

        // -------------------------------------------------
        // Create rental + payment + state history
        // -------------------------------------------------

        const queryRunner =
            this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const rental =
                queryRunner.manager.create(ActualRental, {
                    rentalId:
                        this.generateId("RENT"),
                    rentalRequestId,
                    productId: request.productId,
                    renterId: request.renterId,
                    ownerId: request.ownerId,
                    moderatorId,
                    riderId: request.riderId ?? null,
                    startDate: request.startDate,
                    rentalDays: request.rentalDays,
                    endDate: request.endDate,
                    agreedPricePerDay:
                        agreedPricePerDay.toFixed(2),
                    deliveryFee:
                        deliveryFee.toFixed(2),
                    ownerRentalFee: ownerRentalFee.toFixed(2),
                    ownerDeliveryFee: ownerDeliveryFee.toFixed(2),
                    renterRentalFee: renterRentalFee.toFixed(2),
                    renterDeliveryFee: renterDeliveryFee.toFixed(2),
                    ownerTotalPayable: ownerTotalPayable.toFixed(2),
                    renterTotalPayable: renterTotalPayable.toFixed(2),
                    rentalAmount:
                        rentalAmount.toFixed(2),
                    platformCommissionRate:
                        platformCommissionRate.toFixed(2),
                    platformCommissionAmount:
                        platformCommissionAmount.toFixed(2),
                    totalPayable:
                        totalPayable.toFixed(2),
                    pickupAddress: request.pickupAddress,
                    deliveryAddress:
                        request.deliveryAddress,
                    contactPhone: request.contactPhone,
                    status:
                        ActualRentalStatus.PENDING_HANDOVER,
                });

            const savedRental =
                await queryRunner.manager.save(rental);

            if (request.riderId) {
                await queryRunner.manager.save(
                    queryRunner.manager.create(HandoverRiderAssignment, {
                        assignmentId: this.generateId("RIDERASSIGN"),
                        rentalId: savedRental.rentalId,
                        stage: HandoverStage.OWNER_HANDOVER,
                        riderId: request.riderId,
                        assignedById: moderatorId,
                    }),
                );
            }

            const chargeRows = [
                {
                    payerId: savedRental.ownerId,
                    payerRole: RentalChargePayerRole.OWNER,
                    type: RentalChargeType.RENTAL,
                    amount: ownerRentalFee,
                },
                {
                    payerId: savedRental.ownerId,
                    payerRole: RentalChargePayerRole.OWNER,
                    type: RentalChargeType.DELIVERY,
                    amount: ownerDeliveryFee,
                },
                {
                    payerId: savedRental.renterId,
                    payerRole: RentalChargePayerRole.RENTER,
                    type: RentalChargeType.RENTAL,
                    amount: renterRentalFee,
                },
                {
                    payerId: savedRental.renterId,
                    payerRole: RentalChargePayerRole.RENTER,
                    type: RentalChargeType.DELIVERY,
                    amount: renterDeliveryFee,
                },
            ];

            const chargeEntities = chargeRows.map((charge) =>
                queryRunner.manager.create(RentalCharge, {
                    ...charge,
                    chargeId: this.generateId("CHARGE"),
                    rentalId: savedRental.rentalId,
                    rentalRequestId,
                    amount: charge.amount.toFixed(2),
                    status: charge.amount > 0
                        ? RentalChargeStatus.PENDING
                        : RentalChargeStatus.NO_CHARGE,
                }),
            );

            await queryRunner.manager.save(RentalCharge, chargeEntities);

            const payment =
                queryRunner.manager.create(RentalPayment, {
                    paymentId:
                        this.generateId("PAY"),
                    rentalId: savedRental.rentalId,
                    rentalRequestId,
                    amount:
                        totalPayable.toFixed(2),
                    method: "CASH",
                    status: RentalPaymentStatus.PENDING,
                });

            await queryRunner.manager.save(payment);

            const stateHistory =
                queryRunner.manager.create(
                    RentalStateHistory,
                    {
                        rentalId: savedRental.rentalId,
                        status:
                            ActualRentalStatus.PENDING_HANDOVER,
                        note: "Rental created by moderator",
                        actorId: moderatorId,
                    },
                );

            await queryRunner.manager.save(stateHistory);

            await queryRunner.commitTransaction();

            // -------------------------------------------------
            // Notifications
            // -------------------------------------------------

            const moderator =
                await this.userRepository.findOne({
                    where: { userId: moderatorId },
                });

            const product =
                await this.productRepository.findOne({
                    where: { productId: request.productId },
                });

            await this.notify(
                [PUSHER_CHANNELS.RENTER(request.renterId)],
                PUSHER_EVENTS.HANDOVER_VERIFICATION,
                this.buildNotification(
                    PusherNotificationType.MANUAL_PAYMENT,
                    "Rental Created",
                    `A rental for "${product?.name ?? "the product"}" is pending handover. Your renter charges total ৳${renterTotalPayable.toFixed(2)}.`,
                    moderator,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                ),
            );

            await this.notify(
                [PUSHER_CHANNELS.OWNER(request.ownerId)],
                PUSHER_EVENTS.HANDOVER_VERIFICATION,
                this.buildNotification(
                    PusherNotificationType.MANUAL_PAYMENT,
                    "Rental Created",
                    `A rental for "${product?.name ?? "the product"}" is pending handover. Your owner charges total ৳${ownerTotalPayable.toFixed(2)}.`,
                    moderator,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                ),
            );

            const staffAndRiderChannels: string[] = [
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ];

            if (request.riderId) {
                staffAndRiderChannels.push(
                    `rider-${request.riderId}-channel`,
                );
            }

            await this.notify(
                staffAndRiderChannels,
                PUSHER_EVENTS.HANDOVER_VERIFICATION,
                this.buildNotification(
                    PusherNotificationType.MANUAL_PAYMENT,
                    "Rental Created",
                    `Rental ${savedRental.rentalId} is pending handover.`,
                    moderator,
                    savedRental.rentalRequestId,
                    `/rentals/request/${savedRental.rentalRequestId}`,
                ),
            );

            return savedRental;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // =====================================================
    // GET ACTUAL RENTAL FOR A REQUEST
    // =====================================================

    async getActualRentalByRequest(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<ActualRental> {

        const rental =
            await this.actualRentalRepository.findOne({
                where: { rentalRequestId },
            });

        if (!rental) {
            throw new NotFoundException(
                "No rental exists for this request yet",
            );
        }

        const riderHasAssignment = userRole === UserRole.RIDER
            ? await this.hasRiderWorkedOnRental(rental.rentalId, userId)
            : false;

        const isParticipant =
            rental.renterId === userId ||
            rental.ownerId === userId ||
            rental.riderId === userId ||
            riderHasAssignment;

        if (
            !isParticipant &&
            !this.isModeratorOrAdmin(userRole)
        ) {
            throw new ForbiddenException(
                "You are not allowed to view this rental",
            );
        }

        const safeRental: Record<string, unknown> = {
            ...rental,
        };

        if (userRole !== UserRole.ADMIN && userRole !== UserRole.MODERATOR) {
            if (userId === rental.ownerId) {
                delete safeRental.deliveryFee;
                delete safeRental.renterRentalFee;
                delete safeRental.renterDeliveryFee;
                delete safeRental.renterTotalPayable;
                delete safeRental.totalPayable;
            } else if (userId === rental.renterId) {
                delete safeRental.ownerRentalFee;
                delete safeRental.ownerDeliveryFee;
                delete safeRental.ownerTotalPayable;
            }
        }

        return safeRental as unknown as ActualRental;
    }

    // =====================================================
    // RIDER - MY CASH PAYMENT TASKS
    // =====================================================

    async getMyPaymentTasks(
        riderId: string,
    ): Promise<
        {
            paymentId: string;
            rentalId: string;
            amount: string;
            method: string;
            status: RentalPaymentStatus;
            rental: {
                rentalId: string;
                startDate: Date;
                endDate: Date;
                totalPayable: string;
                deliveryAddress: string;
                pickupAddress: string;
            };
            request: {
                productId: string;
                renterId: string;
                ownerId: string;
                contactPhone: string;
            };
        }[]
    > {

        const payments = await this.rentalPaymentRepository.find({
            where: {
                status: In([
                    RentalPaymentStatus.PENDING,
                    RentalPaymentStatus.COLLECTED_BY_RIDER,
                ]),
            },
            order: { createdAt: "ASC" },
        });
        const tasks: {
            paymentId: string;
            rentalId: string;
            amount: string;
            method: string;
            status: RentalPaymentStatus;
            rental: {
                rentalId: string;
                startDate: Date;
                endDate: Date;
                totalPayable: string;
                deliveryAddress: string;
                pickupAddress: string;
            };
            request: {
                productId: string;
                renterId: string;
                ownerId: string;
                contactPhone: string;
            };
        }[] = [];

        for (const payment of payments) {
            const [rental, request] = await Promise.all([
                this.actualRentalRepository.findOne({
                    where: { rentalId: payment.rentalId },
                }),
                this.rentalRequestRepository.findOne({
                    where: { rentalRequestId: payment.rentalRequestId },
                }),
            ]);
            if (!rental || !request) continue;

            const handoffStage = payment.status === RentalPaymentStatus.PENDING
                ? HandoverStage.DELIVERED_TO_RENTER
                : HandoverStage.OWNER_RETURN;
            const [assignment, checkpoint] = await Promise.all([
                this.getCurrentRiderForStage(rental.rentalId, handoffStage),
                this.handoverCheckpointRepository.findOne({
                    where: {
                        rentalId: rental.rentalId,
                        stage: handoffStage,
                        status: In([
                            HandoverCheckpointStatus.PENDING,
                            HandoverCheckpointStatus.VERIFIED,
                        ]),
                    },
                }),
            ]);
            if (assignment?.riderId !== riderId || !checkpoint) continue;

            tasks.push({
                paymentId: payment.paymentId,
                rentalId: payment.rentalId,
                amount: payment.amount,
                method: payment.method,
                status: payment.status,
                rental: {
                    rentalId: rental.rentalId,
                    startDate: rental.startDate,
                    endDate: rental.endDate,
                    totalPayable: rental.totalPayable,
                    deliveryAddress: rental.deliveryAddress,
                    pickupAddress: rental.pickupAddress,
                },
                request: {
                    productId: request.productId,
                    renterId: request.renterId,
                    ownerId: request.ownerId,
                    contactPhone: request.contactPhone,
                },
            });
        }

        return tasks;
    }

    // =====================================================
    // PAYMENT - LOAD + ACCESS HELPERS
    // =====================================================

    private async loadPaymentWithRental(
        paymentId: string,
    ): Promise<{
        payment: RentalPayment;
        rental: ActualRental;
    }> {

        const payment =
            await this.rentalPaymentRepository.findOne({
                where: { paymentId },
            });

        if (!payment) {
            throw new NotFoundException(
                "Payment not found",
            );
        }

        const rental =
            await this.actualRentalRepository.findOne({
                where: { rentalId: payment.rentalId },
            });

        if (!rental) {
            throw new NotFoundException(
                "Rental not found for this payment",
            );
        }

        return { payment, rental };
    }

    // =====================================================
    // PAYMENT - COLLECT (RIDER OR OWNER)
    // =====================================================

    async collectManualPayment(
        paymentId: string,
        userId: string,
    ): Promise<RentalPayment> {

        const { payment, rental } =
            await this.loadPaymentWithRental(paymentId);

        if (payment.status !== RentalPaymentStatus.PENDING) {
            throw new BadRequestException(
                "This payment cannot be collected anymore",
            );
        }

        /*
         * Actor matching:
         * - If a rider is assigned, only the rider collects.
         * - Pickup-only rentals (no rider):
         *   the owner collects directly.
         */

        const stageAssignment = await this.getCurrentRiderForStage(
            rental.rentalId,
            HandoverStage.DELIVERED_TO_RENTER,
        );
        if (!stageAssignment || stageAssignment.riderId !== userId) {
            throw new ForbiddenException(
                "Only the rider assigned to delivery can collect this payment",
            );
        }
        const deliveryCheckpoint = await this.handoverCheckpointRepository.findOne({
            where: {
                rentalId: rental.rentalId,
                stage: HandoverStage.DELIVERED_TO_RENTER,
                status: In([
                    HandoverCheckpointStatus.PENDING,
                    HandoverCheckpointStatus.VERIFIED,
                ]),
            },
        });
        if (!deliveryCheckpoint) {
            throw new BadRequestException("Payment can only be collected during the renter delivery handoff");
        }

        payment.status =
            RentalPaymentStatus.COLLECTED_BY_RIDER;

        payment.collectedById = userId;
        payment.collectedAt = new Date();

        const updatedPayment =
            await this.rentalPaymentRepository.save(payment);

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const actor =
            await this.userRepository.findOne({
                where: { userId },
            });

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Cash Collected",
                `The rider has collected the cash payment of ${payment.amount}.`,
                actor,
                rental.rentalRequestId,
                `/rentals/request/${rental.rentalRequestId}`,
            );

        const channels: string[] = [
            PUSHER_CHANNELS.RENTER(rental.renterId),
            PUSHER_CHANNELS.OWNER(rental.ownerId),
        ];

        if (stageAssignment) {
            channels.push(
                `rider-${stageAssignment.riderId}-channel`,
            );
        }

        await this.notify(
            channels,
            PUSHER_EVENTS.MANUAL_PAYMENT_UPDATE,
            notification,
        );

        return updatedPayment;
    }

    // =====================================================
    // PAYMENT - DELIVER TO OWNER (RIDER)
    // =====================================================

    async deliverManualPayment(
        paymentId: string,
        userId: string,
    ): Promise<RentalPayment> {

        const { payment, rental } =
            await this.loadPaymentWithRental(paymentId);

        if (
            payment.status !==
            RentalPaymentStatus.COLLECTED_BY_RIDER
        ) {
            throw new BadRequestException(
                "This payment cannot be delivered yet",
            );
        }

        const stageAssignment = await this.getCurrentRiderForStage(
            rental.rentalId,
            HandoverStage.OWNER_RETURN,
        );
        if (!stageAssignment || stageAssignment.riderId !== userId) {
            throw new ForbiddenException(
                "Only the rider assigned to final return can deliver this payment",
            );
        }
        const ownerReturnCheckpoint = await this.handoverCheckpointRepository.findOne({
            where: {
                rentalId: rental.rentalId,
                stage: HandoverStage.OWNER_RETURN,
                status: In([
                    HandoverCheckpointStatus.PENDING,
                    HandoverCheckpointStatus.VERIFIED,
                ]),
            },
        });
        if (!ownerReturnCheckpoint) {
            throw new BadRequestException("Payment can only be delivered during the final return-to-owner handoff");
        }

        payment.status =
            RentalPaymentStatus.DELIVERED_TO_OWNER;

        payment.deliveredById = userId;
        payment.deliveredAt = new Date();

        const updatedPayment =
            await this.rentalPaymentRepository.save(payment);

        // -------------------------------------------------
        // Notification to the owner
        // -------------------------------------------------

        const rider =
            await this.userRepository.findOne({
                where: { userId },
            });

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Cash Delivered to Owner",
                `The rider has delivered the cash payment of ${payment.amount}. Please confirm that you received it.`,
                rider,
                rental.rentalRequestId,
                `/rentals/request/${rental.rentalRequestId}`,
            );

        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(rental.ownerId),
                PUSHER_CHANNELS.RENTER(rental.renterId),
                `rider-${userId}-channel`,
            ],
            PUSHER_EVENTS.MANUAL_PAYMENT_UPDATE,
            notification,
        );

        return updatedPayment;
    }

    // =====================================================
    // PAYMENT - OWNER CONFIRM
    // =====================================================

    async confirmManualPayment(
        paymentId: string,
        userId: string,
    ): Promise<RentalPayment> {

        const { payment, rental } =
            await this.loadPaymentWithRental(paymentId);

        if (
            payment.status !==
            RentalPaymentStatus.DELIVERED_TO_OWNER
        ) {
            throw new BadRequestException(
                "This payment cannot be confirmed yet",
            );
        }

        if (rental.ownerId !== userId) {
            throw new ForbiddenException(
                "Only the product owner can confirm this payment",
            );
        }

        payment.status = RentalPaymentStatus.CONFIRMED;
        payment.confirmedAt = new Date();

        const updatedPayment =
            await this.rentalPaymentRepository.save(payment);

        // -------------------------------------------------
        // Rental completion
        // -------------------------------------------------

        if (
            rental.status !== ActualRentalStatus.COMPLETED
        ) {
            rental.status = ActualRentalStatus.COMPLETED;

            await this.actualRentalRepository.save(rental);

            const stateHistory =
                this.rentalStateHistoryRepository.create({
                    rentalId: rental.rentalId,
                    status: ActualRentalStatus.COMPLETED,
                    note: "Payment confirmed by owner",
                    actorId: userId,
                });

            await this.rentalStateHistoryRepository.save(
                stateHistory,
            );

            // Product becomes available again
            await this.productRepository.update(
                { productId: rental.productId },
                {
                    availabilityStatus:
                        ProductAvailabilityStatus.AVAILABLE,
                },
            );
        }

        // -------------------------------------------------
        // Notifications
        // -------------------------------------------------

        const owner =
            await this.userRepository.findOne({
                where: { userId },
            });

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Payment Confirmed",
                `The owner confirmed receiving the cash payment of ${payment.amount}. The rental is now completed.`,
                owner,
                rental.rentalRequestId,
                `/rentals/request/${rental.rentalRequestId}`,
            );

        const channels: string[] = [
            PUSHER_CHANNELS.RENTER(rental.renterId),
        ];

        if (rental.riderId) {
            channels.push(
                `rider-${rental.riderId}-channel`,
            );
        }

        await this.notify(
            channels,
            PUSHER_EVENTS.MANUAL_PAYMENT_UPDATE,
            notification,
        );

        return updatedPayment;
    }

    // =====================================================
    // PARTY CHARGE COLLECTION
    // =====================================================

    async getRentalChargesForRequest(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ) {
        const rental = await this.actualRentalRepository.findOne({
            where: { rentalRequestId },
        });

        if (!rental) {
            throw new NotFoundException("No rental exists for this request yet");
        }

        const isStaff = this.isModeratorOrAdmin(userRole);
        const isParty = userId === rental.ownerId || userId === rental.renterId;
        const isAssignedRider = userRole === UserRole.RIDER
            ? await this.hasRiderWorkedOnRental(rental.rentalId, userId)
            : false;

        if (!isStaff && !isParty && !isAssignedRider) {
            throw new ForbiddenException("You are not allowed to view these charges");
        }

        const charges = await this.rentalChargeRepository.find({
            where: isStaff || isAssignedRider
                ? { rentalId: rental.rentalId }
                : { rentalId: rental.rentalId, payerId: userId },
            order: { createdAt: "ASC" },
        });

        const events = charges.length
            ? await this.rentalChargeEventRepository.find({
                where: { chargeId: In(charges.map((charge) => charge.chargeId)) },
                order: { createdAt: "ASC" },
            })
            : [];

        return charges.map((charge) => ({
            ...charge,
            events: events.filter((event) => event.chargeId === charge.chargeId),
        }));
    }

    private async getCurrentRiderForStage(
        rentalId: string,
        stage: HandoverStage,
    ) {
        return this.handoverRiderAssignmentRepository.findOne({
            where: { rentalId, stage },
            order: { assignedAt: "DESC" },
        });
    }

    async getMyRentalChargeTasks(riderId: string) {
        const charges = await this.rentalChargeRepository.find({
            where: {
                status: In([
                    RentalChargeStatus.PENDING,
                    RentalChargeStatus.REJECTED,
                ]),
            },
            order: { createdAt: "ASC" },
        });

        const tasks: {
            chargeId: string;
            rentalId: string;
            rentalRequestId: string;
            payerId: string;
            payerRole: RentalChargePayerRole;
            payerName: string;
            type: RentalChargeType;
            dueStage: HandoverStage;
            amount: string;
            status: RentalChargeStatus;
            productName: string;
            pickupAddress: string;
            deliveryAddress: string;
        }[] = [];
        for (const charge of charges) {
            const rental = await this.actualRentalRepository.findOne({
                where: { rentalId: charge.rentalId },
            });

            if (!rental) {
                continue;
            }

            const dueStage = charge.payerRole === RentalChargePayerRole.RENTER
                ? HandoverStage.DELIVERED_TO_RENTER
                : HandoverStage.OWNER_RETURN;
            const dueCheckpoint = await this.handoverCheckpointRepository.findOne({
                where: {
                    rentalId: rental.rentalId,
                    stage: dueStage,
                    status: In([
                        HandoverCheckpointStatus.PENDING,
                        HandoverCheckpointStatus.VERIFIED,
                    ]),
                },
            });

            // Renter charges are collected during delivery; owner charges are
            // collected during the final return to the owner.
            if (!dueCheckpoint) {
                continue;
            }

            const stageAssignment = await this.getCurrentRiderForStage(
                rental.rentalId,
                dueStage,
            );
            if (stageAssignment?.riderId !== riderId) {
                continue;
            }

            const [product, payer] = await Promise.all([
                this.productRepository.findOne({
                    where: { productId: rental.productId },
                }),
                this.userRepository.findOne({
                    where: { userId: charge.payerId },
                }),
            ]);

            tasks.push({
                chargeId: charge.chargeId,
                rentalId: rental.rentalId,
                rentalRequestId: rental.rentalRequestId,
                payerId: charge.payerId,
                payerRole: charge.payerRole,
                payerName: payer
                    ? `${payer.firstName} ${payer.lastName}`.trim()
                    : "Payer",
                type: charge.type,
                dueStage,
                amount: charge.amount,
                status: charge.status,
                productName: product?.name ?? "Product",
                pickupAddress: rental.pickupAddress,
                deliveryAddress: rental.deliveryAddress,
            });
        }

        return tasks;
    }

    async recordRentalChargeCollection(
        chargeId: string,
        riderId: string,
    ) {
        const charge = await this.rentalChargeRepository.findOne({
            where: { chargeId },
        });

        if (!charge) {
            throw new NotFoundException("Charge not found");
        }

        const rental = await this.actualRentalRepository.findOne({
            where: { rentalId: charge.rentalId },
        });

        if (!rental) {
            throw new NotFoundException("Rental not found for this charge");
        }

        const dueStage = charge.payerRole === RentalChargePayerRole.RENTER
            ? HandoverStage.DELIVERED_TO_RENTER
            : HandoverStage.OWNER_RETURN;
        const dueCheckpoint = await this.handoverCheckpointRepository.findOne({
            where: {
                rentalId: rental.rentalId,
                stage: dueStage,
                status: In([
                    HandoverCheckpointStatus.PENDING,
                    HandoverCheckpointStatus.VERIFIED,
                ]),
            },
        });
        if (!dueCheckpoint) {
            throw new BadRequestException(
                charge.payerRole === RentalChargePayerRole.RENTER
                    ? "Renter charges can only be collected during delivery to the renter"
                    : "Owner charges can only be collected during the final return to the owner",
            );
        }

        const stageAssignment = await this.getCurrentRiderForStage(
            rental.rentalId,
            dueStage,
        );
        if (stageAssignment?.riderId !== riderId) {
            throw new ForbiddenException("Only the rider assigned to this handover stage can collect this charge");
        }

        if (
            charge.status !== RentalChargeStatus.PENDING &&
            charge.status !== RentalChargeStatus.REJECTED
        ) {
            throw new BadRequestException("This charge is not awaiting collection");
        }

        if (Number(charge.amount) <= 0) {
            throw new BadRequestException("A zero-value charge does not need collection");
        }

        const collectedAt = new Date();
        const savedCharge = await this.dataSource.transaction(async (manager) => {
            const result = await manager.update(
                RentalCharge,
                {
                    chargeId: charge.chargeId,
                    status: In([
                        RentalChargeStatus.PENDING,
                        RentalChargeStatus.REJECTED,
                    ]),
                },
                {
                    status: RentalChargeStatus.SUBMITTED,
                    paymentMethod: RentalChargePaymentMethod.CASH,
                    paymentReference: null,
                    collectedById: riderId,
                    collectedAt,
                    submittedAt: collectedAt,
                    verifiedById: null,
                    verifiedAt: null,
                    verificationNote: null,
                },
            );

            if (!result.affected) {
                throw new BadRequestException("This charge was already submitted for review");
            }

            const updated = await manager.findOneByOrFail(RentalCharge, {
                chargeId: charge.chargeId,
            });
            await manager.save(
                manager.create(RentalChargeEvent, {
                    chargeId: charge.chargeId,
                    action: RentalChargeEventAction.SUBMITTED,
                    actorId: riderId,
                    paymentMethod: RentalChargePaymentMethod.CASH,
                    note: "Cash collected by assigned rider; awaiting moderator verification.",
                }),
            );
            return updated;
        });

        const rider = await this.userRepository.findOne({ where: { userId: riderId } });
        const payerChannel = charge.payerRole === RentalChargePayerRole.OWNER
            ? PUSHER_CHANNELS.OWNER(charge.payerId)
            : PUSHER_CHANNELS.RENTER(charge.payerId);
        await this.notify(
            [PUSHER_CHANNELS.ADMIN_MODERATOR, payerChannel],
            PUSHER_EVENTS.MANUAL_PAYMENT_UPDATE,
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Charge Collection Needs Review",
                `The rider recorded a cash collection of ৳${Number(charge.amount).toFixed(2)} for ${charge.payerRole.toLowerCase()} ${charge.type.toLowerCase()} charges. Moderator verification is pending.`,
                rider,
            ),
        );

        return savedCharge;
    }

    async reviewRentalChargeCollection(
        chargeId: string,
        moderatorId: string,
        dto: ReviewRentalChargePaymentDto,
    ) {
        const charge = await this.rentalChargeRepository.findOne({
            where: { chargeId },
        });

        if (!charge) {
            throw new NotFoundException("Charge not found");
        }

        if (charge.status !== RentalChargeStatus.SUBMITTED) {
            throw new BadRequestException("Only submitted rider collections can be reviewed");
        }

        const verifiedAt = new Date();
        const nextStatus = dto.approved
            ? RentalChargeStatus.CONFIRMED
            : RentalChargeStatus.REJECTED;
        const savedCharge = await this.dataSource.transaction(async (manager) => {
            const result = await manager.update(
                RentalCharge,
                {
                    chargeId: charge.chargeId,
                    status: RentalChargeStatus.SUBMITTED,
                },
                {
                    status: nextStatus,
                    verifiedById: moderatorId,
                    verifiedAt,
                    verificationNote: dto.note ?? null,
                },
            );

            if (!result.affected) {
                throw new BadRequestException("This collection has already been reviewed");
            }

            const updated = await manager.findOneByOrFail(RentalCharge, {
                chargeId: charge.chargeId,
            });
            await manager.save(
                manager.create(RentalChargeEvent, {
                    chargeId: charge.chargeId,
                    action: dto.approved
                        ? RentalChargeEventAction.CONFIRMED
                        : RentalChargeEventAction.REJECTED,
                    actorId: moderatorId,
                    note: dto.note ?? null,
                }),
            );
            return updated;
        });

        const rental = await this.actualRentalRepository.findOne({
            where: { rentalId: charge.rentalId },
        });
        const moderator = await this.userRepository.findOne({
            where: { userId: moderatorId },
        });

        if (rental) {
            const payerChannel = charge.payerRole === RentalChargePayerRole.OWNER
                ? PUSHER_CHANNELS.OWNER(charge.payerId)
                : PUSHER_CHANNELS.RENTER(charge.payerId);

            const resultChannels = [payerChannel];
            if (charge.collectedById) {
                resultChannels.push(`rider-${charge.collectedById}-channel`);
            }

            await this.notify(
                resultChannels,
                PUSHER_EVENTS.MANUAL_PAYMENT_UPDATE,
                this.buildNotification(
                    PusherNotificationType.MANUAL_PAYMENT,
                    dto.approved ? "Payment Confirmed" : "Payment Needs Attention",
                    dto.approved
                        ? `Your ${charge.type.toLowerCase()} charge payment of ৳${Number(charge.amount).toFixed(2)} was verified.`
                        : `Your ${charge.type.toLowerCase()} charge payment of ৳${Number(charge.amount).toFixed(2)} was not verified. The rider can collect it again.`,
                    moderator,
                ),
            );
        }

        return savedCharge;
    }

    // =====================================================
    // EXISTING RENTER-TO-OWNER CASH TRANSFER - GET FOR REQUEST
    // =====================================================

    async getPaymentByRentalRequest(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<{
        rentalId: string;
        riderId: string | null;
        renterId: string;
        ownerId: string;
        payment: RentalPayment;
    }> {

        const rental =
            await this.actualRentalRepository.findOne({
                where: { rentalRequestId },
            });

        if (!rental) {
            throw new NotFoundException(
                "No rental exists for this request yet",
            );
        }

        const payment =
            await this.rentalPaymentRepository.findOne({
                where: { rentalId: rental.rentalId },
            });

        if (!payment) {
            throw new NotFoundException(
                "Payment not found for this rental",
            );
        }

        const riderHasAssignment = userRole === UserRole.RIDER
            ? await this.hasRiderWorkedOnRental(rental.rentalId, userId)
            : false;

        const isParticipant =
            rental.renterId === userId ||
            rental.ownerId === userId ||
            rental.riderId === userId ||
            riderHasAssignment;

        if (
            !isParticipant &&
            !this.isModeratorOrAdmin(userRole)
        ) {
            throw new ForbiddenException(
                "You are not allowed to view this payment",
            );
        }

        return {
            rentalId: rental.rentalId,
            riderId: rental.riderId ?? null,
            renterId: rental.renterId,
            ownerId: rental.ownerId,
            payment,
        };
    }

    // =====================================================
    // PRODUCT SERVICE INTEGRATION
    // =====================================================

    async hasActiveRentalRequestForProduct(
        productId: string,
    ): Promise<boolean> {

        const count =
            await this.rentalRequestRepository.count({
                where: {
                    productId,
                    status: In(ACTIVE_REQUEST_STATUSES),
                },
            });

        return count > 0;
    }
}
