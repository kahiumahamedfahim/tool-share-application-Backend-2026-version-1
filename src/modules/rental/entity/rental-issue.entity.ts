import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";

import { RentalRequest } from "./rental-request.entity";
import { User } from "../../users/entity/user-entity";

export enum IssueCategory {
    PRODUCT_DAMAGE = "PRODUCT_DAMAGE",
    MISSING_ITEMS = "MISSING_ITEMS",
    LATE_RETURN = "LATE_RETURN",
    CASH_DISCREPANCY = "CASH_DISCREPANCY",
    OTHER = "OTHER",
}

export enum IssueSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL",
}

export enum IssueStatus {
    OPEN = "OPEN",
    IN_REVIEW = "IN_REVIEW",
    RESOLVED = "RESOLVED",
    REJECTED = "REJECTED",
    ESCALATED = "ESCALATED",
}

export enum IssueResolution {
    REFUND_FULL = "REFUND_FULL",
    REFUND_PARTIAL = "REFUND_PARTIAL",
    REPAIR_CHARGE = "REPAIR_CHARGE",
    REPLACEMENT_CHARGE = "REPLACEMENT_CHARGE",
    NO_ACTION = "NO_ACTION",
    PENALTY_RENTER = "PENALTY_RENTER",
}

@Entity("rental_issues")
@Index(["rentalRequestId", "status"], { unique: false })
export class RentalIssue {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    issueId!: string;

    @Column({ type: "varchar", length: 50 })
    rentalId!: string;

    @Column({ type: "varchar", length: 50 })
    rentalRequestId!: string;

    @Column({ type: "varchar", length: 50 })
    raisedById!: string;

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    raisedByRole?: string | null;

    @Column({
        type: "enum",
        enum: IssueCategory,
    })
    category!: IssueCategory;

    @Column({
        type: "enum",
        enum: IssueSeverity,
        default: IssueSeverity.MEDIUM,
    })
    severity!: IssueSeverity;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text", nullable: true })
    description?: string | null;

    @Column({
        type: "text",
        nullable: true,
    })
    evidenceReference?: string | null;

    @Column({
        type: "enum",
        enum: IssueStatus,
        default: IssueStatus.OPEN,
    })
    status!: IssueStatus;

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    assignedToId?: string | null;

    @Column({
        type: "enum",
        enum: IssueResolution,
        nullable: true,
    })
    resolution?: IssueResolution | null;

    @Column({ type: "text", nullable: true })
    resolutionNote?: string | null;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: true,
    })
    resolutionAmount?: string | null;

    @Column({ type: "timestamp", nullable: true })
    resolvedAt?: Date | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    resolvedById?: string | null;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;

    @ManyToOne(() => RentalRequest)
    @JoinColumn({
        name: "rentalRequestId",
        referencedColumnName: "rentalRequestId",
    })
    rentalRequest!: RentalRequest;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "raisedById",
        referencedColumnName: "userId",
    })
    raisedBy!: User;
}
