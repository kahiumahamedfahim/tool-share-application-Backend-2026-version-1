import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
    UsePipes,
    ValidationPipe,
    Delete
} from "@nestjs/common";

import {
    FileFieldsInterceptor,
} from "@nestjs/platform-express";

import {
    diskStorage,
} from "multer";

import {
    extname,
} from "path";

import {
    randomUUID,
} from "crypto";

import { CreateProductDto } from "./Dto/create-product.dto";
import { ProductService } from "./product.service";

import { JwtAuthGuard } from "src/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "src/auth/optional-jwt-auth.guard";

import { RolesGuard } from "src/roles.guard";
import { UserRole } from "../users/enums/user-role-enum";
import { Roles } from "src/auth/roles.decorator";
import { Query } from "@nestjs/common";
import { PaginationDto } from "../pagination/pagination-dto";
import {
    Patch,
} from "@nestjs/common";

import { UpdateProductDto } from "../Product/Dto/updated-product-dto";


@Controller("products")
export class ProductController
{
    constructor(
        private readonly productService: ProductService,
    )
    {
    }


    // =========================================================
    // CREATE PRODUCT
    // =========================================================

    @Post("createProduct")
    @UsePipes(
        new ValidationPipe({
            transform: true,
        }),
    )
    @UseGuards(
        JwtAuthGuard,
        RolesGuard,
    )
    @Roles(
        UserRole.USER,
    )
  @UseInterceptors(
    FileFieldsInterceptor(
        [
            {
                name: "productImages",
                maxCount: 10,
            },
            {
                name: "productDocuments",
                maxCount: 5,
            },
        ],
        {
            storage: diskStorage({
                destination: (
                    request,
                    file,
                    callback,
                ) => {
                    if (
                        file.fieldname ===
                        "productImages"
                    ) {
                        return callback(
                            null,
                            "./uploads/products",
                        );
                    }

                    if (
                        file.fieldname ===
                        "productDocuments"
                    ) {
                        return callback(
                            null,
                            "./uploads/product-documents",
                        );
                    }

                    return callback(
                        new BadRequestException(
                            "Invalid file field",
                        ),
                        "",
                    );
                },

                filename: (
                    request,
                    file,
                    callback,
                ) => {
                    const extension =
                        extname(
                            file.originalname,
                        ).toLowerCase();

                    const fileName =
                        `${randomUUID()}${extension}`;

                    callback(
                        null,
                        fileName,
                    );
                },
            }),

            // Maximum 5 MB per file
            limits: {
                fileSize: 5 * 1024 * 1024,
            },

            fileFilter: (
                request,
                file,
                callback,
            ) => {
                // Product images
                if (
                    file.fieldname ===
                    "productImages"
                ) {
                    const allowedImageTypes = [
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                    ];

                    const allowedImageExtensions = [
                        ".jpg",
                        ".jpeg",
                        ".png",
                        ".webp",
                    ];

                    const extension =
                        extname(
                            file.originalname,
                        ).toLowerCase();

                    if (
                        !allowedImageTypes.includes(
                            file.mimetype,
                        ) ||
                        !allowedImageExtensions.includes(
                            extension,
                        )
                    ) {
                        return callback(
                            new BadRequestException(
                                "Only JPG, JPEG, PNG and WEBP images are allowed",
                            ),
                            false,
                        );
                    }
                }

                // Product documents
                if (
                    file.fieldname ===
                    "productDocuments"
                ) {
                    const extension =
                        extname(
                            file.originalname,
                        ).toLowerCase();

                    if (
                        file.mimetype !==
                            "application/pdf" ||
                        extension !== ".pdf"
                    ) {
                        return callback(
                            new BadRequestException(
                                "Only PDF documents are allowed",
                            ),
                            false,
                        );
                    }
                }

                // Reject any unexpected field
                if (
                    file.fieldname !==
                        "productImages" &&
                    file.fieldname !==
                        "productDocuments"
                ) {
                    return callback(
                        new BadRequestException(
                            "Invalid file field",
                        ),
                        false,
                    );
                }

                callback(
                    null,
                    true,
                );
            },
        },
    ),
)
    async createProduct(
        @Body()
        createProductDto: CreateProductDto,

        @UploadedFiles()
        files: {
            productImages?: Express.Multer.File[];
            productDocuments?: Express.Multer.File[];
        },

        @Req()
        request: any,
    )
    {
        const ownerId =
            request.user.userId;

        const productImages =
            files?.productImages || [];

        const productDocuments =
            files?.productDocuments || [];

        return this.productService.createProduct(
            createProductDto,
            ownerId,
            productImages,
            productDocuments,
        );
    }


