
import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsNumber,
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
