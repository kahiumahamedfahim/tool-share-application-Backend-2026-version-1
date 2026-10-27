import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

import { Product } from "src/modules/Product/Entity/product.entity";
import { User } from "src/modules/users/entity/user-entity";
import { RentalRequestStatus } from "../enum/rental-request-status.enum";
import { NegotiationOffer } from "./negotiation-offer.entity";

@Entity("rental_requests")
export class RentalRequest {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // Rental Request ID
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    rentalRequestId!: string;

    // =========================
    // Product & Users
    // =========================

    @Column({
        type: "varchar",
        length: 50,
    })
    productId!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    renterId!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    ownerId!: string;

    // =========================
    // Rental Schedule
    // =========================

    @Column({
        type: "timestamp",
    })
    startDate!: Date;

    @Column({
        type: "int",
    })
    rentalDays!: number;

    @Column({
        type: "timestamp",
    })
    endDate!: Date;

    // =========================
    // Pickup / Delivery
    // =========================

    // Snapshot of the owner's product pickup address
    @Column({
        type: "text",
    })
    pickupAddress!: string;

    // Renter's requested delivery location
    @Column({
    type: "decimal",
    precision: 10,
    scale: 7,
})
deliveryLatitude!: number;

@Column({
    type: "decimal",
    precision: 10,
    scale: 7,
})
deliveryLongitude!: number;

    // Renter's requested delivery address
    @Column({
        type: "text",
    })
    deliveryAddress!: string;

    @Column({
        type: "varchar",
        length: 20,
    })
    contactPhone!: string;

    @Column({
        type: "text",
        nullable: true,
    })
    renterMessage?: string;

    // =========================
    // Pricing
    // =========================

    // Product price at the time
    // the rental request was created.
    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    listedPricePerDay!: string;

    // Renter's initial offer.
    // Used when the renter starts
    // the request with a custom price.
    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: true,
    })
    offeredPricePerDay?: string;

    // Final agreed price per day.
    // Set when negotiation is completed
    // or the owner accepts the listed price.
    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: true,
    })
    agreedPricePerDay?: string;

    // =========================
    // Status
    // =========================

    @Column({
        type: "enum",
        enum: RentalRequestStatus,
        default: RentalRequestStatus.PENDING,
    })
    status!: RentalRequestStatus;

    // =========================
    // Moderator Review
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    moderatorId?: string;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    reviewedAt?: Date;

    // =========================
    // Moderator Review Decisions
    // =========================

    // Delivery fee set manually by
    // the moderator during review.
    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: true,
    })
    deliveryFee?: string;

    // Moderator-entered charge breakdowns. Values stay null until
    // the request is approved and its pricing is confirmed.
    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    ownerRentalFee?: string | null;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    ownerDeliveryFee?: string | null;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    renterRentalFee?: string | null;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    renterDeliveryFee?: string | null;

    // Platform commission percentage
    // set by the moderator during review
    // (default per policy: 10%).
    @Column({
        type: "decimal",
        precision: 5,
        scale: 2,
        nullable: true,
    })
    platformCommissionRate?: string;

    // Charge acceptance flags — both owner and renter
    // must accept the moderator's proposed charges
    // before the request becomes APPROVED.
    @Column({
        type: "boolean",
        default: false,
    })
    ownerChargesAccepted!: boolean;

    @Column({
        type: "boolean",
        default: false,
    })
    renterChargesAccepted!: boolean;

    // Rider assigned by the moderator
    // during review (optional).
    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    riderId?: string | null;

    // =========================
    // Moderator Product Condition
    // Reviews
    // =========================

    // Receiving review: moderator checked
    // the product when the rider picked it up.
    @Column({
        type: "timestamp",
        nullable: true,
    })
    moderatorPickupReviewedAt?: Date;

    @Column({
        type: "boolean",
        nullable: true,
    })
    pickupConditionApproved?: boolean;

    @Column({
        type: "text",
        nullable: true,
    })
    pickupReviewNote?: string;

    // Return review: moderator checked
    // the product again after the term.
    @Column({
        type: "timestamp",
        nullable: true,
    })
    moderatorReturnReviewedAt?: Date;

    @Column({
        type: "boolean",
        nullable: true,
    })
    returnConditionApproved?: boolean;

    @Column({
        type: "text",
        nullable: true,
    })
    returnReviewNote?: string;

    // =========================
    // Timestamps
    // =========================

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt!: Date;

    @UpdateDateColumn({
        type: "timestamp",
    })
    updatedAt!: Date;

    // =========================
    // Relations
    // =========================

    @ManyToOne(() => Product)
    @JoinColumn({
        name: "productId",
        referencedColumnName: "productId",
    })
    product!: Product;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "renterId",
        referencedColumnName: "userId",
    })
    renter!: User;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "ownerId",
        referencedColumnName: "userId",
    })
    owner!: User;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "moderatorId",
        referencedColumnName: "userId",
    })
    moderator?: User;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "riderId",
        referencedColumnName: "userId",
    })
    rider?: User;

    @OneToMany(
        () => NegotiationOffer,
        (offer) => offer.rentalRequest,
    )
    negotiationOffers!: NegotiationOffer[];
}
