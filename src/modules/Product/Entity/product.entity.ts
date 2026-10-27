
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

    // =====================================================
    // Owner-chosen date windows (Phase: date selection)
    // The owner sets when the product is rentable and
    // when it must be available for handoff / return.
    // =====================================================

    // Rental period during which the renter may use
    // the product (e.g. 22/10/26 to 30/10/26).
    @Column({
        type: "timestamp",
        nullable: true,
    })
    rentalWindowStart?: Date | null;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    rentalWindowEnd?: Date | null;

    // Window during which the owner hands the product
    // to the rider (e.g. 18/10/26 to 23/10/26).
    @Column({
        type: "timestamp",
        nullable: true,
    })
    deliveryWindowStart?: Date | null;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    deliveryWindowEnd?: Date | null;

    // Window during which the product must be returned
    // to the owner (e.g. 1/11/26 to 3/11/26).
    @Column({
        type: "timestamp",
        nullable: true,
    })
    returnWindowStart?: Date | null;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    returnWindowEnd?: Date | null;

    // =====================================================
    // Platform fee percentage (per day, applied to
    // rental income). Example: 10% per day.
    // =====================================================

    @Column({
        type: "decimal",
        precision: 5,
        scale: 2,
        default: "10.00",
    })
    platformFeePercentage!: string;

    // =====================================================
    // Delivery fee base (flat amount the owner sets;
    // final amount may be adjusted by distance/size
    // during moderator review).
    // =====================================================

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        default: "0.00",
    })
    deliveryFeeBase!: string;

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