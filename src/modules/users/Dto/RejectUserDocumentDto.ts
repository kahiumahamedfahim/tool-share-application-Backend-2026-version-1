import {
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class RejectUserDocumentDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  @Length(5, 500)
  rejectionReason!: string;
}