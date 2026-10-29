import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import {
    DataSource,
    EntityManager,
    Not,
    Repository,
} from "typeorm";

import { InjectRepository } from "@nestjs/typeorm";

import { Product } from "../Product/Entity/product.entity";
import { ProductImage } from "../Product/Entity/product-image.entity";
import { ProductDocument } from "../Product/Entity/product-document.entity";
import { ProductLocation } from "./Entity/product-location.entity";

import { Category } from "../Category/category.entity";

import { CreateProductDto } from "./Dto/create-product.dto";
import { UpdateProductDto } from "../Product/Dto/updated-product-dto";

import { ProductAvailabilityStatus } from "./enum/productavailabilityStatus.enum";

import { PaginationDto } from "../pagination/pagination-dto";

import { unlink } from "fs/promises";
import { resolve } from "path";
import { promises as fs } from "fs";

import { RentalService } from "../rental/rental.service";


@Injectable()
export class ProductService {

    constructor(
        @InjectRepository(Product)
        private readonly productRepository:
            Repository<Product>,

        @InjectRepository(ProductImage)
        private readonly productImageRepository:
            Repository<ProductImage>,

        @InjectRepository(ProductDocument)
        private readonly productDocumentRepository:
            Repository<ProductDocument>,

        @InjectRepository(Category)
        private readonly categoryRepository:
            Repository<Category>,

        private readonly rentalService:
            RentalService,

        @InjectRepository(ProductLocation)
        private readonly productLocationRepository:
            Repository<ProductLocation>,

        private readonly dataSource:
            DataSource,
    ) {}


    // =========================================================
    // Generate Product ID
    // =========================================================

    private async generateProductId(
        manager: EntityManager,
    ): Promise<string> {

        const result =
            await manager
                .createQueryBuilder(
                    Product,
                    "product",
                )
                .select(
                    "MAX(CAST(SUBSTRING(product.productId, 5) AS INTEGER))",
                    "max",
                )
                .getRawOne<{
                    max: string | null;
                }>();

        const lastNumber =
            result?.max
                ? Number(result.max)
                : 0;

        return `PRD-${String(
            lastNumber + 1,
        ).padStart(3, "0")}`;
    }


    // =========================================================
    // Cleanup Uploaded Files
    // =========================================================

    private async cleanupUploadedFiles(
        files: Express.Multer.File[],
    ): Promise<void> {

        for (const file of files) {

            try {

                await unlink(
                    file.path,
                );

            } catch (error) {

                console.error(
                    `Failed to cleanup uploaded file: ${file.path}`,
                    error,
                );
            }
        }
    }


    // =========================================================
    // Delete Stored Files
    // =========================================================

    private async deleteStoredFiles(
        filePaths: string[],
    ): Promise<void> {

        for (const filePath of filePaths) {

            try {

                await unlink(
                    resolve(filePath),
                );

            } catch (error) {

                console.error(
                    `Failed to delete file: ${filePath}`,
                    error,
                );
            }
        }
    }


    // =========================================================
    // Create Product
    // =========================================================

