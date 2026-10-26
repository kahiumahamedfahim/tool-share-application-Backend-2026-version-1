import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsString,
    Min,
    Max,
} from "class-validator";

export enum ModeratorRentalRequestAction {
    APPROVE = "APPROVE",
    REJECT = "REJECT",
}

export class ReviewRentalRequestDto {

    @IsEnum(ModeratorRentalRequestAction)
    @IsNotEmpty()
    action!: ModeratorRentalRequestAction;

    // ==========================================
    // Delivery fee set manually by the
    // moderator (APPROVE only).
    // ==========================================

    @IsOptional()
    @IsNumber()
    @Min(0)
    deliveryFee?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    ownerRentalFee?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    ownerDeliveryFee?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    renterRentalFee?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    renterDeliveryFee?: number;

    // ==========================================
    // Platform commission percentage set
    // by the moderator (APPROVE only).
    // Policy default: 10% of rental amount.
    // ==========================================

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    platformCommissionRate?: number;

    // ==========================================
    // Rider assigned by the moderator
    // (APPROVE only, optional userId).
    // ==========================================

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    riderId?: string;
}

export class ModeratorPickupReviewDto {

    @IsNotEmpty()
    pickupConditionApproved!: boolean;

    @IsOptional()
    @IsString()
    pickupReviewNote?: string;
}

export class ModeratorReturnReviewDto {

    @IsNotEmpty()
    returnConditionApproved!: boolean;

    @IsOptional()
    @IsString()
    returnReviewNote?: string;
}
