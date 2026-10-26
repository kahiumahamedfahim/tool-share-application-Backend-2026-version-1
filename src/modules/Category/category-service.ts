import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { Category } from "./category.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { createCategoryDto } from "./Dto/create-catagory-dto";
import { UpdateCategoryDto } from "./Dto/update-category.dto";
import { CategoryStatus } from "./Enums/category.enum";
import { PaginationDto } from "../pagination/pagination-dto";
import { Product } from "../Product/Entity/product.entity";
import { join } from "path";
import { promises as fsPromises } from "fs";

@Injectable()
export class CategoryService
{
     constructor(
        @InjectRepository(Category)
        private readonly categoryRepository : Repository<Category>,

        @InjectRepository(Product)
        private readonly productRepository : Repository<Product>
     )
     {

     }

     /*
      * Normalizes a category name:
      * - trims leading/trailing whitespace
      * - collapses repeated inner whitespace to a single space
      */
     private normalizeCategoryName(name : string) : string
     {
        return name.trim().replace(/\s+/g, ' ');
     }

     /*
      * Finds another category that already uses this name
      * (case-insensitive), optionally excluding a category id.
      */
     private async findDuplicateCategoryName(
        categoryName : string,
        excludeCategoryId? : string,
     ) : Promise<Category | null>
     {
        const normalizedName = this.normalizeCategoryName(categoryName);

        if (!normalizedName)
        {
            return null;
        }

        const candidate = await this.categoryRepository
            .createQueryBuilder('category')
            .where('LOWER(category.name) = LOWER(:name)', { name: normalizedName })
            .getOne();

        if (candidate && candidate.categoryId !== excludeCategoryId)
        {
            return candidate;
        }

        return null;
     }

     /*
      * Deletes a category image file from disk (best effort).
      */
     private async deleteCategoryImageFile(imageName : string | null) : Promise<void>
     {
        if (!imageName)
        {
            return;
        }

        try
        {
            await fsPromises.unlink(
                join(process.cwd(), 'uploads', 'category', imageName),
            );
        }
        catch
        {
            // File may already be missing; deletion is best effort only.
        }
     }
     private async genateredCategoryId() : Promise<string>
     {
       const categories= await this.categoryRepository.find(
        {
            select : 
            {
                categoryId: true ,
            }
        }
       );
       if(categories.length==0)
       {
        return 'CAT-001';
       }
       let lastNumber=0;
       for (const category of categories)
       {
        const currentNumber= parseInt(category.categoryId.replace('CAT-', ''),10);
        if(currentNumber>lastNumber)
        {
            lastNumber=currentNumber;
        }
       }
       const nextNumber= lastNumber+1;
       return `CAT-${nextNumber
        .toString()
        .padStart(3, '0')}`;

     }
     async create(createCategoryDto : createCategoryDto,
        image?: Express.Multer.File,
     ): Promise<any>
     {
        const normalizedName = this.normalizeCategoryName(createCategoryDto.name);

        if (!normalizedName)
        {
            throw new BadRequestException('Category name is required');
        }

        const exisitngCategory = await this.findDuplicateCategoryName(normalizedName);

        if(exisitngCategory)
        {
            throw new ConflictException('category with this name is already exists');
        }        const categoryId= await this.genateredCategoryId();
        let imageName : string | null = null;
        if(image)
        {
            imageName=image.filename;
        }
      const category = this.categoryRepository.create(
    {
        categoryId: categoryId,
        name: normalizedName,
        description: createCategoryDto.description,
        image: imageName,
    }
);
        return await this.categoryRepository.save(category);

     }
     async findAll(
    paginationDto: PaginationDto,
): Promise<any>
{
    const page =
        paginationDto.page;

    const limit =
        paginationDto.limit;

    const skip =
        (page - 1) * limit;

    const [categories, total] =
        await this.categoryRepository.findAndCount(
            {
                order:
                {
                    createdAt: 'DESC',
                },

                skip: skip,

                take: limit,
            },
        );

    const totalPages =
        Math.ceil(
            total / limit,
        );

    return {
        data: categories,

        meta:
        {
            page: page,
            limit: limit,
            total: total,
            totalPages: totalPages,
        },
    };
}

     async findOne(categoryId: string): Promise<Category>
     {
        const category= await this.categoryRepository.findOne(
            {
                where : 
                {
                    categoryId:categoryId
                }
            }
        );
        if(!category)
        {
            throw new NotFoundException(`category ${categoryId} not found`);
        }
        return category;
     }

    async update(
    categoryId: string,
    updateCategoryDto: UpdateCategoryDto,
    image?: Express.Multer.File,
): Promise<Category>
{
    const category =
        await this.findOne(
            categoryId,
        );

    if (updateCategoryDto.name)
    {
        const normalizedName = this.normalizeCategoryName(
            updateCategoryDto.name,
        );

        if (!normalizedName)
        {
            throw new BadRequestException(
                'Category name is required',
            );
        }

        const existingCategory =
            await this.findDuplicateCategoryName(
                normalizedName,
                categoryId,
            );

        if (existingCategory)
        {
            throw new ConflictException(
                'Category with this name already exists',
            );
        }

        category.name =
            normalizedName;
    }

    if (
        updateCategoryDto.description !==
        undefined
    )
    {
        category.description =
            updateCategoryDto.description;
    }

    if (
        updateCategoryDto.status !==
        undefined
    )
    {
        category.status =
            updateCategoryDto.status;
    }

    let previousImage : string | null = null;

    if (image)
    {
        previousImage = category.image;

        category.image =
            image.filename;
    }

    const updatedCategory =
        await this.categoryRepository.save(
            category,
        );

    /*
     * Remove the replaced image file
     * so old uploads do not accumulate.
     */

    if (previousImage)
    {
        await this.deleteCategoryImageFile(previousImage);
    }

    return updatedCategory;
}

async remove(
    categoryId: string,
): Promise<void>
{
    const category =
        await this.findOne(categoryId);

    /*
     * A category that is referenced by
     * products cannot be deleted. It
     * must be deactivated instead.
     */

    const productsCount =
        await this.productRepository.count(
            {
                where: {
                    categoryId,
                },
            },
        );

    if (productsCount > 0)
    {
        throw new ConflictException(
            `This category is used by ${productsCount} product(s) and cannot be deleted. Deactivate it instead.`,
        );
    }

    await this.categoryRepository.remove(category);

    await this.deleteCategoryImageFile(category.image);
}


async activateCategory(categoryId: string): Promise<Category>
{
    const category= await this.findOne(categoryId);
    if(category.status==CategoryStatus.ACTIVE)
    {
        throw new ConflictException("category is already activated");
    }
    category.status=CategoryStatus.ACTIVE;
    return await this.categoryRepository.save(category);
}
async deactiveCategory(categoryId: string): Promise<Category>
{
    const category= await this.findOne(categoryId);
    if(category.status===CategoryStatus.INACTIVE)
    {
        throw new ConflictException("category is already deactivate");
    }
    category.status=CategoryStatus.INACTIVE;
    return await this.categoryRepository.save(category);
}
}