    async createProduct(
        createProductDto: CreateProductDto,
        ownerId: string,
        productImages: Express.Multer.File[],
        productDocuments?: Express.Multer.File[],
    ): Promise<Product> {

        // -----------------------------------------------------
        // Cross-field validation
        // -----------------------------------------------------

        if (
            createProductDto.minRentalDays >
            createProductDto.maxRentalDays
        ) {

            throw new BadRequestException(
                "Minimum rental days cannot exceed maximum rental days",
            );
        }

        // -----------------------------------------------------
        // Date window validation
        // -----------------------------------------------------

        const rentalStart =
            createProductDto.rentalWindowStart
                ? new Date(createProductDto.rentalWindowStart)
                : null;
        const rentalEnd =
            createProductDto.rentalWindowEnd
                ? new Date(createProductDto.rentalWindowEnd)
                : null;
        const deliveryStart =
            createProductDto.deliveryWindowStart
                ? new Date(createProductDto.deliveryWindowStart)
                : null;
        const deliveryEnd =
            createProductDto.deliveryWindowEnd
                ? new Date(createProductDto.deliveryWindowEnd)
                : null;
        const returnStart =
            createProductDto.returnWindowStart
                ? new Date(createProductDto.returnWindowStart)
                : null;
        const returnEnd =
            createProductDto.returnWindowEnd
                ? new Date(createProductDto.returnWindowEnd)
                : null;

        if (rentalStart && rentalEnd) {
            if (rentalStart.getTime() >= rentalEnd.getTime()) {
                throw new BadRequestException(
                    "Rental window start must be before rental window end",
                );
            }
        }

        if (deliveryStart && deliveryEnd) {
            if (deliveryStart.getTime() >= deliveryEnd.getTime()) {
                throw new BadRequestException(
                    "Delivery window start must be before delivery window end",
                );
            }
        }

        if (returnStart && returnEnd) {
            if (returnStart.getTime() >= returnEnd.getTime()) {
                throw new BadRequestException(
                    "Return window start must be before return window end",
                );
            }
        }

        // Delivery window should end before rental window starts
        if (deliveryEnd && rentalStart) {
            if (deliveryEnd.getTime() > rentalStart.getTime()) {
                throw new BadRequestException(
                    "Delivery window end must be before rental window start",
                );
            }
        }

        // Rental window start must not be before delivery window start
        if (deliveryStart && rentalStart) {
            if (rentalStart.getTime() < deliveryStart.getTime()) {
                throw new BadRequestException(
                    "Rental window start must be on or after delivery-to-rider start time",
                );
            }
        }

        // Return window should start after rental window ends
        if (rentalEnd && returnStart) {
            if (returnStart.getTime() < rentalEnd.getTime()) {
                throw new BadRequestException(
                    "Return window start must be on or after rental window end",
                );
            }
        }


        // -----------------------------------------------------
        // Product image validation
        // -----------------------------------------------------

        if (
            !productImages ||
            productImages.length === 0
        ) {

            throw new BadRequestException(
                "At least one product image is required",
            );
        }


        // -----------------------------------------------------
        // Keep track of uploaded files
        // -----------------------------------------------------

        const uploadedFiles:
            Express.Multer.File[] = [
                ...productImages,
                ...(productDocuments ?? []),
            ];


        const queryRunner =
            this.dataSource.createQueryRunner();


        await queryRunner.connect();
        await queryRunner.startTransaction();


        try {

            // -------------------------------------------------
            // Check category
            // -------------------------------------------------

            const category =
                await queryRunner.manager.findOne(
                    Category,
                    {
                        where: {
                            categoryId:
                                createProductDto.categoryId,
                        },
                    },
                );


            if (!category) {

                throw new NotFoundException(
                    "Category not found",
                );
            }


            // -------------------------------------------------
            // Generate Product ID
            // -------------------------------------------------

            const productId =
                await this.generateProductId(
                    queryRunner.manager,
                );


            // -------------------------------------------------
            // Create Product
            // -------------------------------------------------

            const product =
                queryRunner.manager.create(
                    Product,
                    {
                        productId,

                        ownerId,

                        categoryId:
                            createProductDto.categoryId,

                        name:
                            createProductDto.name.trim(),

                        description:
                            createProductDto.description.trim(),

                        pricePerDay:
                            createProductDto.pricePerDay.toFixed(
                                2,
                            ),

                        negotiationAllowed:
                            createProductDto.negotiationAllowed,

                        minRentalDays:
                            createProductDto.minRentalDays,

                        maxRentalDays:
                            createProductDto.maxRentalDays,

                        preparationBufferDays:
                            createProductDto.preparationBufferDays,

                        allowSameDayRental:
                            createProductDto.allowSameDayRental,

                        availabilityStatus:
                            ProductAvailabilityStatus.AVAILABLE,

                        // Owner-chosen date windows
                        rentalWindowStart:
                            createProductDto.rentalWindowStart
                                ? new Date(
                                    createProductDto
                                        .rentalWindowStart,
                                )
                                : null,

                        rentalWindowEnd:
                            createProductDto.rentalWindowEnd
                                ? new Date(
                                    createProductDto
                                        .rentalWindowEnd,
                                )
                                : null,

                        deliveryWindowStart:
                            createProductDto
                                .deliveryWindowStart
                                ? new Date(
                                    createProductDto
                                        .deliveryWindowStart,
                                )
                                : null,

                        deliveryWindowEnd:
                            createProductDto
                                .deliveryWindowEnd
                                ? new Date(
                                    createProductDto
                                        .deliveryWindowEnd,
                                )
                                : null,

                        returnWindowStart:
                            createProductDto
                                .returnWindowStart
                                ? new Date(
                                    createProductDto
                                        .returnWindowStart,
                                )
                                : null,

                        returnWindowEnd:
                            createProductDto
                                .returnWindowEnd
                                ? new Date(
                                    createProductDto
                                        .returnWindowEnd,
                                )
                                : null,

                        // Fees are assigned during moderator review, never by the owner.
                        platformFeePercentage: "10.00",
                        deliveryFeeBase: "0.00",
                    },
                );


            const savedProduct =
                await queryRunner.manager.save(
                    Product,
                    product,
                );


            // -------------------------------------------------
            // Save Product Images
            // -------------------------------------------------

            const imageEntities =
                productImages.map(
                    (image) =>
                        queryRunner.manager.create(
                            ProductImage,
                            {
                                productId:
                                    savedProduct.productId,

                                filePath:
                                    image.path,
                            },
                        ),
                );


            await queryRunner.manager.save(
                ProductImage,
                imageEntities,
            );


            // -------------------------------------------------
            // Save Product Documents
            // -------------------------------------------------

            if (
                productDocuments &&
                productDocuments.length > 0
            ) {

                const documentEntities =
                    productDocuments.map(
                        (document) =>
                            queryRunner.manager.create(
                                ProductDocument,
                                {
                                    productId:
                                        savedProduct.productId,

                                    filePath:
                                        document.path,
                                },
                            ),
                    );


                await queryRunner.manager.save(
                    ProductDocument,
                    documentEntities,
                );
            }


            // -------------------------------------------------
            // Save Product Location
            // -------------------------------------------------

            const productLocation =
                queryRunner.manager.create(
                    ProductLocation,
                    {
                        productId:
                            savedProduct.productId,

                        latitude:
                            String(
                                createProductDto.latitude,
                            ),

                        longitude:
                            String(
                                createProductDto.longitude,
                            ),

                        division:
                            createProductDto.division.trim(),

                        district:
                            createProductDto.district.trim(),

                        upazila:
                            createProductDto.upazila.trim(),

                        pickupAddress:
                            createProductDto.pickupAddress.trim(),
                    },
                );


            const savedLocation =
                await queryRunner.manager.save(
                    ProductLocation,
                    productLocation,
                );


            // -------------------------------------------------
            // Commit Transaction
            // -------------------------------------------------

            await queryRunner.commitTransaction();


            return {
                ...savedProduct,
                location: savedLocation,
            };

        } catch (error) {

            await queryRunner.rollbackTransaction();


            // Database rollback does not
            // remove Multer uploaded files.

            await this.cleanupUploadedFiles(
                uploadedFiles,
            );


            throw error;

        } finally {

            await queryRunner.release();
        }
    }


