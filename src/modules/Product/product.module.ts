import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Product } from "./Entity/product.entity";
import { ProductImage } from "./Entity/product-image.entity";
import { ProductDocument } from "./Entity/product-document.entity";
import { ProductLocation } from "./Entity/product-location.entity";

import { Category } from "../Category/category.entity";

import { ProductController } from "../Product/product-controller";
import { ProductService } from "./product.service";

import { AuthModule } from "src/auth/auth-module";
import { RentalModule } from "../rental/rental.module";


@Module({
    imports: [
        TypeOrmModule.forFeature([
            Product,
            ProductImage,
            ProductDocument,
            ProductLocation,
            Category,
        ]),

        AuthModule,
        RentalModule,
    ],

    controllers: [
        ProductController,
    ],

    providers: [
        ProductService,
    ],

    exports: [
        ProductService,
    ],
})
export class ProductModule {}