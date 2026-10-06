import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { Category } from "./category.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { createCategoryDto } from "./Dto/create-catagory-dto";
import { UpdateCategoryDto } from "./Dto/update-category.dto";

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
     async create(createCategoryDto : createCategoryDto): Promise<any>
     {
        try 
        {
            const existCategory= await this.categoryRepository.findOne(
                {
                    where : 
                    {
                        name : createCategoryDto.name,
                    }
                }
            );
            if(existCategory)
            {
                throw new ConflictException('category with this name is already exists');
            }
          
            const categoryId= await this.genateredCategoryId();
            const category=
            this.categoryRepository.create(
                {
                    categoryId,
                    name: createCategoryDto.name,
                    description: createCategoryDto.description,
                    createdAt:new Date(),

                }
            );
            return await this.categoryRepository.save(category);

        }
        catch(error)
        {
            return error;
        }
     }
     async findAll() : Promise<Category[]>
     {
        const categories=await this.categoryRepository.find(
            {
                order: 
                {
                    createdAt: "DESC"
                }
            }
        );
        return categories;
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
): Promise<Category>
{
    const category =
        await this.findOne(categoryId);

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
    }

    Object.assign(
        category,
        updateCategoryDto,
    );

    return await this.categoryRepository.save(category);
}

async remove(
    categoryId: string,
): Promise<void>
{
    const category =
        await this.findOne(categoryId);

    await this.categoryRepository.remove(category);
}
}