    // =========================================================
    // GET ALL PRODUCTS
    // Guest  -> All Products
    // User   -> Other Users' Products
    // =========================================================

   @Get()
   @UseGuards(OptionalJwtAuthGuard)

async getAllProducts(
    @Req()
    request: any,

    @Query()
    paginationDto: PaginationDto,
)
{
    const ownerId =
        request.user?.userId;

    return this.productService.getAllProducts(
        paginationDto,
        ownerId,
    );
}


    // =========================================================
    // GET MY PRODUCTS
    // USER ONLY
    // =========================================================

@Get("my-products")
@UseGuards(
    JwtAuthGuard,
    RolesGuard,
)
@Roles(UserRole.USER)
async getMyProducts(
    @Req() request: any,
    @Query() paginationDto: PaginationDto,
)
{
    const ownerId =
        request.user.userId;

    return this.productService.getMyProducts(
        ownerId,
        paginationDto,
    );
}

    // =========================================================
    // GET PRODUCT DETAILS
    // USER / ADMIN / MODERATOR
    // =========================================================

 @Get(":productId")
@UseGuards(
    OptionalJwtAuthGuard,
)
async getProductById(
    @Param("productId")
    productId: string,

    @Req()
    request: any,
) {
    const currentUserId =
        request.user?.userId;

    return this.productService.getProductById(
        productId,
        currentUserId,
    );
}

    // =========================================================
// UPDATE PRODUCT
// USER / OWNER ONLY
// =========================================================

@Patch(":productId")
@UseGuards(
    JwtAuthGuard,
    RolesGuard,
)
@Roles(UserRole.USER)
@UseInterceptors(
    FileFieldsInterceptor(
        [
            {
                name: "productImages",
                maxCount: 10,
            },
            {
                name: "productDocuments",
                maxCount: 5,
            },
        ],
        {
            storage: diskStorage({
                destination: (
                    req,
                    file,
                    cb,
                ) => {
                    if (
                        file.fieldname ===
                        "productImages"
                    ) {
                        cb(
                            null,
                            "./uploads/products",
                        );
                        return;
                    }

                    if (
                        file.fieldname ===
                        "productDocuments"
                    ) {
                        cb(
                            null,
                            "./uploads/product-documents",
                        );
                        return;
                    }

                    cb(
                        new Error(
                            "Invalid file field",
                        ),
                        "",
                    );
                },

                filename: (
                    req,
                    file,
                    cb,
                ) => {
                    const extension =
                        extname(
                            file.originalname,
                        );

                    cb(
                        null,
                        `${randomUUID()}${extension}`,
                    );
                },
            }),
        },
    ),
)
@UsePipes(
    new ValidationPipe({
        transform: true,
    }),
)
async updateProduct(
    @Param("productId")
    productId: string,

    @Body()
    updateProductDto: UpdateProductDto,

    @UploadedFiles()
    files: {
        productImages?: Express.Multer.File[];
        productDocuments?: Express.Multer.File[];
    },

    @Req()
    request,
) {
    return this.productService.updateProduct(
        productId,
        request.user.userId,
        updateProductDto,
        files,
    );
}
@Delete(":productId")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
async deleteProduct(
    @Param("productId") productId: string,
    @Req() request,
) {
    return this.productService.deleteProduct(
        productId,
        request.user.userId,
    );
}

}