    // =========================================================
    // Get All Products
    // =========================================================

    async getAllProducts(
        paginationDto: PaginationDto,
        ownerId?: string,
    ): Promise<any> {

        const {
            page,
            limit,
        } = paginationDto;


        const skip =
            (page - 1) * limit;


        const [
            products,
            total,
        ] =
            await this.productRepository.findAndCount({

                where: ownerId
                    ? {
                        ownerId: Not(ownerId),
                    }
                    : {},

                relations: {
                    category: true,
                    productImages: true,
                    productDocuments: true,
                    location: true,
                },

                order: {
                    createdAt: "DESC",
                },

                skip,

                take: limit,
            });


        return {

            data: products,

            meta: {

                page,

                limit,

                total,

                totalPages:
                    Math.ceil(
                        total / limit,
                    ),
            },
        };
    }


    // =========================================================
    // Get Product Details
    // =========================================================

 // Replace your existing getProductById method in ProductService with this method.
// Keep the rest of ProductService unchanged.

async getProductById(
    productId: string,
    currentUserId?: string,
): Promise<any> {
    const product = await this.productRepository.findOne({
        where: { productId },
        relations: {
            owner: true,
            category: true,
            productImages: true,
            productDocuments: true,
            location: true,
        },
    });

    if (!product) {
        throw new NotFoundException("Product not found");
    }

    const isOwner =
        !!currentUserId &&
        product.ownerId === currentUserId;

    return {
        data: {
            productId: product.productId,
            name: product.name,
            description: product.description,
            pricePerDay: product.pricePerDay,
            negotiationAllowed: product.negotiationAllowed,
            minRentalDays: product.minRentalDays,
            maxRentalDays: product.maxRentalDays,
            preparationBufferDays: product.preparationBufferDays,
            allowSameDayRental: product.allowSameDayRental,
            availabilityStatus: product.availabilityStatus,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            ownerId: product.ownerId,
            isOwner,
            owner: {
                userId: product.owner.userId,
                firstName: product.owner.firstName,
                lastName: product.owner.lastName,
                email: product.owner.email,
                phone: product.owner.phone,
            },
            category: product.category,
            productImages: product.productImages,
            productDocuments: product.productDocuments,
            location: product.location,
        },
    };
}


