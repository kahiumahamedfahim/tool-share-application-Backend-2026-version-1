import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class AcceptUserDocumentDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;
}