import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminDto {
  // -------------------------
  // Account Information
  // -------------------------

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+8801|01)[3-9]\d{8}$/, {
    message: 'Please provide a valid Bangladeshi phone number',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  // -------------------------
  // Document Information
  // -------------------------

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nidNumber!: string;
}