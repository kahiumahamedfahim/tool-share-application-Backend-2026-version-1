import { IsOptional, IsString, IsNotEmpty, MaxLength } from "class-validator";

export class UpdateMyProfileDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    firstName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    lastName?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    phone?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    address?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    latitude?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    longitude?: string;
}
