import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

export enum ActualRentalStatus {
    // Rental created; waiting for
    // product handover / delivery.
    PENDING_HANDOVER = "PENDING_HANDOVER",

    ACTIVE = "ACTIVE",

    COMPLETED = "COMPLETED",

    CANCELLED = "CANCELLED",
}

@Entity("actual_rentals")
export class ActualRental {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // Rental ID
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    rentalId!: string;

    // =========================
    // Origin Request
    // (one rental per request,
    // enforced at DB level)
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    rentalRequestId!: string;

    // =========================
    // Parties (snapshots)
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

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    moderatorId?: string | null;

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    riderId?: string | null;

    // =========================
    // Schedule Snapshot
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
    // Pricing Snapshot
    // =========================

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    agreedPricePerDay!: string;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        default: "0.00",
    })
    deliveryFee!: string;

    // Separate moderator-set charges, snapshotted when the rental is created.
    @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
    ownerRentalFee!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
    ownerDeliveryFee!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
    renterRentalFee!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
    renterDeliveryFee!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
    ownerTotalPayable!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: "0.00" })
    renterTotalPayable!: string;

    // agreedPricePerDay * rentalDays

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    rentalAmount!: string;

    @Column({
        type: "decimal",
        precision: 5,
        scale: 2,
    })
    platformCommissionRate!: string;

    // rentalAmount * rate / 100

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    platformCommissionAmount!: string;

    // rentalAmount + deliveryFee

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    totalPayable!: string;

    // =========================
    // Location Snapshot
    // =========================

    @Column({
        type: "text",
    })
    pickupAddress!: string;

    @Column({
        type: "text",
    })
    deliveryAddress!: string;

    @Column({
        type: "varchar",
        length: 20,
    })
    contactPhone!: string;

    // =========================
    // Status
    // =========================

    @Column({
        type: "enum",
        enum: ActualRentalStatus,
        default: ActualRentalStatus.PENDING_HANDOVER,
    })
    status!: ActualRentalStatus;

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
}

@Entity("rental_state_history")
export class RentalStateHistory {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    rentalId!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    status!: string;

    @Column({
        type: "text",
        nullable: true,
    })
    note?: string;

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    actorId?: string | null;

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt!: Date;
}
