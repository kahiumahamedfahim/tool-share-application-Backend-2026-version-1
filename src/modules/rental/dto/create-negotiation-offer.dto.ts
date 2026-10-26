import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from "class-validator";

export class CreateNegotiationOfferDto {

    @IsString()
    @IsNotEmpty()
    rentalRequestId!: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.01)
    offeredPricePerDay!: number;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    message?: string;
}