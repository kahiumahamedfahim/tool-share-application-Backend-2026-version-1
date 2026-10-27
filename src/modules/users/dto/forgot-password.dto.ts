import { IsString, IsNotEmpty, IsEmail, MinLength } from "class-validator";

export class ForgotPasswordDto {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email!: string;
}

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @IsNotEmpty()
    verificationCode!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword!: string;
}
