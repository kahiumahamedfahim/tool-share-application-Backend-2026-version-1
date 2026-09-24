import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class LoginDto {
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
    message: 'Password is required.',
  })
  @IsString({
    message: 'Password must be a string.',
  })
  @Length(8, 30, {
    message: 'Password must be between 8 and 30 characters.',
  })
  password!: string;
}