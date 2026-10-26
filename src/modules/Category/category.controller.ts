import
{
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseInterceptors,
    ValidationPipe,
} from '@nestjs/common';

import { CategoryService } from '../Category/category-service'

import { createCategoryDto  } from '../Category/Dto/create-catagory-dto';
import { UpdateCategoryDto } from '../Category/Dto/update-category.dto';
import { UsePipes } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { MulterError } from 'multer';
import { UploadedFile } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { UserRole } from '../users/enums/user-role-enum';
import { RolesGuard } from 'src/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { PaginationDto } from '../pagination/pagination-dto';
import { Query } from '@nestjs/common'

@Controller('categories')
export class CategoryController
{
    constructor(
        private readonly categoryService: CategoryService,
    )
    {
    }

    /*
     * Shared validation options for
     * all category write endpoints.
     */

    private static readonly categoryValidationPipe =
        new ValidationPipe(
            {
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            },
        );

    /*
     * Shared image upload rules.
     * Category images:
     * - must be jpg/jpeg/png/webp
     * - must not exceed 2 MB
     * - are stored in ./uploads/category
     */

    private static readonly categoryImageInterceptor =
        FileInterceptor(
            'image',
            {
                fileFilter: (req, file, cb) =>
                {
                    if (
                        file.originalname.match(
                            /^.*\.(jpg|jpeg|png|webp)$/i,
                        )
                    )
                    {
                        cb(
                            null,
                            true,
                        );
                    }
                    else
                    {
                        cb(
                            new MulterError(
                                'LIMIT_UNEXPECTED_FILE',
                                file.fieldname,
                            ),
                            false,
                        );
                    }
                },

                limits:
                {
                    fileSize: 2 * 1024 * 1024,
                },

                storage: diskStorage(
                    {
                        destination:
                            './uploads/category',

                        filename: (
                            req,
                            file,
                            cb,
                        ) =>
                        {
                            const safeName = file.originalname
                                .replace(
                                    /\s+/g,
                                    '_',
                                )
                                .replace(
                                    /[^a-zA-Z0-9._-]/g,
                                    '',
                                );

                            cb(
                                null,
                                Date.now() +
                                '_' +
                                safeName,
                            );
                        },
                    },
                ),
            },
        );

    @UsePipes(CategoryController.categoryValidationPipe)


@Post('create')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN,UserRole.MODERATOR)
@UseInterceptors(CategoryController.categoryImageInterceptor)
async create(
    @Body() createCategoryDto: createCategoryDto,
    @UploadedFile() image?: Express.Multer.File,
)
{
    return await this.categoryService.create(
        createCategoryDto,
        image,
    );
}


  @Get()
async findAll(
    @Query() paginationDto: PaginationDto,
)
{
    return await this.categoryService.findAll(
        paginationDto,
    );
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
    @UsePipes(CategoryController.categoryValidationPipe)

  
    @Patch(':categoryId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN,UserRole.MODERATOR)
    @UseInterceptors(CategoryController.categoryImageInterceptor)
    async update(
        @Param('categoryId') categoryId: string,
        @Body() updateCategoryDto: UpdateCategoryDto,
        @UploadedFile() image?: Express.Multer.File,
    )
    {
        return await this.categoryService.update(
            categoryId,
            updateCategoryDto,
            image,
        );
    }

    @Delete(':categoryId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN,UserRole.MODERATOR)
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


    @Patch(':categoryId/activate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN,UserRole.MODERATOR)
    async activateCategory(
        @Param('categoryId') categoryId: string,
    )
    {
        return await this.categoryService.activateCategory(
            categoryId,
        );
    }

    @Patch(':categoryId/deactivate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN,UserRole.MODERATOR)
    async deactivateCategory(
        @Param('categoryId') categoryId: string,
    )
    {
        return await this.categoryService.deactiveCategory(
            categoryId,
        );
    }
}
