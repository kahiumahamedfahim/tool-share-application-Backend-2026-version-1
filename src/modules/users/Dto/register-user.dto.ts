import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty({
    message: 'First name is required.',
  })
  @IsString({
    message: 'First name must be a string.',
  })
  @Length(2, 50, {
    message: 'First name must be between 2 and 50 characters.',
  })
  @Matches(/^[A-Za-z]+$/, {
    message: 'First name can contain only letters.',
  })
  firstName!: string;

  @IsNotEmpty({
    message: 'Last name is required.',
  })
  @IsString({
    message: 'Last name must be a string.',
  })
  @Length(2, 50, {
    message: 'Last name must be between 2 and 50 characters.',
  })
  @Matches(/^[A-Za-z]+$/, {
    message: 'Last name can contain only letters.',
  })
  lastName!: string;

  @IsNotEmpty({
    message: 'Email is required.',
  })
  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address.',
    },
  )
  email!: string;

  @IsNotEmpty({
    message: 'Phone number is required.',
  })
  @Matches(/^01[3-9]\d{8}$/, {
    message: 'Please enter a valid Bangladeshi phone number.',
  })
  phone!: string;

  @IsNotEmpty({
    message: 'Password is required.',
  })
  @IsString({
    message: 'Password must be a string.',
  })
  @Length(8, 30, {
    message: 'Password must be between 8 and 30 characters.',
  })
  password!: string;

  @IsNotEmpty({
    message: 'NID number is required.',
  })
  @IsString({
    message: 'NID number must be a string.',
  })
  @Matches(/^(\d{10}|\d{13}|\d{17})$/, {
    message: 'NID number must contain 10, 13, or 17 digits.',
  })
  nidNumber!: string;
}