    // =========================================================
    // Get My Products
    // =========================================================

    async getMyProducts(
        ownerId: string,
        paginationDto: PaginationDto,
    ): Promise<any> {

        const {
            page,
            limit,
        } = paginationDto;


        const skip =
            (page - 1) * limit;


        const [
            products,
            total,
        ] =
            await this.productRepository.findAndCount({

                where: {
                    ownerId,
                },

                relations: {
                    category: true,
                    productImages: true,
                    productDocuments: true,
                    location: true,
                },

                order: {
                    createdAt: "DESC",
                },

                skip,

                take: limit,
            });


        return {

            data: products,

            meta: {

                page,

                limit,

                total,

                totalPages:
                    Math.ceil(
                        total / limit,
                    ),
            },
        };
    }


    // =========================================================
    // Update Product
    // =========================================================

async updateProduct(
    productId: string,
    ownerId: string,
    dto: UpdateProductDto,
    files?: {
        productImages?: Express.Multer.File[];
        productDocuments?: Express.Multer.File[];
    },
) {
    // -----------------------------------------------------
    // Find Product
    // -----------------------------------------------------

    const product =
        await this.productRepository.findOne({
            where: {
                productId,
            },
            relations: {
                location: true,
            },
        });

    if (!product) {
        throw new NotFoundException(
            "Product not found",
        );
    }

    // -----------------------------------------------------
    // Owner validation
    // -----------------------------------------------------

    if (product.ownerId !== ownerId) {
        throw new BadRequestException(
            "You are not allowed to update this product",
        );
    }

    // -----------------------------------------------------
    // Active rental request check
    // -----------------------------------------------------

    const hasActiveRequest =
        await this.rentalService
            .hasActiveRentalRequestForProduct(
                productId,
            );

    if (hasActiveRequest) {
        const onlyAvailabilityUpdate =
            dto.availabilityStatus !== undefined &&
            Object.keys(dto).every(
                (key) =>
                    key === "availabilityStatus",
            );

        if (!onlyAvailabilityUpdate) {
            throw new BadRequestException(
                "This product cannot be updated because it has an active rental request",
            );
        }

        if (
            dto.availabilityStatus !==
            ProductAvailabilityStatus.UNAVAILABLE
        ) {
            throw new BadRequestException(
                "This product can only be marked as UNAVAILABLE",
            );
        }

        product.availabilityStatus =
            ProductAvailabilityStatus.UNAVAILABLE;

        return this.productRepository.save(
            product,
        );
    }

    // -----------------------------------------------------
    // Validate rental-day range
    // -----------------------------------------------------

    const minRentalDays =
        dto.minRentalDays ??
        product.minRentalDays;

    const maxRentalDays =
        dto.maxRentalDays ??
        product.maxRentalDays;

    if (minRentalDays > maxRentalDays) {
        throw new BadRequestException(
            "Minimum rental days cannot be greater than maximum rental days",
        );
    }

    // -----------------------------------------------------
    // Update basic fields
    // -----------------------------------------------------

    if (dto.name !== undefined) {
        const name = dto.name.trim();

        if (!name) {
            throw new BadRequestException(
                "Product name cannot be empty",
            );
        }

        product.name = name;
    }

    if (dto.description !== undefined) {
        const description =
            dto.description.trim();

        if (!description) {
            throw new BadRequestException(
                "Product description cannot be empty",
            );
        }

        product.description = description;
    }

    // -----------------------------------------------------
    // Update Category
    // -----------------------------------------------------

    if (dto.categoryId !== undefined) {
        const category =
            await this.categoryRepository.findOne({
                where: {
                    categoryId: dto.categoryId,
                },
            });

        if (!category) {
            throw new NotFoundException(
                "Category not found",
            );
        }

        product.categoryId =
            dto.categoryId;
    }

    // -----------------------------------------------------
    // Update Price
    // -----------------------------------------------------

    if (dto.pricePerDay !== undefined) {
        product.pricePerDay =
            dto.pricePerDay.toFixed(2);
    }

    // -----------------------------------------------------
    // Update Rental Settings
    // -----------------------------------------------------

    if (
        dto.negotiationAllowed !==
        undefined
    ) {
        product.negotiationAllowed =
            dto.negotiationAllowed;
    }

    if (
        dto.minRentalDays !==
        undefined
    ) {
        product.minRentalDays =
            dto.minRentalDays;
    }

    if (
        dto.maxRentalDays !==
        undefined
    ) {
        product.maxRentalDays =
            dto.maxRentalDays;
    }

    if (
        dto.preparationBufferDays !==
        undefined
    ) {
        product.preparationBufferDays =
            dto.preparationBufferDays;
    }

    if (
        dto.allowSameDayRental !==
        undefined
    ) {
        product.allowSameDayRental =
            dto.allowSameDayRental;
    }

    // -----------------------------------------------------
    // Update Availability
    // -----------------------------------------------------

    if (
        dto.availabilityStatus !==
        undefined
    ) {
        product.availabilityStatus =
            dto.availabilityStatus;
    }

    // -----------------------------------------------------
    // Update Location
    // -----------------------------------------------------

    if (product.location) {
        // Latitude + Longitude

        if (
            dto.latitude !== undefined ||
            dto.longitude !== undefined
        ) {
            if (
                dto.latitude === undefined ||
                dto.longitude === undefined
            ) {
                throw new BadRequestException(
                    "Latitude and longitude must be provided together",
                );
            }

            product.location.latitude =
                dto.latitude.toString();

            product.location.longitude =
                dto.longitude.toString();
        }

        // Division

        if (
            dto.division !== undefined
        ) {
            const division =
                dto.division.trim();

            if (!division) {
                throw new BadRequestException(
                    "Division cannot be empty",
                );
            }

            product.location.division =
                division;
        }

        // District

        if (
            dto.district !== undefined
        ) {
            const district =
                dto.district.trim();

            if (!district) {
                throw new BadRequestException(
                    "District cannot be empty",
                );
            }

            product.location.district =
                district;
        }

        // Upazila

        if (
            dto.upazila !== undefined
        ) {
            const upazila =
                dto.upazila.trim();

            if (!upazila) {
                throw new BadRequestException(
                    "Upazila cannot be empty",
                );
            }

            product.location.upazila =
                upazila;
        }

        // Pickup Address

        if (
            dto.pickupAddress !==
            undefined
        ) {
            const pickupAddress =
                dto.pickupAddress.trim();

            if (!pickupAddress) {
                throw new BadRequestException(
                    "Pickup address cannot be empty",
                );
            }

            product.location.pickupAddress =
                pickupAddress;
        }

        await this.productLocationRepository.save(
            product.location,
        );
    }

    // -----------------------------------------------------
    // Delete Existing Product Images
    // -----------------------------------------------------

    if (
        dto.deleteImageIds &&
        dto.deleteImageIds.length > 0
    ) {
        // Get ALL images belonging to this product
        const existingImages =
            await this.productImageRepository.find(
                {
                    where: {
                        productId:
                            product.productId,
                    },
                },
            );

        // Select only the images requested for deletion
        const selectedImagesToDelete =
            existingImages.filter(
                (image) =>
                    dto.deleteImageIds!.includes(
                        image.id,
                    ),
            );

        // Make sure every requested ID belongs
        // to this product
        if (
            selectedImagesToDelete.length !==
            dto.deleteImageIds.length
        ) {
            throw new BadRequestException(
                "One or more selected product images do not belong to this product",
            );
        }

        // Calculate remaining images
        const remainingImageCount =
            existingImages.length -
            selectedImagesToDelete.length +
            (files?.productImages
                ?.length ?? 0);

        // Product must always have
        // at least one image
        if (remainingImageCount < 1) {
            throw new BadRequestException(
                "Product must have at least one image",
            );
        }

        // Delete physical files
        for (
            const image of selectedImagesToDelete
        ) {
            if (image.filePath) {
                try {
                    await fs.unlink(
                        image.filePath,
                    );
                } catch (error: any) {
                    // File already missing is okay
                    if (
                        error?.code !==
                        "ENOENT"
                    ) {
                        throw error;
                    }
                }
            }
        }

        // Delete database records
        await this.productImageRepository.delete(
            selectedImagesToDelete.map(
                (image) => image.id,
            ),
        );
    }

    // -----------------------------------------------------
    // Delete Existing Product Documents
    // -----------------------------------------------------

    if (
        dto.deleteDocumentIds &&
        dto.deleteDocumentIds.length > 0
    ) {
        // Get ALL documents belonging to this product
        const existingDocuments =
            await this.productDocumentRepository.find(
                {
                    where: {
                        productId:
                            product.productId,
                    },
                },
            );

        // Select only requested documents
        const selectedDocumentsToDelete =
            existingDocuments.filter(
                (document) =>
                    dto.deleteDocumentIds!.includes(
                        document.id,
                    ),
            );

        // Make sure every requested ID belongs
        // to this product
        if (
            selectedDocumentsToDelete.length !==
            dto.deleteDocumentIds.length
        ) {
            throw new BadRequestException(
                "One or more selected product documents do not belong to this product",
            );
        }

        // Delete physical files
        for (
            const document of selectedDocumentsToDelete
        ) {
            if (document.filePath) {
                try {
                    await fs.unlink(
                        document.filePath,
                    );
                } catch (error: any) {
                    // File already missing is okay
                    if (
                        error?.code !==
                        "ENOENT"
                    ) {
                        throw error;
                    }
                }
            }
        }

        // Delete database records
        await this.productDocumentRepository.delete(
            selectedDocumentsToDelete.map(
                (document) =>
                    document.id,
            ),
        );
    }

    // -----------------------------------------------------
    // Add New Product Images
    // -----------------------------------------------------

    const productImages =
        files?.productImages ?? [];

    if (productImages.length > 0) {
        const imageEntities =
            productImages.map(
                (image) =>
                    this.productImageRepository.create(
                        {
                            productId:
                                product.productId,

                            filePath:
                                image.path,
                        },
                    ),
            );

        await this.productImageRepository.save(
            imageEntities,
        );
    }

    // -----------------------------------------------------
    // Add New Product Documents
    // -----------------------------------------------------

    const productDocuments =
        files?.productDocuments ?? [];

    if (productDocuments.length > 0) {
        const documentEntities =
            productDocuments.map(
                (document) =>
                    this.productDocumentRepository.create(
                        {
                            productId:
                                product.productId,

                            filePath:
                                document.path,
                        },
                    ),
            );

        await this.productDocumentRepository.save(
            documentEntities,
        );
    }

    // -----------------------------------------------------
    // Save Product
    // -----------------------------------------------------

    return this.productRepository.save(
        product,
    );
}


