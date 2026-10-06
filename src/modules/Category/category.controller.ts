import
{
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    ValidationPipe,
} from '@nestjs/common';

import { CategoryService } from '../Category/category-service'

import { createCategoryDto  } from '../Category/Dto/create-catagory-dto';
import { UpdateCategoryDto } from '../Category/Dto/update-category.dto';
import { UsePipes } from '@nestjs/common';

@Controller('categories')
export class CategoryController
{
    constructor(
        private readonly categoryService: CategoryService,
    )
    {
    }
    @UsePipes(new ValidationPipe())
    @Post()
    async create(
        @Body() createCategoryDto: createCategoryDto,
    )
    {
        return await this.categoryService.create(
            createCategoryDto,
        );
    }

    @Get()
    async findAll()
    {
        return await this.categoryService.findAll();
    }

    @Get(':categoryId')
    async findOne(
        @Param('categoryId') categoryId: string,
    )
    {
        return await this.categoryService.findOne(
            categoryId,
        );
    }
    @UsePipes(new ValidationPipe())

    @Patch(':categoryId')
    async update(
        @Param('categoryId') categoryId: string,
        @Body() updateCategoryDto: UpdateCategoryDto,
    )
    {
        return await this.categoryService.update(
            categoryId,
            updateCategoryDto,
        );
    }

    @Delete(':categoryId')
    async remove(
        @Param('categoryId') categoryId: string,
    )
    {
        await this.categoryService.remove(
            categoryId,
        );

        return {
            message: 'Category deleted successfully',
        };
    }
}