import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

export enum RentalChargePayerRole {
    OWNER = "OWNER",
    RENTER = "RENTER",
}

export enum RentalChargeType {
    RENTAL = "RENTAL",
    DELIVERY = "DELIVERY",
}

export enum RentalChargeStatus {
    PENDING = "PENDING",
    SUBMITTED = "SUBMITTED",
    CONFIRMED = "CONFIRMED",
    REJECTED = "REJECTED",
    NO_CHARGE = "NO_CHARGE",
}

export enum RentalChargePaymentMethod {
    CASH = "CASH",
    BANK_TRANSFER = "BANK_TRANSFER",
    MOBILE_PAYMENT = "MOBILE_PAYMENT",
}

export enum RentalChargeEventAction {
    SUBMITTED = "SUBMITTED",
    CONFIRMED = "CONFIRMED",
    REJECTED = "REJECTED",
}

@Entity("rental_charges")
@Index(["rentalId", "payerRole", "type"], { unique: true })
export class RentalCharge {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 50, unique: true })
    chargeId!: string;

    @Column({ type: "varchar", length: 50 })
    rentalId!: string;

    @Column({ type: "varchar", length: 50 })
    rentalRequestId!: string;

    @Column({ type: "varchar", length: 50 })
    payerId!: string;

    @Column({ type: "enum", enum: RentalChargePayerRole })
    payerRole!: RentalChargePayerRole;

    @Column({ type: "enum", enum: RentalChargeType })
    type!: RentalChargeType;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: string;

    @Column({
        type: "enum",
        enum: RentalChargeStatus,
        default: RentalChargeStatus.PENDING,
    })
    status!: RentalChargeStatus;

    @Column({
        type: "enum",
        enum: RentalChargePaymentMethod,
        nullable: true,
    })
    paymentMethod?: RentalChargePaymentMethod | null;

    @Column({ type: "varchar", length: 120, nullable: true })
    paymentReference?: string | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    collectedById?: string | null;

    @Column({ type: "timestamp", nullable: true })
    collectedAt?: Date | null;

    @Column({ type: "timestamp", nullable: true })
    submittedAt?: Date | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    verifiedById?: string | null;

    @Column({ type: "timestamp", nullable: true })
    verifiedAt?: Date | null;

    @Column({ type: "text", nullable: true })
    verificationNote?: string | null;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}

@Entity("rental_charge_events")
export class RentalChargeEvent {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 50 })
    chargeId!: string;

    @Column({ type: "enum", enum: RentalChargeEventAction })
    action!: RentalChargeEventAction;

    @Column({ type: "varchar", length: 50 })
    actorId!: string;

    @Column({
        type: "enum",
        enum: RentalChargePaymentMethod,
        nullable: true,
    })
    paymentMethod?: RentalChargePaymentMethod | null;

    @Column({ type: "varchar", length: 120, nullable: true })
    paymentReference?: string | null;

    @Column({ type: "text", nullable: true })
    note?: string | null;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;
}
