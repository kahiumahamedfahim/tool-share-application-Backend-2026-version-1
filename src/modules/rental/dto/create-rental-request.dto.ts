import {
    IsDateString,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    Max,
} from "class-validator";

export class CreateRentalRequestDto {

    // =========================
    // Product
    // =========================

    @IsString()
    @IsNotEmpty()
    productId!: string;

    // =========================
    // Rental Schedule
    // =========================

    @IsDateString()
    @IsNotEmpty()
    startDate!: string;

    @IsNumber()
    @Min(1)
    rentalDays!: number;

    // =========================
    // Delivery Location
    // =========================

    @IsString()
    @IsNotEmpty()
    deliveryAddress!: string;

    @IsNumber()
    @Min(-90)
    @Max(90)
    deliveryLatitude!: number;

    @IsNumber()
    @Min(-180)
    @Max(180)
    deliveryLongitude!: number;

    // =========================
    // Contact
    // =========================

    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    contactPhone!: string;

    // =========================
    // Optional Message
    // =========================

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    renterMessage?: string;

    // =========================
    // Initial Negotiation
    // =========================

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    offeredPricePerDay?: number;
}