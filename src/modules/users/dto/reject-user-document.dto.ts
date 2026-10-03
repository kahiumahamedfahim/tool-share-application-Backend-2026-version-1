import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectUserDocumentDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason!: string;
}