    // =========================================================
    // Delete Product
    // =========================================================

    async deleteProduct(
        productId: string,
        ownerId: string,
    ) {

        const product =
            await this.productRepository.findOne({

                where: {
                    productId,
                },

                relations: {
                    productImages: true,
                    productDocuments: true,
                    location: true,
                },
            });


        if (!product) {

            throw new NotFoundException(
                "Product not found",
            );
        }


        // -----------------------------------------------------
        // Owner validation
        // -----------------------------------------------------

        if (
            product.ownerId !== ownerId
        ) {

            throw new BadRequestException(
                "You are not allowed to delete this product",
            );
        }


        // -----------------------------------------------------
        // Active rental request check
        // -----------------------------------------------------

        const hasActiveRequest =
            await this.rentalService
                .hasActiveRentalRequestForProduct(
                    productId,
                );


        if (hasActiveRequest) {

            throw new BadRequestException(
                "This product cannot be deleted because it has an active rental request",
            );
        }


        // -----------------------------------------------------
        // Collect physical file paths
        // -----------------------------------------------------

        const imageFilePaths =
            product.productImages.map(
                (image) =>
                    image.filePath,
            );


        const documentFilePaths =
            product.productDocuments.map(
                (document) =>
                    document.filePath,
            );


        // -----------------------------------------------------
        // Delete database records
        // -----------------------------------------------------

        await this.dataSource.transaction(
            async (manager) => {

                await manager.delete(
                    ProductImage,
                    {
                        productId,
                    },
                );


                await manager.delete(
                    ProductDocument,
                    {
                        productId,
                    },
                );


                await manager.delete(
                    ProductLocation,
                    {
                        productId,
                    },
                );


                await manager.delete(
                    Product,
                    {
                        productId,
                    },
                );
            },
        );


        // -----------------------------------------------------
        // Delete physical files
        // -----------------------------------------------------

        await this.deleteStoredFiles([
            ...imageFilePaths,
            ...documentFilePaths,
        ]);


        return {

            message:
                "Product deleted successfully",

            productId,
        };
    }
}
