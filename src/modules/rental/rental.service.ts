import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import {
    DataSource,
    Repository,
    In,
} from "typeorm";

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
import { RentalPayment, RentalPaymentStatus } from "./entity/rental-payment.entity";
import { RentalCharge, RentalChargeStatus } from "./entity/rental-charge.entity";
import { HandoverCheckpoint, CheckpointMedia } from "./entity/handover-checkpoint.entity";
import { HandoverOtp } from "./entity/handover-otp.entity";
import { RentalIssue } from "./entity/rental-issue.entity";

import { Product } from "../Product/Entity/product.entity";
import { User } from "../users/entity/user-entity";

import { CreateRentalRequestDto } from "./dto/create-rental-request.dto";
import { CreateNegotiationOfferDto } from "./dto/create-negotiation-offer.dto";
import {
    NegotiationOfferAction,
    UpdateNegotiationOfferDto,
} from "./dto/update-negotiation-offer.dto";
import { OwnerRentalRequestAction } from "./dto/owner-rental-request-action.dto";
import { RenterRentalRequestAction } from "./dto/renter-rental-request-action.dto";
import {
    ModeratorPickupReviewDto,
    ModeratorReturnReviewDto,
    ModeratorRentalRequestAction,
    ReviewRentalRequestDto,
} from "./dto/ReviewRentalRequestDto";
import { AcceptChargesDto, ChargesAction } from "./dto/accept-charges.dto";
import { HandoverStageParamDto } from "./dto/handover.dto";
import {
    ModeratorGateDto,
    VerifyHandoverOtpDto,
    SubmitHandoverNoteDto,
    SubmitModeratorMediaDto,
    EarlyReturnDecisionDto,
    AssignHandoverRiderDto,
} from "./dto/handover.dto";
import { ReviewRentalChargePaymentDto } from "./dto/rental-charge.dto";
import {
    CreateIssueDto,
    RespondToIssueDto,
    DecideIssueDto,
} from "./dto/issue.dto";
import {
    IssueSeverity,
    IssueStatus,
} from "./entity/rental-issue.entity";

import { RentalRequestStatus } from "./enum/rental-request-status.enum";
import {
    HandoverStage,
    HandoverOtpPurpose,
    HandoverCheckpointStatus,
    HANDOVER_STAGE_ORDER,
    MODERATOR_GATE_STAGES,
    RIDER_MEDIA_STAGES,
    STAGE_OTP_PURPOSES,
} from "./enum/handover-stage.enum";
import { UserRole } from "../users/enums/user-role-enum";
import { PaginationDto } from "../pagination/pagination-dto";

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
import { HandoverOtpService } from "./handover-otp.service";
import { ProductAvailabilityStatus } from "../Product/enum/productavailabilityStatus.enum";

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

const ACTIVE_REQUEST_STATUSES: RentalRequestStatus[] = [
    RentalRequestStatus.PENDING,
    RentalRequestStatus.NEGOTIATING,
    RentalRequestStatus.PRICE_AGREED,
    RentalRequestStatus.APPROVED,
];

const DEFAULT_PLATFORM_COMMISSION_RATE = 10;
const DEFAULT_DELIVERY_FEE = 0;

@Injectable()
export class RentalService {
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

        @InjectRepository(HandoverCheckpoint)
        private readonly checkpointRepository: Repository<HandoverCheckpoint>,

        @InjectRepository(CheckpointMedia)
        private readonly mediaRepository: Repository<CheckpointMedia>,

        @InjectRepository(HandoverOtp)
        private readonly handoverOtpRepository: Repository<HandoverOtp>,

        @InjectRepository(RentalIssue)
        private readonly rentalIssueRepository: Repository<RentalIssue>,

        @InjectRepository(Product)
        private readonly productRepository: Repository<Product>,

        @InjectRepository(User)
        private readonly userRepository: Repository<User>,

        private readonly pusherService: PusherService,
        private readonly emailService: EmailService,
        private readonly handoverOtpService: HandoverOtpService,

        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    private generateId(prefix: string): string {
        const random = Math.random().toString(36).slice(2, 8);
        return `${prefix}-${Date.now()}-${random}`;
    }

    private shapeUser(user?: User | null) {
        if (!user) return undefined;
        return {
            userId: user.userId,
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
        };
    }

    private shapeRider(rider?: User | null) {
        if (!rider) return null;
        return {
            userId: rider.userId,
            firstName: rider.firstName,
            lastName: rider.lastName,
            email: rider.email,
            phone: rider.phone,
        };
    }

    private shapeRequest(request: RentalRequest) {
        return {
            ...request,
            product: request.product
                ? {
                    productId: request.product.productId,
                    name: request.product.name,
                    pricePerDay: request.product.pricePerDay,
                    location: request.product.location
                        ? { pickupAddress: request.product.location.pickupAddress }
                        : null,
                }
                : undefined,
            renter: this.shapeUser(request.renter),
            owner: this.shapeUser(request.owner),
            moderator: this.shapeUser(request.moderator),
            rider: this.shapeRider(request.rider),
        };
    }

