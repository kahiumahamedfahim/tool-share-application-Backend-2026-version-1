import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

export enum RentalPaymentStatus {
    // Waiting for the rider (or owner,
    // for pickup-only rentals) to
    // collect the cash from the renter.
    PENDING = "PENDING",

    // Rider has the cash and must
    // hand it over to the owner.
    COLLECTED_BY_RIDER = "COLLECTED_BY_RIDER",

    // Rider delivered the cash
    // to the owner.
    DELIVERED_TO_OWNER = "DELIVERED_TO_OWNER",

    // Owner confirmed receiving.
    CONFIRMED = "CONFIRMED",
}

@Entity("rental_payments")
export class RentalPayment {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // Payment ID
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    paymentId!: string;

    // =========================
    // One payment per rental
    // (manual/cash flow)
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    rentalId!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    rentalRequestId!: string;

    // =========================
    // Amount snapshot
    // =========================

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    amount!: string;

    @Column({
        type: "varchar",
        length: 20,
        default: "CASH",
    })
    method!: string;

    // =========================
    // Cash Flow Tracking
    // =========================

    @Column({
        type: "enum",
        enum: RentalPaymentStatus,
        default: RentalPaymentStatus.PENDING,
    })
    status!: RentalPaymentStatus;

    // Who collected the cash
    // (rider userId or owner userId).

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    collectedById?: string | null;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    collectedAt?: Date | null;

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    deliveredById?: string | null;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    deliveredAt?: Date | null;

    @Column({
        type: "timestamp",
        nullable: true,
    })
    confirmedAt?: Date | null;

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
