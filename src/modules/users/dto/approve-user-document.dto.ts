import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApproveUserDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  userId!: string;
}