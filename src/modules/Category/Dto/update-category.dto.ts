import
{
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { CategoryStatus } from '../Enums/category.enum';

export class UpdateCategoryDto
{
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(CategoryStatus)
    status?: CategoryStatus;
}
