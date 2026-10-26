import {
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    MaxLength,
} from "class-validator";

import { RentalChargePaymentMethod } from "../entity/rental-charge.entity";

export class SubmitRentalChargePaymentDto {
    @IsEnum(RentalChargePaymentMethod)
    paymentMethod!: RentalChargePaymentMethod;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    paymentReference?: string;
}

export class ReviewRentalChargePaymentDto {
    @IsBoolean()
    approved!: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}
