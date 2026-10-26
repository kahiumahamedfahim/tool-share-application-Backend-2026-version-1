import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { Category } from '../Category/category.entity';
import { Product } from '../Product/Entity/product.entity';

import { CategoryService } from '../Category/category-service';
import { CategoryController } from './category.controller';
import { AuthModule } from 'src/auth/auth-module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Category,
            Product,
        ]),
         AuthModule,
    ],

    controllers: [
        CategoryController,
    ],

    providers: [
        CategoryService,
    ],

    exports: [
        CategoryService,
    ],
})
export class CategoryModule
{
}