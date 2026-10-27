import { IsString, IsNotEmpty, MinLength } from "class-validator";

export class UpdateMyPasswordDto {
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    currentPassword!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    confirmPassword!: string;
}
