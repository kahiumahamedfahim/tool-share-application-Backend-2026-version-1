import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendVerificationCodeDto {

  @IsEmail()
  @IsNotEmpty()
  email!: string;

}