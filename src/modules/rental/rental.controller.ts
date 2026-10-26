import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';

import { RentalService } from './rental.service';

// DTOs
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { CreateNegotiationOfferDto } from './dto/create-negotiation-offer.dto';
import { UpdateNegotiationOfferDto } from './dto/update-negotiation-offer.dto';
import { OwnerRentalRequestActionDto } from './dto/owner-rental-request-action.dto';
import { ReviewRentalRequestDto } from './dto/ReviewRentalRequestDto';
import { ReviewRentalChargePaymentDto } from './dto/rental-charge.dto';
import {
    ModeratorPickupReviewDto,
    ModeratorReturnReviewDto,
} from './dto/ReviewRentalRequestDto';

// Guards / Roles
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/roles.guard';
import { Roles } from 'src/auth/roles.decorator';

// Authenticated request
import type { AuthenticatedRequest } from 'src/auth/authenticated-request';

// User role
import { UserRole } from '../users/enums/user-role-enum';

// Pagination
import { PaginationDto } from 'src/modules/pagination/pagination-dto';

@Controller('rentals')
export class RentalController {
    constructor(
        private readonly rentalService: RentalService,
    ) {}

    // =====================================================
    // CREATE RENTAL REQUEST
    // =====================================================

    @Post('request')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async createRentalRequest(
        @Body() dto: CreateRentalRequestDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const renterId = req.user.userId;

        return this.rentalService.createRentalRequest(
            dto,
            renterId,
        );
    }

    // =====================================================
    // OWNER - GET RENTAL REQUESTS
    // =====================================================

