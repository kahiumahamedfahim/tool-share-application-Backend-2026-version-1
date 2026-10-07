import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { Category } from "./category.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { createCategoryDto } from "./Dto/create-catagory-dto";
import { UpdateCategoryDto } from "./Dto/update-category.dto";
import { CategoryStatus } from "./Enums/category.enum";
import { ConfigModule } from "@nestjs/config";
import { PaginationDto } from "../pagination/pagination-dto";

@Injectable()
export class CategoryService
{
     constructor(
        @InjectRepository(Category)
        private readonly categoryRepository : Repository<Category>
        
     )
     {

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
        const exisitngCategory= await this.categoryRepository.findOne({
            where : 
            {
                name: createCategoryDto.name.trim(),
            }
        });
        if(exisitngCategory)
        {
            throw new ConflictException('category with this name is already exists');
        }
        const categoryId= await this.genateredCategoryId();
        let imageName : string | null = null;
        if(image)
        {
            imageName=image.filename;
        }
      const category = this.categoryRepository.create(
    {
        categoryId: categoryId,
        name: createCategoryDto.name,
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
        const existingCategory =
            await this.categoryRepository.findOne({
                where: {
                    name: updateCategoryDto.name,
                },
            });

        if (
            existingCategory &&
            existingCategory.categoryId !== categoryId
        )
        {
            throw new ConflictException(
                'Category with this name already exists',
            );
        }

        category.name =
            updateCategoryDto.name;
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

    if (image)
    {
        category.image =
            image.filename;
    }

    return await this.categoryRepository.save(
        category,
    );
}

async remove(
    categoryId: string,
): Promise<void>
{
    const category =
        await this.findOne(categoryId);

    await this.categoryRepository.remove(category);
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