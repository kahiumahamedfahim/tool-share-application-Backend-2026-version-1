
import {
    IsBoolean,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    Max,
} from "class-validator";

import { Type, Transform } from "class-transformer";

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    name!: string;

    @IsString()
    @IsNotEmpty()
    description!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    categoryId!: string;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    pricePerDay!: number;

    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean()
    negotiationAllowed!: boolean;

    // Rental duration policy

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(30)
    minRentalDays!: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(30)
    maxRentalDays!: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(30)
    preparationBufferDays!: number;

    @Transform(({ value }) => {
        if (value === true || value === "true") return true;
        if (value === false || value === "false") return false;
        return value;
    })
    @IsBoolean()
    allowSameDayRental!: boolean;

    // =====================================================
    // Owner-chosen date windows (ISO date strings)
    // rentalWindow: when the product may be rented
    // deliveryWindow: when owner hands product to rider
    // returnWindow: when product must be back with owner
    // =====================================================

    @IsOptional()
    @IsDateString()
    rentalWindowStart?: string;

    @IsOptional()
    @IsDateString()
    rentalWindowEnd?: string;

    @IsOptional()
    @IsDateString()
    deliveryWindowStart?: string;

    @IsOptional()
    @IsDateString()
    deliveryWindowEnd?: string;

    @IsOptional()
    @IsDateString()
    returnWindowStart?: string;

    @IsOptional()
    @IsDateString()
    returnWindowEnd?: string;

    // Platform fee percentage per day (default 10)
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    platformFeePercentage?: number;

    // Base delivery fee (default 0)
    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    deliveryFeeBase?: number;

    // Pickup location

    @Type(() => Number)
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude!: number;

    @Type(() => Number)
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude!: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    division!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    district!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    upazila!: string;

    @IsString()
    @IsNotEmpty()
    pickupAddress!: string;
}