 @Get('owner/requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
@UsePipes(
    new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }),
)
async getOwnerRentalRequests(
    @Req() req: AuthenticatedRequest,
    @Query() pagination: PaginationDto,
) {
    const ownerId = req.user.userId;

    return this.rentalService.getOwnerRentalRequests(
        ownerId,
        pagination,
    );
}

    // =====================================================
    // RENTER - GET MY RENTAL REQUESTS
    // =====================================================

    @Get('my-requests')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    async getRenterRentalRequests(
        @Req() req: AuthenticatedRequest,
        @Query() pagination: PaginationDto,
    ) {
        const renterId = req.user.userId;

        return this.rentalService.getRenterRentalRequests(
            renterId,
            pagination,
        );
    }

    // =====================================================
    // RENTER - GET MY ACTIVE REQUEST FOR PRODUCT
    // =====================================================

    @Get('my-requests/active/:productId')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    async getRenterActiveRequestForProduct(
        @Param('productId') productId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const renterId = req.user.userId;

        return this.rentalService.getRenterActiveRequestForProduct(
            productId,
            renterId,
        );
    }

    // =====================================================
    // GET RENTAL REQUEST DETAILS
    // Moderators/Admins also access this to review.
    // =====================================================

    @Get('request/:rentalRequestId')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.USER,
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    async getRentalRequestById(
        @Param('rentalRequestId') rentalRequestId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const userId = req.user.userId;
        const userRole = req.user.role;

        return this.rentalService.getRentalRequestById(
            rentalRequestId,
            userId,
            userRole,
        );
    }

    // =====================================================
    // OWNER - ACCEPT / REJECT RENTAL REQUEST
    // =====================================================

    @Patch(':rentalRequestId/status')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async updateRentalRequestStatus(
        @Param('rentalRequestId') rentalRequestId: string,
        @Body() dto: OwnerRentalRequestActionDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const ownerId = req.user.userId;

        return this.rentalService.updateRentalRequestStatus(
            rentalRequestId,
            ownerId,
            dto.action,
        );
    }

    // =====================================================
    // CREATE NEGOTIATION OFFER
    // =====================================================

    @Post('negotiation/offer')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async createNegotiationOffer(
        @Body() dto: CreateNegotiationOfferDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const senderId = req.user.userId;

        return this.rentalService.createNegotiationOffer(
            dto,
            senderId,
        );
    }

    // =====================================================
    // GET NEGOTIATION HISTORY
    // =====================================================

    @Get('negotiation/:rentalRequestId')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.USER,
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    async getNegotiationHistory(
        @Param('rentalRequestId') rentalRequestId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const userId = req.user.userId;
        const userRole = req.user.role;

        return this.rentalService.getNegotiationHistory(
            rentalRequestId,
            userId,
            userRole,
        );
    }

    // =====================================================
    // ACCEPT / REJECT NEGOTIATION OFFER
    // =====================================================

    @Patch('negotiation/offer/:offerId')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async updateNegotiationOffer(
        @Param('offerId') offerId: string,
        @Body() dto: UpdateNegotiationOfferDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const responderId = req.user.userId;

        return this.rentalService.updateNegotiationOffer(
            offerId,
            responderId,
            dto.action,
        );
    }

    // =====================================================
    // MODERATOR - GET PRICE AGREED REQUESTS
    // =====================================================

    @Get('moderator/requests')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.ADMIN,
        UserRole.MODERATOR,
    )
    async getModeratorRentalRequests(
        @Query() pagination: PaginationDto,
    ) {
        return this.rentalService.getModeratorRentalRequests(
            pagination,
        );
    }

    // =====================================================
    // MODERATOR - CREATE ACTUAL RENTAL (PHASE 11)
    // =====================================================

    @Post(
        'moderator/request/:rentalRequestId/create-rental',
    )
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.ADMIN,
        UserRole.MODERATOR,
    )
    async createActualRental(
        @Param('rentalRequestId') rentalRequestId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const moderatorId = req.user.userId;

        return this.rentalService.createActualRental(
            rentalRequestId,
            moderatorId,
        );
    }

    // =====================================================
    // GET ACTUAL RENTAL FOR A REQUEST
    // =====================================================

    @Get('rental/request/:rentalRequestId')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.USER,
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    async getActualRentalByRequest(
        @Param('rentalRequestId') rentalRequestId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const userId = req.user.userId;
        const userRole = req.user.role;

        return this.rentalService.getActualRentalByRequest(
            rentalRequestId,
            userId,
            userRole,
        );
    }

    // =====================================================
    // MODERATOR - APPROVE / REJECT REQUEST
    // =====================================================

    @Patch(
        'moderator/request/:rentalRequestId/review',
    )
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.ADMIN,
        UserRole.MODERATOR,
    )
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async reviewRentalRequest(
        @Param('rentalRequestId') rentalRequestId: string,
        @Body() dto: ReviewRentalRequestDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const moderatorId = req.user.userId;

        return this.rentalService.reviewRentalRequest(
            rentalRequestId,
            moderatorId,
            dto,
        );
    }

    // =====================================================
    // MODERATOR - RECEIVING (PICKUP) CONDITION REVIEW
    // =====================================================

    @Patch(
        'moderator/request/:rentalRequestId/pickup-review',
    )
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.ADMIN,
        UserRole.MODERATOR,
    )
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async reviewRentalRequestPickup(
        @Param('rentalRequestId') rentalRequestId: string,
        @Body() dto: ModeratorPickupReviewDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const moderatorId = req.user.userId;

        return this.rentalService.reviewRentalRequestPickup(
            rentalRequestId,
            moderatorId,
            dto,
        );
    }

    // =====================================================
    // MODERATOR - RETURN CONDITION REVIEW
    // =====================================================

    @Patch(
        'moderator/request/:rentalRequestId/return-review',
    )
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.ADMIN,
        UserRole.MODERATOR,
    )
    @UsePipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    )
    async reviewRentalRequestReturn(
        @Param('rentalRequestId') rentalRequestId: string,
        @Body() dto: ModeratorReturnReviewDto,
        @Req() req: AuthenticatedRequest,
    ) {
        const moderatorId = req.user.userId;

        return this.rentalService.reviewRentalRequestReturn(
            rentalRequestId,
            moderatorId,
            dto,
        );
    }

    // =====================================================
    // RIDER - MY CASH PAYMENT TASKS
    // =====================================================

    @Get('my-payment-tasks')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER)
    async getMyPaymentTasks(
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.getMyPaymentTasks(
            req.user.userId,
        );
    }

    // =====================================================
    // MANUAL PAYMENT - COLLECT (RIDER OR OWNER)
    // =====================================================

    @Patch('payment/:paymentId/collect')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER, UserRole.USER)
    async collectManualPayment(
        @Param('paymentId') paymentId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.collectManualPayment(
            paymentId,
            req.user.userId,
        );
    }

    // =====================================================
    // MANUAL PAYMENT - DELIVER TO OWNER
    // =====================================================

    @Patch('payment/:paymentId/deliver')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.RIDER)
    async deliverManualPayment(
        @Param('paymentId') paymentId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.deliverManualPayment(
            paymentId,
            req.user.userId,
        );
    }

    // =====================================================
    // MANUAL PAYMENT - OWNER CONFIRM
    // =====================================================

    @Patch('payment/:paymentId/confirm')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(UserRole.USER)
    async confirmManualPayment(
        @Param('paymentId') paymentId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.confirmManualPayment(
            paymentId,
            req.user.userId,
        );
    }

    // =====================================================
    // GET MANUAL PAYMENT FOR A REQUEST
    // =====================================================

    @Get('payment/request/:rentalRequestId')
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.USER,
        UserRole.MODERATOR,
        UserRole.ADMIN,
    )
    async getPaymentByRentalRequest(
        @Param('rentalRequestId') rentalRequestId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        const userId = req.user.userId;
        const userRole = req.user.role;

        return this.rentalService.getPaymentByRentalRequest(
            rentalRequestId,
            userId,
            userRole,
        );
    }

    // =====================================================
    // PARTY CHARGES - READ, RIDER COLLECTION, MODERATOR REVIEW
    // =====================================================

    @Get('charges/request/:rentalRequestId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.USER, UserRole.RIDER, UserRole.MODERATOR, UserRole.ADMIN)
    async getRentalChargesForRequest(
        @Param('rentalRequestId') rentalRequestId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.getRentalChargesForRequest(
            rentalRequestId,
            req.user.userId,
            req.user.role,
        );
    }

    @Get('my-charge-collection-tasks')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.RIDER)
    async getMyRentalChargeTasks(@Req() req: AuthenticatedRequest) {
        return this.rentalService.getMyRentalChargeTasks(req.user.userId);
    }

    @Post('charge/:chargeId/collect')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.RIDER)
    async recordRentalChargeCollection(
        @Param('chargeId') chargeId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.recordRentalChargeCollection(
            chargeId,
            req.user.userId,
        );
    }

    @Patch('charge/:chargeId/review')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.MODERATOR, UserRole.ADMIN)
    @UsePipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }))
    async reviewRentalChargeCollection(
        @Param('chargeId') chargeId: string,
        @Body() dto: ReviewRentalChargePaymentDto,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.rentalService.reviewRentalChargeCollection(
            chargeId,
            req.user.userId,
            dto,
        );
    }
}
