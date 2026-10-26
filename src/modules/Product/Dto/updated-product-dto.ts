import { PartialType } from "@nestjs/mapped-types";
import {
    IsArray,
    IsEnum,
    IsOptional,
    IsUUID,
} from "class-validator";
import { Transform } from "class-transformer";

import { CreateProductDto } from "./create-product.dto";
import { ProductAvailabilityStatus } from "../enum/productavailabilityStatus.enum";

export class UpdateProductDto extends PartialType(
    CreateProductDto,
) {
    @IsOptional()
    @IsEnum(ProductAvailabilityStatus)
    availabilityStatus?: ProductAvailabilityStatus;

    @IsOptional()
    @Transform(({ value }) => {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return undefined;
        }

        return Array.isArray(value)
            ? value
            : [value];
    })
    @IsArray()
    @IsUUID("4", { each: true })
    deleteImageIds?: string[];

    @IsOptional()
    @Transform(({ value }) => {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return undefined;
        }

        return Array.isArray(value)
            ? value
            : [value];
    })
    @IsArray()
    @IsUUID("4", { each: true })
    deleteDocumentIds?: string[];
}