
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
} from "typeorm";

import { ProductAvailabilityStatus } from "../enum/productavailabilityStatus.enum";
import { User } from "src/modules/users/entity/user-entity";
import { Category } from "src/modules/Category/category.entity";
import { ProductDocument } from "./product-document.entity";
import { ProductImage } from "./product-image.entity";
import { ProductLocation } from "./product-location.entity";

@Entity("products")
export class Product {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    productId!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    ownerId!: string;

    @Column({
        type: "varchar",
        length: 20,
    })
    categoryId!: string;

    @Column({
        type: "varchar",
        length: 150,
    })
    name!: string;

    @Column({
        type: "text",
    })
    description!: string;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    pricePerDay!: string;

    @Column({
        type: "boolean",
        default: false,
    })
    negotiationAllowed!: boolean;

    // Rental duration policy
    @Column({
        type: "int",
        default: 1,
    })
    minRentalDays!: number;

    @Column({
        type: "int",
        default: 30,
    })
    maxRentalDays!: number;

    // Preparation time between rentals
    @Column({
        type: "int",
        default: 0,
    })
    preparationBufferDays!: number;

    // Whether a renter may start a rental on the same day
    @Column({
        type: "boolean",
        default: false,
    })
    allowSameDayRental!: boolean;

    @Column({
        type: "enum",
        enum: ProductAvailabilityStatus,
        default: ProductAvailabilityStatus.AVAILABLE,
    })
    availabilityStatus!: ProductAvailabilityStatus;

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt!: Date;

    @UpdateDateColumn({
        type: "timestamp",
    })
    updatedAt!: Date;

    // Relationships

    @ManyToOne(
        () => User,
        (user) => user.products,
    )
    @JoinColumn({
        name: "ownerId",
        referencedColumnName: "userId",
    })
    owner!: User;

    @ManyToOne(
        () => Category,
        (category) => category.products,
    )
    @JoinColumn({
        name: "categoryId",
        referencedColumnName: "categoryId",
    })
    category!: Category;

    @OneToMany(
        () => ProductImage,
        (productImage) => productImage.product,
    )
    productImages!: ProductImage[];

    @OneToMany(
        () => ProductDocument,
        (productDocument) => productDocument.product,
    )
    productDocuments!: ProductDocument[];

   @OneToOne(
    () => ProductLocation,
    (productLocation) => productLocation.product,
    {
        cascade: true,
    },
)
location?: ProductLocation;
}