    private buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
        return {
            page,
            limit,
            total,
            totalPages: total > 0 ? Math.ceil(total / limit) : 0,
        };
    }

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
            userName: actor ? `${actor.firstName} ${actor.lastName}`.trim() : "ToolShare",
            email: actor?.email ?? "",
            timestamp: new Date(),
            rentalId: rentalId ?? null,
            link: link ?? null,
        };
    }

    private async notify(channels: string[], event: string, data: PusherNotificationData): Promise<void> {
        try {
            for (const channel of channels) {
                await this.pusherService.trigger(channel, event, data);
            }
        } catch {
            // Notifications must never break the business operation.
        }
    }

    private assertRequestParticipant(request: RentalRequest, userId: string, userRole: UserRole): void {
        const isParticipant = request.renterId === userId || request.ownerId === userId;
        const isStaff = userRole === UserRole.MODERATOR || userRole === UserRole.ADMIN;
        if (!isParticipant && !isStaff) {
            throw new ForbiddenException("You are not allowed to view this rental request");
        }
    }

    private isModeratorOrAdmin(role: UserRole): boolean {
        return role === UserRole.MODERATOR || role === UserRole.ADMIN;
    }

    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setUTCDate(result.getUTCDate() + days);
        return result;
    }

    private datesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
        return !(endA.getTime() < startB.getTime() || startA.getTime() > endB.getTime());
    }

    // =====================================================
    // CREATE RENTAL REQUEST
    // =====================================================

    async createRentalRequest(dto: CreateRentalRequestDto, renterId: string): Promise<RentalRequest> {
        const product = await this.productRepository.findOne({
            where: { productId: dto.productId },
            relations: { location: true },
        });

        if (!product) throw new NotFoundException("Product not found");
        if (product.ownerId === renterId) throw new BadRequestException("You cannot rent your own product");
        if (product.availabilityStatus !== ProductAvailabilityStatus.AVAILABLE) {
            throw new BadRequestException("This product is currently not available");
        }

        if (dto.rentalDays < product.minRentalDays || dto.rentalDays > product.maxRentalDays) {
            throw new BadRequestException(`Rental duration must be between ${product.minRentalDays} and ${product.maxRentalDays} days`);
        }

        const startDate = new Date(dto.startDate);
        if (Number.isNaN(startDate.getTime())) throw new BadRequestException("Invalid start date");

        const startOfDay = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        const today = new Date();
        const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

        if (startOfDay.getTime() < todayUtc.getTime()) {
            throw new BadRequestException("Start date cannot be in the past");
        }

        if (!product.allowSameDayRental && startOfDay.getTime() === todayUtc.getTime()) {
            throw new BadRequestException("Same-day rental is not allowed for this product");
        }

        const endDate = this.addDays(startOfDay, dto.rentalDays);
        const listedPricePerDay = Number(product.pricePerDay);

        if (dto.offeredPricePerDay !== undefined) {
            if (!product.negotiationAllowed) throw new BadRequestException("Negotiation is not allowed for this product");
            if (dto.offeredPricePerDay > listedPricePerDay) throw new BadRequestException("Offered price cannot be higher than listed price");
        }

        const existingActiveRequest = await this.rentalRequestRepository.findOne({
            where: { productId: dto.productId, renterId, status: ACTIVE_REQUEST_STATUSES as unknown as RentalRequestStatus },
        });

        if (existingActiveRequest) throw new ConflictException("You already have an active rental request for this product");

        const overlappingApproved = await this.rentalRequestRepository.createQueryBuilder("request")
            .where("request.productId = :productId", { productId: dto.productId })
            .andWhere("request.status = :status", { status: RentalRequestStatus.APPROVED })
            .andWhere("request.startDate <= :newEnd AND request.endDate >= :newStart", { newStart: startOfDay, newEnd: endDate })
            .getOne();

        if (overlappingApproved) throw new BadRequestException("Product already approved for overlapping dates");

        const request = this.rentalRequestRepository.create({
            rentalRequestId: this.generateId("REQ"),
            productId: dto.productId,
            renterId,
            ownerId: product.ownerId,
            startDate: startOfDay,
            rentalDays: dto.rentalDays,
            endDate,
            pickupAddress: product.location?.pickupAddress ?? "",
            deliveryLatitude: dto.deliveryLatitude,
            deliveryLongitude: dto.deliveryLongitude,
            deliveryAddress: dto.deliveryAddress,
            contactPhone: dto.contactPhone,
            renterMessage: dto.renterMessage,
            listedPricePerDay: product.pricePerDay.toString(),
            offeredPricePerDay: dto.offeredPricePerDay !== undefined ? dto.offeredPricePerDay.toFixed(2) : undefined,
            status: dto.offeredPricePerDay !== undefined && product.negotiationAllowed && dto.offeredPricePerDay < listedPricePerDay
                ? RentalRequestStatus.NEGOTIATING
                : RentalRequestStatus.PENDING,
        });

        const savedRequest = await this.rentalRequestRepository.save(request);

        if (dto.offeredPricePerDay !== undefined && product.negotiationAllowed && dto.offeredPricePerDay < listedPricePerDay) {
            const offer = this.negotiationOfferRepository.create({
                offerId: this.generateId("OFF"),
                rentalRequestId: savedRequest.rentalRequestId,
                senderId: renterId,
                offeredPricePerDay: dto.offeredPricePerDay!.toFixed(2),
                message: dto.renterMessage,
                status: NegotiationOfferStatus.PENDING,
            });
            await this.negotiationOfferRepository.save(offer);
        }

        const renter = await this.userRepository.findOne({ where: { userId: renterId } });

        const notification = this.buildNotification(
            PusherNotificationType.NEW_RENTAL_REQUEST,
            "New Rental Request",
            `A renter has requested to rent "${product.name}".`,
            renter,
            savedRequest.rentalRequestId,
            `/rentals/request/${savedRequest.rentalRequestId}`,
        );

        await this.notify(
            [PUSHER_CHANNELS.OWNER(product.ownerId), PUSHER_CHANNELS.ADMIN_MODERATOR],
            PUSHER_EVENTS.NEW_RENTAL_REQUEST,
            notification,
        );

        return savedRequest;
    }

    // =====================================================
    // LIST RENTAL REQUESTS
    // =====================================================

    async getOwnerRentalRequests(ownerId: string, pagination: PaginationDto): Promise<PaginatedRequests> {
        const [requests, total] = await this.rentalRequestRepository.findAndCount({
            where: { ownerId },
            relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
            order: { createdAt: "DESC" },
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
        });
        return {
            data: requests.map((request) => this.shapeRequest(request)),
            meta: this.buildPaginationMeta(pagination.page, pagination.limit, total),
        };
    }

    async getRenterRentalRequests(renterId: string, pagination: PaginationDto): Promise<PaginatedRequests> {
        const [requests, total] = await this.rentalRequestRepository.findAndCount({
            where: { renterId },
            relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
            order: { createdAt: "DESC" },
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
        });
        return {
            data: requests.map((request) => this.shapeRequest(request)),
            meta: this.buildPaginationMeta(pagination.page, pagination.limit, total),
        };
    }

    async getRenterActiveRequestForProduct(productId: string, renterId: string): Promise<{ exists: boolean; rentalRequestId: string | null; status: RentalRequestStatus | null }> {
        const request = await this.rentalRequestRepository.findOne({
            where: { productId, renterId, status: ACTIVE_REQUEST_STATUSES as unknown as RentalRequestStatus },
        });
        if (!request) return { exists: false, rentalRequestId: null, status: null };
        return { exists: true, rentalRequestId: request.rentalRequestId, status: request.status };
    }

    async getRentalRequestById(rentalRequestId: string, userId: string, userRole: UserRole): Promise<ReturnType<RentalService["shapeRequest"]>> {
        const request = await this.rentalRequestRepository.findOne({
            where: { rentalRequestId },
            relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
        });
        if (!request) throw new NotFoundException("Rental request not found");
        this.assertRequestParticipant(request, userId, userRole);
        return this.shapeRequest(request);
    }

    // =====================================================
    // OWNER - RESPOND TO REQUEST
    // =====================================================

    async updateRentalRequestStatus(rentalRequestId: string, ownerId: string, action: OwnerRentalRequestAction): Promise<ReturnType<RentalService["shapeRequest"]>> {
        const request = await this.rentalRequestRepository.findOne({
            where: { rentalRequestId },
            relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
        });

        if (!request) throw new NotFoundException("Rental request not found");
        if (request.ownerId !== ownerId) throw new ForbiddenException("Only the product owner can respond to this request");
        if (request.status !== RentalRequestStatus.PENDING && request.status !== RentalRequestStatus.NEGOTIATING) throw new BadRequestException("This request cannot be updated anymore");

        const owner = await this.userRepository.findOne({ where: { userId: ownerId } });
        const product = await this.productRepository.findOne({ where: { productId: request.productId } });

        if (action === OwnerRentalRequestAction.ACCEPT) {
            request.status = RentalRequestStatus.PRICE_AGREED;
            request.agreedPricePerDay = request.offeredPricePerDay ?? request.listedPricePerDay;
            await this.negotiationOfferRepository.update(
                { rentalRequestId, status: NegotiationOfferStatus.PENDING },
                { status: NegotiationOfferStatus.REJECTED },
            );

            // Auto-cancel all other active requests for the same product
            await this.cancelOtherRequestsForProduct(
                request.productId,
                request.rentalRequestId,
                product?.name ?? "the product",
                owner,
            );

            // Notify the owner that they accepted the request
            const ownerNotification = this.buildNotification(
                PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                "You Accepted a Rental Request",
                `You have accepted the rental request for "${product?.name ?? "the product"}". The renter has been notified.`,
                owner,
                request.rentalRequestId,
                `/rentals/request/${rentalRequestId}`,
            );

            await this.notify(
                [PUSHER_CHANNELS.OWNER(ownerId)],
                PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                ownerNotification,
            );
        } else {
            request.status = RentalRequestStatus.REJECTED;
            await this.negotiationOfferRepository.update(
                { rentalRequestId, status: NegotiationOfferStatus.PENDING },
                { status: NegotiationOfferStatus.REJECTED },
            );
        }

        const updatedRequest = await this.rentalRequestRepository.save(request);

        const isAccepted = action === OwnerRentalRequestAction.ACCEPT;
        const renterNotification = this.buildNotification(
            isAccepted ? PusherNotificationType.RENTAL_REQUEST_ACCEPTED : PusherNotificationType.RENTAL_REQUEST_REJECTED,
            isAccepted ? "Rental Request Accepted" : "Rental Request Rejected",
            `The owner of "${product?.name ?? "the product"}" has ${isAccepted ? "accepted" : "rejected"} your rental request.`,
            owner,
            request.rentalRequestId,
            `/rentals/request/${rentalRequestId}`,
        );

        await this.notify(
            [PUSHER_CHANNELS.RENTER(request.renterId)],
            isAccepted ? PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED : PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
            renterNotification,
        );

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
            }) ?? updatedRequest,
        );
    }

    // =====================================================
    // RENTER - RESPOND TO REQUEST (CONFIRM / REJECT)
    // =====================================================

    async renterRentalRequestAction(
        rentalRequestId: string,
        userId: string,
        action: RenterRentalRequestAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {
        const request = await this.rentalRequestRepository.findOne({
            where: { rentalRequestId },
            relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
        });

        if (!request) throw new NotFoundException("Rental request not found");
        if (request.renterId !== userId) throw new ForbiddenException("Only the renter can respond to this request");
        if (request.status !== RentalRequestStatus.PRICE_AGREED) {
            throw new BadRequestException("Only price-agreed requests can be confirmed or rejected by the renter");
        }

        const renter = await this.userRepository.findOne({ where: { userId } });
        const product = await this.productRepository.findOne({ where: { productId: request.productId } });

        if (action === RenterRentalRequestAction.CONFIRM) {
            request.status = RentalRequestStatus.RENTAL_CONFIRMED;
            await this.rentalRequestRepository.save(request);

            const notification = this.buildNotification(
                PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                "Renter Confirmed Rental",
                `The renter has confirmed the rental for "${product?.name ?? "the product"}". Waiting for moderator review.`,
                renter,
                request.rentalRequestId,
                `/rentals/request/${request.rentalRequestId}`,
            );

            await this.notify(
                [PUSHER_CHANNELS.OWNER(request.ownerId), PUSHER_CHANNELS.ADMIN_MODERATOR],
                PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                notification,
            );
        } else {
            request.status = RentalRequestStatus.REJECTED;
            await this.rentalRequestRepository.save(request);

            const notification = this.buildNotification(
                PusherNotificationType.RENTAL_REQUEST_REJECTED,
                "Renter Rejected Rental",
                `The renter has rejected the rental for "${product?.name ?? "the product"}".`,
                renter,
                request.rentalRequestId,
                `/rentals/request/${request.rentalRequestId}`,
            );

            await this.notify(
                [PUSHER_CHANNELS.OWNER(request.ownerId), PUSHER_CHANNELS.ADMIN_MODERATOR],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                notification,
            );
        }

        return this.shapeRequest(
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
                relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
            }) ?? request,
        );
    }

    // =====================================================
    // NEGOTIATION
    // =====================================================

    async createNegotiationOffer(dto: CreateNegotiationOfferDto, senderId: string): Promise<NegotiationOffer> {
        const request = await this.rentalRequestRepository.findOne({ where: { rentalRequestId: dto.rentalRequestId } });
        if (!request) throw new NotFoundException("Rental request not found");

        const isParticipant = request.renterId === senderId || request.ownerId === senderId;
        if (!isParticipant) throw new ForbiddenException("Only the renter or owner can negotiate");

        if ([RentalRequestStatus.APPROVED, RentalRequestStatus.REJECTED, RentalRequestStatus.PRICE_AGREED, RentalRequestStatus.EXPIRED, RentalRequestStatus.CHARGES_PROPOSED].includes(request.status)) {
            throw new BadRequestException("Negotiation is closed for this request");
        }

        const latestOffer = await this.negotiationOfferRepository.findOne({
            where: { rentalRequestId: request.rentalRequestId },
            order: { createdAt: "DESC" },
        });

        if (latestOffer && latestOffer.senderId === senderId) {
            throw new BadRequestException("Please wait for the other party to respond before sending another offer");
        }

        await this.negotiationOfferRepository.update(
            { rentalRequestId: request.rentalRequestId, status: NegotiationOfferStatus.PENDING },
            { status: NegotiationOfferStatus.REJECTED },
        );

        const offer = this.negotiationOfferRepository.create({
            offerId: this.generateId("OFF"),
            rentalRequestId: request.rentalRequestId,
            senderId,
            offeredPricePerDay: dto.offeredPricePerDay.toFixed(2),
            message: dto.message,
            status: NegotiationOfferStatus.PENDING,
        });

        const savedOffer = await this.negotiationOfferRepository.save(offer);

        if (request.status !== RentalRequestStatus.NEGOTIATING) {
            request.status = RentalRequestStatus.NEGOTIATING;
            await this.rentalRequestRepository.save(request);
        }

        const sender = await this.userRepository.findOne({ where: { userId: senderId } });
        const counterpartyId = request.renterId === senderId ? request.ownerId : request.renterId;
        const product = await this.productRepository.findOne({ where: { productId: request.productId } });

        const notification = this.buildNotification(
            PusherNotificationType.NEGOTIATION_OFFER,
            "New Negotiation Offer",
            `A new price offer of ${dto.offeredPricePerDay.toFixed(2)} was made for "${product?.name ?? "the product"}".`,
            sender,
        );

        await this.notify(
            [request.renterId === counterpartyId ? PUSHER_CHANNELS.RENTER(offer.senderId) : PUSHER_CHANNELS.OWNER(offer.senderId)],
            PUSHER_EVENTS.NEW_NEGOTIATION_OFFER,
            notification,
        );

        return savedOffer;
    }

    async getNegotiationHistory(rentalRequestId: string, userId: string, userRole: UserRole): Promise<{ offerId: string; rentalRequestId: string; senderId: string; offeredPricePerDay: string; message?: string; status: NegotiationOfferStatus; createdAt: Date; sender?: { userId: string; name: string; email: string; } }[]> {
        const request = await this.rentalRequestRepository.findOne({ where: { rentalRequestId } });
        if (!request) throw new NotFoundException("Rental request not found");
        this.assertRequestParticipant(request, userId, userRole);

        const offers = await this.negotiationOfferRepository.find({
            where: { rentalRequestId },
            relations: { sender: true },
            order: { createdAt: "ASC" },
        });

        return offers.map(offer => ({
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

    async updateNegotiationOffer(offerId: string, responderId: string, action: NegotiationOfferAction): Promise<NegotiationOffer> {
        const offer = await this.negotiationOfferRepository.findOne({ where: { offerId } });
        if (!offer) throw new NotFoundException("Negotiation offer not found");

        const request = await this.rentalRequestRepository.findOne({ where: { rentalRequestId: offer.rentalRequestId } });
        if (!request) throw new NotFoundException("Rental request not found");

        const isCounterparty = (request.renterId === responderId || request.ownerId === responderId) && offer.senderId !== responderId;
        if (!isCounterparty) throw new ForbiddenException("Only the counterparty can respond to this offer");
        if (offer.status !== NegotiationOfferStatus.PENDING) throw new BadRequestException("This offer has already been resolved");
        if ([RentalRequestStatus.APPROVED, RentalRequestStatus.REJECTED, RentalRequestStatus.PRICE_AGREED, RentalRequestStatus.CHARGES_PROPOSED].includes(request.status)) {
            throw new BadRequestException("Negotiation is closed for this request");
        }

        const responder = await this.userRepository.findOne({ where: { userId: responderId } });
        const product = await this.productRepository.findOne({ where: { productId: request.productId } });

        if (action === NegotiationOfferAction.ACCEPT) {
            offer.status = NegotiationOfferStatus.ACCEPTED;
            await this.negotiationOfferRepository.save(offer);
            await this.negotiationOfferRepository.update(
                { rentalRequestId: request.rentalRequestId, status: NegotiationOfferStatus.PENDING },
                { status: NegotiationOfferStatus.REJECTED },
            );
            request.status = RentalRequestStatus.PRICE_AGREED;
            request.agreedPricePerDay = offer.offeredPricePerDay;
            await this.rentalRequestRepository.save(request);

            const notification = this.buildNotification(
                PusherNotificationType.RENTAL_REQUEST_ACCEPTED,
                "Offer Accepted",
                `Your offer of ${offer.offeredPricePerDay} for "${product?.name ?? "the product"}" was accepted. The request is now waiting for moderator review.`,
                responder,
            );
            await this.notify(
                [request.renterId === offer.senderId ? PUSHER_CHANNELS.RENTER(offer.senderId) : PUSHER_CHANNELS.OWNER(offer.senderId)],
                PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                notification,
            );
        } else {
            offer.status = NegotiationOfferStatus.REJECTED;
            await this.negotiationOfferRepository.save(offer);
            const notification = this.buildNotification(
                PusherNotificationType.RENTAL_REQUEST_REJECTED,
                "Offer Rejected",
                `Your offer of ${offer.offeredPricePerDay} for "${product?.name ?? "the product"}" was rejected. You may send a new offer.`,
                responder,
            );
            await this.notify(
                [request.renterId === offer.senderId ? PUSHER_CHANNELS.RENTER(offer.senderId) : PUSHER_CHANNELS.OWNER(offer.senderId)],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                notification,
            );
        }

        return offer;
    }

    // =====================================================
    // MODERATOR - LIST PENDING REVIEWS
    // =====================================================

    async getModeratorRentalRequests(pagination: PaginationDto): Promise<PaginatedRequests> {
        const [requests, total] = await this.rentalRequestRepository.findAndCount({
            where: { status: RentalRequestStatus.PRICE_AGREED },
            relations: { product: { location: true }, renter: true, owner: true, moderator: true, rider: true },
            order: { createdAt: "ASC" },
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
        });
        return {
            data: requests.map((request) => this.shapeRequest(request)),
            meta: this.buildPaginationMeta(pagination.page, pagination.limit, total),
        };
    }

    // =====================================================
    // MODERATOR - PROPOSE CHARGES
    // =====================================================

    async reviewRentalRequest(
        rentalRequestId: string,
        moderatorId: string,
        dto: ReviewRentalRequestDto,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {

        const request = await this.rentalRequestRepository.findOne({
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

        if (request.status !== RentalRequestStatus.PRICE_AGREED) {
            throw new BadRequestException(
                "Only price-agreed requests can be reviewed",
            );
        }

        const moderator = await this.userRepository.findOne({
            where: { userId: moderatorId },
        });

        const product = await this.productRepository.findOne({
            where: { productId: request.productId },
        });

        const agreedPricePerDay = Number(
            request.agreedPricePerDay ?? request.listedPricePerDay,
        );

        const rentalAmount = agreedPricePerDay * request.rentalDays;

        request.status = RentalRequestStatus.CHARGES_PROPOSED;

        request.ownerRentalFee = dto.ownerRentalFee!.toFixed(2);
        request.ownerDeliveryFee = dto.ownerDeliveryFee!.toFixed(2);
        request.renterRentalFee = dto.renterRentalFee!.toFixed(2);
        request.renterDeliveryFee = dto.renterDeliveryFee!.toFixed(2);
        request.platformCommissionRate =
            (
                dto.platformCommissionRate ??
                DEFAULT_PLATFORM_COMMISSION_RATE
            ).toFixed(2);

        request.ownerChargesAccepted = false;
        request.renterChargesAccepted = false;

        const updatedRequest = await this.rentalRequestRepository.save(request);

        const notification = this.buildNotification(
            PusherNotificationType.NEW_RENTAL_REQUEST,
            "Charges Proposed",
            `The moderator has proposed charges for "${product?.name ?? "the product"}". Please review and accept.`,
            moderator,
            request.rentalRequestId,
            `/rentals/request/${request.rentalRequestId}`,
        );

        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.RENTER(request.renterId),
            ],
            PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
            notification,
        );

        return this.shapeRequest(updatedRequest);
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

        if (request.status !== RentalRequestStatus.PRICE_AGREED && request.status !== RentalRequestStatus.CHARGES_PROPOSED) {
            throw new BadRequestException(
                "Pickup condition review is only available for price-agreed or charges-proposed requests",
            );
        }

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        request.moderatorPickupReviewedAt = new Date();
        request.pickupReviewNote = dto.pickupReviewNote ?? undefined;
        request.pickupConditionApproved = dto.pickupConditionApproved;

        if (dto.pickupConditionApproved) {
            request.status = RentalRequestStatus.PRICE_AGREED;
        } else {
            request.status = RentalRequestStatus.REJECTED;
        }

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        const notification = this.buildNotification(
            PusherNotificationType.NEW_RENTAL_REQUEST,
            dto.pickupConditionApproved ? "Pickup Condition Approved" : "Pickup Condition Rejected",
            `The moderator has ${dto.pickupConditionApproved ? "approved" : "rejected"} the pickup condition for "${product?.name ?? "the product"}".`,
            moderator,
            request.rentalRequestId,
            `/rentals/request/${request.rentalRequestId}`,
        );

        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
            notification,
        );

        return this.shapeRequest(updatedRequest);
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

        if (request.status !== RentalRequestStatus.PRICE_AGREED && request.status !== RentalRequestStatus.CHARGES_PROPOSED) {
            throw new BadRequestException(
                "Return condition review is only available for price-agreed or charges-proposed requests",
            );
        }

        const moderator =
            await this.userRepository.findOne({
                where: { userId: moderatorId },
            });

        const product =
            await this.productRepository.findOne({
                where: { productId: request.productId },
            });

        request.moderatorReturnReviewedAt = new Date();
        request.returnReviewNote = dto.returnReviewNote ?? undefined;
        request.returnConditionApproved = dto.returnConditionApproved;

        if (dto.returnConditionApproved) {
            request.status = RentalRequestStatus.PRICE_AGREED;
        } else {
            request.status = RentalRequestStatus.REJECTED;
        }

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        const notification = this.buildNotification(
            PusherNotificationType.NEW_RENTAL_REQUEST,
            dto.returnConditionApproved ? "Return Condition Approved" : "Return Condition Rejected",
            `The moderator has ${dto.returnConditionApproved ? "approved" : "rejected"} the return condition for "${product?.name ?? "the product"}".`,
            moderator,
            request.rentalRequestId,
            `/rentals/request/${request.rentalRequestId}`,
        );

        await this.notify(
            [
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
            notification,
        );

        return this.shapeRequest(updatedRequest);
    }

    // =====================================================
    // OWNER - ACCEPT / REJECT PROPOSED CHARGES
    // =====================================================

    async ownerAcceptCharges(
        rentalRequestId: string,
        userId: string,
        action: ChargesAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {
        return this.handleChargeAcceptance(rentalRequestId, userId, action, "owner");
    }

    // =====================================================
    // RENTER - ACCEPT / REJECT PROPOSED CHARGES
    // =====================================================

    async renterAcceptCharges(
        rentalRequestId: string,
        userId: string,
        action: ChargesAction,
    ): Promise<ReturnType<RentalService["shapeRequest"]>> {
        return this.handleChargeAcceptance(rentalRequestId, userId, action, "renter");
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
            throw new NotFoundException("Rental request not found");
        }

        if (request.status !== RentalRequestStatus.CHARGES_PROPOSED) {
            throw new BadRequestException("Charges are not proposed for this request yet");
        }

        if (party === "owner" && request.ownerId !== userId) {
            throw new ForbiddenException("Only the owner can accept or reject these charges");
        }

        if (party === "renter" && request.renterId !== userId) {
            throw new ForbiddenException("Only the renter can accept or reject these charges");
        }

        const user =
            await this.userRepository.findOne({ where: { userId } });

        const product =
            await this.productRepository.findOne({ where: { productId: request.productId } });

        if (action === ChargesAction.ACCEPT) {
            if (party === "owner") {
                request.ownerChargesAccepted = true;
            } else {
                request.renterChargesAccepted = true;
            }

            if (request.ownerChargesAccepted && request.renterChargesAccepted) {
                request.status = RentalRequestStatus.APPROVED;

                await this.notify(
                    [PUSHER_CHANNELS.ADMIN_MODERATOR],
                    PUSHER_EVENTS.RENTAL_REQUEST_ACCEPTED,
                    this.buildNotification(
                        PusherNotificationType.NEW_RENTAL_REQUEST,
                        "Charges Accepted by Both Parties",
                        `Both owner and renter have accepted the charges for "${product?.name ?? "the product"}". Moderator can now assign a rider.`,
                        user,
                        request.rentalRequestId,
                        `/rentals/request/${request.rentalRequestId}`,
                    ),
                );
            }
        } else {
            request.ownerChargesAccepted = false;
            request.renterChargesAccepted = false;
            request.status = RentalRequestStatus.REJECTED;

            await this.notify(
                [
                    PUSHER_CHANNELS.OWNER(request.ownerId),
                    PUSHER_CHANNELS.RENTER(request.renterId),
                    PUSHER_CHANNELS.ADMIN_MODERATOR,
                ],
                PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_REJECTED,
                    "Charges Rejected",
                    `${user?.firstName ?? "A party"} rejected the proposed charges for "${product?.name ?? "the product"}".`,
                    user,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                ),
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
        );
    }

    // =====================================================
    // OWNER - REJECT AFTER APPROVAL
    // =====================================================

    async rejectAfterApproval(
        rentalRequestId: string,
        userId: string,
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
            throw new NotFoundException("Rental request not found");
        }

        if (request.ownerId !== userId) {
            throw new ForbiddenException("Only the product owner can reject this request");
        }

        if (request.status !== RentalRequestStatus.APPROVED) {
            throw new BadRequestException("Only approved requests can be rejected after approval");
        }

        const owner =
            await this.userRepository.findOne({ where: { userId } });

        const product =
            await this.productRepository.findOne({ where: { productId: request.productId } });

        request.status = RentalRequestStatus.REJECTED;

        const updatedRequest =
            await this.rentalRequestRepository.save(request);

        const notification = this.buildNotification(
            PusherNotificationType.RENTAL_REQUEST_REJECTED,
            "Rental Rejected After Approval",
            `The owner has rejected the rental for "${product?.name ?? "the product"}" after approval.`,
            owner,
            request.rentalRequestId,
            `/rentals/request/${request.rentalRequestId}`,
        );

        await this.notify(
            [
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ],
            PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
            notification,
        );

        return this.shapeRequest(updatedRequest);
    }

    // =====================================================
    // PARTY CHARGES - READ, RIDER COLLECTION, MODERATOR REVIEW
    // =====================================================

    async getRentalChargesForRequest(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<{
        rentalId: string;
        rentalRequestId: string;
        ownerChargesAccepted: boolean;
        renterChargesApproved: boolean;
        ownerRentalFee: string | null;
        ownerDeliveryFee: string | null;
        renterRentalFee: string | null;
        renterDeliveryFee: string | null;
        platformCommissionRate: string | null;
        status: RentalRequestStatus;
    }> {
        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException("Rental request not found");
        }

        const isParticipant =
            request.renterId === userId ||
            request.ownerId === userId;

        if (!isParticipant && !this.isModeratorOrAdmin(userRole)) {
            throw new ForbiddenException("You are not allowed to view these charges");
        }

        return {
            rentalId: "",
            rentalRequestId: request.rentalRequestId,
            ownerChargesAccepted: request.ownerChargesAccepted ?? false,
            renterChargesApproved: request.renterChargesAccepted ?? false,
            ownerRentalFee: request.ownerRentalFee ?? null,
            ownerDeliveryFee: request.ownerDeliveryFee ?? null,
            renterRentalFee: request.renterRentalFee ?? null,
            renterDeliveryFee: request.renterDeliveryFee ?? null,
            platformCommissionRate: request.platformCommissionRate ?? null,
            status: request.status,
        };
    }

    async getMyRentalChargeTasks(
        riderId: string,
    ): Promise<{
        chargeId: string;
        rentalId: string;
        rentalRequestId: string;
        amount: string;
        payerRole: string;
        type: string;
        status: string;
        rental: {
            rentalId: string;
            startDate: Date;
            endDate: Date;
            totalPayable: string;
            deliveryAddress: string;
            pickupAddress: string;
        };
    }[]> {
        const charges =
            await this.rentalChargeRepository.find({
                where: { collectedById: riderId },
                order: { createdAt: "DESC" },
            });

        const rentalIds = charges.map(c => c.rentalId);
        const rentals = await this.actualRentalRepository.find({
            where: rentalIds.length > 0
                ? { rentalId: In(rentalIds) }
                : {},
        });

        const rentalMap = new Map(rentals.map(r => [r.rentalId, r]));

        return charges.map((charge) => {
            const rental = rentalMap.get(charge.rentalId);
            return {
                chargeId: charge.chargeId,
                rentalId: charge.rentalId,
                rentalRequestId: charge.rentalRequestId,
                amount: charge.amount,
                payerRole: charge.payerRole,
                type: charge.type,
                status: charge.status,
                rental: rental
                    ? {
                        rentalId: rental.rentalId,
                        startDate: rental.startDate,
                        endDate: rental.endDate,
                        totalPayable: rental.totalPayable,
                        deliveryAddress: rental.deliveryAddress,
                        pickupAddress: rental.pickupAddress,
                    }
                    : {
                        rentalId: charge.rentalId,
                        startDate: new Date(),
                        endDate: new Date(),
                        totalPayable: "0",
                        deliveryAddress: "",
                        pickupAddress: "",
                    },
            };
        });
    }

    async recordRentalChargeCollection(
        chargeId: string,
        userId: string,
    ): Promise<RentalCharge> {
        const charge =
            await this.rentalChargeRepository.findOne({
                where: { chargeId },
            });

        if (!charge) {
            throw new NotFoundException("Charge not found");
        }

        if (charge.status !== "PENDING") {
            throw new BadRequestException("This charge cannot be collected anymore");
        }

        charge.status = RentalChargeStatus.SUBMITTED;
        charge.collectedById = userId;
        charge.collectedAt = new Date();

        const updatedCharge =
            await this.rentalChargeRepository.save(charge);

        return updatedCharge;
    }

    async reviewRentalChargeCollection(
        chargeId: string,
        userId: string,
        dto: ReviewRentalChargePaymentDto,
    ): Promise<RentalCharge> {
        const charge =
            await this.rentalChargeRepository.findOne({
                where: { chargeId },
            });

        if (!charge) {
            throw new NotFoundException("Charge not found");
        }

        if (charge.status !== "SUBMITTED") {
            throw new BadRequestException("This charge cannot be reviewed yet");
        }

        charge.status = dto.approved ? RentalChargeStatus.CONFIRMED : RentalChargeStatus.REJECTED;
        charge.verifiedById = userId;
        charge.verifiedAt = new Date();
        charge.verificationNote = dto.note ?? null;

        const updatedCharge =
            await this.rentalChargeRepository.save(charge);

        return updatedCharge;
    }

    // =====================================================
    // ACTUAL RENTAL CREATION (MODERATOR)
    // =====================================================

    async createActualRental(
        rentalRequestId: string,
        moderatorId: string,
    ): Promise<ActualRental> {
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
            throw new NotFoundException("Rental request not found");
        }

        if (request.status !== RentalRequestStatus.APPROVED) {
            throw new BadRequestException("Only approved requests can become actual rentals");
        }

        const existingRental =
            await this.actualRentalRepository.findOne({
                where: { rentalRequestId },
            });

        if (existingRental) {
            throw new ConflictException("A rental already exists for this request");
        }

        const agreedPricePerDay =
            Number(request.agreedPricePerDay ?? request.listedPricePerDay);

        const rentalAmount =
            agreedPricePerDay * request.rentalDays;

        const deliveryFee =
            Number(request.deliveryFee ?? 0);

        const platformCommissionRate = Number(
            request.platformCommissionRate ?? DEFAULT_PLATFORM_COMMISSION_RATE,
        );

        const platformCommissionAmount =
            (rentalAmount * platformCommissionRate) / 100;

        const totalPayable =
            rentalAmount + deliveryFee;

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
                queryRunner.manager.create(RentalStateHistory, {
                    rentalId: savedRental.rentalId,
                    status:
                        ActualRentalStatus.PENDING_HANDOVER,
                    note: "Rental created by moderator",
                    actorId: moderatorId,
                });

            await queryRunner.manager.save(stateHistory);
            await queryRunner.commitTransaction();

            const moderator =
                await this.userRepository.findOne({ where: { userId: moderatorId } });

            const product =
                await this.productRepository.findOne({
                    where: { productId: request.productId },
                });

            const notification =
                this.buildNotification(
                    PusherNotificationType.MANUAL_PAYMENT,
                    "Rental Created",
                    `A rental for "${product?.name ?? "the product"}" is now pending handover. Total payable: ${totalPayable.toFixed(2)}.`,
                    moderator,
                    request.rentalRequestId,
                    `/rentals/request/${request.rentalRequestId}`,
                );

            const channels: string[] = [
                PUSHER_CHANNELS.RENTER(request.renterId),
                PUSHER_CHANNELS.OWNER(request.ownerId),
                PUSHER_CHANNELS.ADMIN_MODERATOR,
            ];

            if (request.riderId) {
                channels.push(
                    `rider-${request.riderId}-channel`,
                );
            }

            await this.notify(
                channels,
                PUSHER_EVENTS.HANDOVER_VERIFICATION,
                notification,
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
    // GET ACTUAL RENTAL BY REQUEST
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
            throw new NotFoundException("No rental exists for this request yet");
        }

        const isParticipant =
            rental.renterId === userId ||
            rental.ownerId === userId ||
            rental.riderId === userId;

        if (
            !isParticipant &&
            !this.isModeratorOrAdmin(userRole)
        ) {
            throw new ForbiddenException("You are not allowed to view this rental");
        }

        return rental;
    }

    // =====================================================
    // RIDER - MY PAYMENT TASKS
    // =====================================================

    async getMyPaymentTasks(
        riderId: string,
    ): Promise<{
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
    }[]> {

        const payments =
            await this.rentalPaymentRepository
                .createQueryBuilder("payment")
                .innerJoinAndSelect(
                    ActualRental,
                    "rental",
                    "rental.rentalId = payment.rentalId",
                )
                .innerJoinAndSelect(
                    RentalRequest,
                    "request",
                    "request.rentalRequestId = payment.rentalRequestId",
                )
                .where("rental.riderId = :riderId", {
                    riderId,
                })
                .andWhere(
                    "payment.status IN (:...statuses)",
                    {
                        statuses: [
                            RentalPaymentStatus.PENDING,
                            RentalPaymentStatus.COLLECTED_BY_RIDER,
                        ],
                    },
                )
                .getMany();

        return payments.map((payment: any) => ({
            paymentId: payment.paymentId,
            rentalId: payment.rentalId,
            amount: payment.amount,
            method: payment.method,
            status: payment.status,
            rental: {
                rentalId: payment.rental.rentalId,
                startDate: payment.rental.startDate,
                endDate: payment.rental.endDate,
                totalPayable: payment.rental.totalPayable,
                deliveryAddress:
                    payment.rental.deliveryAddress,
                pickupAddress:
                    payment.rental.pickupAddress,
            },
            request: {
                productId: payment.request.productId,
                renterId: payment.request.renterId,
                ownerId: payment.request.ownerId,
                contactPhone:
                    payment.request.contactPhone,
            },
        }));
    }

    // =====================================================
    // MANUAL PAYMENT FLOW
    // =====================================================

    private async loadPaymentWithRental(paymentId: string): Promise<{
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

        if (rental.riderId) {
            if (rental.riderId !== userId) {
                throw new ForbiddenException(
                    "Only the assigned rider can collect this payment",
                );
            }
        } else if (rental.ownerId !== userId) {
            throw new ForbiddenException(
                "Only the owner can collect this payment",
            );
        }

        payment.status =
            RentalPaymentStatus.COLLECTED_BY_RIDER;

        payment.collectedById = userId;
        payment.collectedAt = new Date();

        const updatedPayment =
            await this.rentalPaymentRepository.save(payment);

        const actor =
            await this.userRepository.findOne({ where: { userId } });

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Cash Collected",
                `The rider has collected the cash payment of ${payment.amount}.`,
                actor,
            );

        const channels: string[] = [
            PUSHER_CHANNELS.RENTER(rental.renterId),
            PUSHER_CHANNELS.OWNER(rental.ownerId),
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

    async deliverManualPayment(
        paymentId: string,
        userId: string,
    ): Promise<RentalPayment> {

        const { payment, rental } =
            await this.loadPaymentWithRental(paymentId);

        if (payment.status !== RentalPaymentStatus.COLLECTED_BY_RIDER) {
            throw new BadRequestException("This payment cannot be delivered yet");
        }

        if (
            !rental.riderId ||
            rental.riderId !== userId
        ) {
            throw new ForbiddenException("Only the assigned rider can deliver this payment");
        }

        payment.status =
            RentalPaymentStatus.DELIVERED_TO_OWNER;

        payment.deliveredById = userId;
        payment.deliveredAt = new Date();

        const updatedPayment =
            await this.rentalPaymentRepository.save(payment);

        const rider =
            await this.userRepository.findOne({ where: { userId } });

        const notification =
            this.buildNotification(
                PusherNotificationType.MANUAL_PAYMENT,
                "Cash Delivered to Owner",
                `The rider has delivered the cash payment of ${payment.amount}. Please confirm that you received it.`,
                rider,
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
            throw new BadRequestException("This payment cannot be confirmed yet");
        }

        if (rental.ownerId !== userId) {
            throw new ForbiddenException("Only the product owner can confirm this payment");
        }

        payment.status = RentalPaymentStatus.CONFIRMED;
        payment.confirmedAt = new Date();

        const updatedPayment =
            await this.rentalPaymentRepository.save(payment);

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

            await this.productRepository.update(
                { productId: rental.productId },
                {
                    availabilityStatus:
                        ProductAvailabilityStatus.AVAILABLE,
                },
            );
        }

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
            throw new NotFoundException("No rental exists for this request yet");
        }

        const payment =
            await this.rentalPaymentRepository.findOne({
                where: { rentalId: rental.rentalId },
            });

        if (!payment) {
            throw new NotFoundException("Payment not found for this rental");
        }

        const isParticipant =
            rental.renterId === userId ||
            rental.ownerId === userId ||
            rental.riderId === userId;

        if (
            !isParticipant &&
            !this.isModeratorOrAdmin(userRole)
        ) {
            throw new ForbiddenException("You are not allowed to view this payment");
        }

        return {
            rentalId: rental.rentalId,
            riderId: rental.riderId ?? null,
            renterId: rental.renterId,
            ownerId: rental.ownerId,
            payment,
        };
    }

    async hasActiveRentalRequestForProduct(
        productId: string,
    ): Promise<boolean> {

        const count =
            await this.rentalRequestRepository.count({
                where: {
                    productId,
                    status:
                        ACTIVE_REQUEST_STATUSES as unknown as RentalRequestStatus,
                },
            });

        return count > 0;
    }

    // =====================================================
    // AUTO-CANCEL OTHER ACTIVE REQUESTS FOR PRODUCT
    // =====================================================

    private async cancelOtherRequestsForProduct(
        productId: string,
        acceptedRentalRequestId: string,
        productName: string,
        owner: User | null,
    ): Promise<void> {

        const allOpen =
            await this.rentalRequestRepository.find({
                where: {
                    productId,
                    status: ACTIVE_REQUEST_STATUSES as unknown as RentalRequestStatus,
                },
            });

        const toReject = allOpen.filter(
            (r) => r.rentalRequestId !== acceptedRentalRequestId,
        );

        if (toReject.length === 0) return;

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const req of toReject) {
                req.status = RentalRequestStatus.REJECTED;
                await queryRunner.manager.save(req);
            }

            await queryRunner.commitTransaction();

            for (const req of toReject) {
                const renter = await this.userRepository.findOne({
                    where: { userId: req.renterId },
                });

                const notification = this.buildNotification(
                    PusherNotificationType.RENTAL_REQUEST_REJECTED,
                    "Request Auto-Rejected",
                    `Your request for "${productName}" was auto-rejected because another request was accepted for the same product and dates.`,
                    renter,
                    req.rentalRequestId,
                    `/rentals/request/${req.rentalRequestId}`,
                );

                await this.notify(
                    [PUSHER_CHANNELS.RENTER(req.renterId)],
                    PUSHER_EVENTS.RENTAL_REQUEST_REJECTED,
                    notification,
                );
            }
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    // =====================================================
    // MODERATOR DASHBOARD STATS
    // =====================================================

    async getModeratorDashboardStats(): Promise<{
        totalRentals: number;
        activeRentals: number;
        pendingHandoverRentals: number;
        completedRentals: number;
        pendingReviews: number;
    }> {

        const totalRentals = await this.actualRentalRepository.count();
        const activeRentals = await this.actualRentalRepository.count({
            where: { status: ActualRentalStatus.ACTIVE },
        });
        const pendingHandoverRentals = await this.actualRentalRepository.count({
            where: { status: ActualRentalStatus.PENDING_HANDOVER },
        });
        const completedRentals = await this.actualRentalRepository.count({
            where: { status: ActualRentalStatus.COMPLETED },
        });
        const pendingReviews = await this.rentalRequestRepository.count({
            where: { status: RentalRequestStatus.PRICE_AGREED },
        });

        return {
            totalRentals,
            activeRentals,
            pendingHandoverRentals,
            completedRentals,
            pendingReviews,
        };
    }

    // =====================================================
    // CLEANUP COMPLETED RENTALS
    // =====================================================

    async cleanupCompletedRentals(): Promise<{
        deletedRentals: number;
        cutoffDate: Date;
    }> {

        const cutoffDate = new Date();
        cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30);

        const oldRentals =
            await this.actualRentalRepository.find({
                where: { status: ActualRentalStatus.COMPLETED },
            });

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
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(CheckpointMedia)
                .where("checkpointId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(HandoverCheckpoint)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(HandoverOtp)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from(RentalStateHistory)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            await queryRunner.manager.createQueryBuilder()
                .delete()
                .from(RentalPayment)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            await queryRunner.manager.createQueryBuilder()
                .delete()
                .from(ActualRental)
                .where("rentalId IN (:...rentalIds)", {
                    rentalIds,
                })
                .execute();

            await queryRunner.manager.createQueryBuilder()
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
    // ISSUE / DISPUTE WORKFLOW
    // =====================================================

    async createIssue(
        rentalRequestId: string,
        userId: string,
        dto: CreateIssueDto,
    ): Promise<RentalIssue> {
        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException("Rental request not found");
        }

        const isParticipant =
            request.renterId === userId ||
            request.ownerId === userId;

        if (!isParticipant) {
            throw new ForbiddenException(
                "Only the owner or renter can raise an issue for this rental",
            );
        }

        const issue =
            this.rentalIssueRepository.create({
                issueId: this.generateId("ISS"),
                rentalId: "",
                rentalRequestId,
                raisedById: userId,
                category: dto.category,
                severity: dto.severity ?? IssueSeverity.MEDIUM,
                title: dto.title,
                description: dto.description ?? null,
                evidenceReference: dto.evidenceReference ?? null,
                status: IssueStatus.OPEN,
            });

        return this.rentalIssueRepository.save(issue);
    }

    async getIssuesForRequest(
        rentalRequestId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<RentalIssue[]> {
        const request =
            await this.rentalRequestRepository.findOne({
                where: { rentalRequestId },
            });

        if (!request) {
            throw new NotFoundException("Rental request not found");
        }

        const isParticipant =
            request.renterId === userId ||
            request.ownerId === userId;

        if (
            !isParticipant &&
            !this.isModeratorOrAdmin(userRole)
        ) {
            throw new ForbiddenException(
                "You are not allowed to view issues for this rental",
            );
        }

        return this.rentalIssueRepository.find({
            where: { rentalRequestId },
            order: { createdAt: "DESC" },
        });
    }

    async respondToIssue(
        issueId: string,
        userId: string,
        dto: RespondToIssueDto,
    ): Promise<RentalIssue> {
        const issue =
            await this.rentalIssueRepository.findOne({
                where: { issueId },
            });

        if (!issue) {
            throw new NotFoundException("Issue not found");
        }

        if (issue.raisedById !== userId) {
            throw new ForbiddenException(
                "Only the user who raised the issue can respond to it",
            );
        }

        if (issue.status !== IssueStatus.OPEN) {
            throw new BadRequestException(
                "This issue is no longer open for responses",
            );
        }

        issue.description =
            (issue.description ?? "") +
            `\n\nResponse (${new Date().toISOString()}): ${dto.response}`;

        if (dto.evidenceReference) {
            issue.evidenceReference =
                (issue.evidenceReference ?? "") +
                `;${dto.evidenceReference}`;
        }

        return this.rentalIssueRepository.save(issue);
    }

    async decideIssue(
        issueId: string,
        userId: string,
        userRole: UserRole,
        dto: DecideIssueDto,
    ): Promise<RentalIssue> {
        const issue =
            await this.rentalIssueRepository.findOne({
                where: { issueId },
            });

        if (!issue) {
            throw new NotFoundException("Issue not found");
        }

        if (!this.isModeratorOrAdmin(userRole)) {
            throw new ForbiddenException(
                "Only moderators or admins can decide on an issue",
            );
        }

        issue.status = dto.status ?? IssueStatus.IN_REVIEW;
        issue.resolution = dto.resolution;
        issue.resolutionNote = dto.resolutionNote ?? null;
        issue.resolutionAmount = dto.resolutionAmount
            ? dto.resolutionAmount.toFixed(2)
            : null;
        issue.resolvedAt = new Date();
        issue.resolvedById = userId;

        if (dto.status === IssueStatus.RESOLVED) {
            issue.status = IssueStatus.RESOLVED;
        }

        return this.rentalIssueRepository.save(issue);
    }
}