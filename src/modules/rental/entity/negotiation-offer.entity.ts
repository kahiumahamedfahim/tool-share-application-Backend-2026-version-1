import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { RentalRequest } from "./rental-request.entity";
import { User } from "src/modules/users/entity/user-entity";

export enum NegotiationOfferStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
}

@Entity("negotiation_offers")
export class NegotiationOffer {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // Offer ID
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    offerId!: string;

    // =========================
    // Rental Request
    // =========================

    @Column({
        type: "varchar",
        length: 50,
    })
    rentalRequestId!: string;

    // =========================
    // Sender
    // =========================

    @Column({
        type: "varchar",
        length: 50,
    })
    senderId!: string;

    // =========================
    // Offer Details
    // =========================

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
    })
    offeredPricePerDay!: string;

    @Column({
        type: "text",
        nullable: true,
    })
    message?: string;

    // =========================
    // Offer Status
    // =========================

    @Column({
        type: "enum",
        enum: NegotiationOfferStatus,
        default: NegotiationOfferStatus.PENDING,
    })
    status!: NegotiationOfferStatus;

    // =========================
    // Timestamp
    // =========================

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt!: Date;

    // =========================
    // Relations
    // =========================

    @ManyToOne(
        () => RentalRequest,
        (rentalRequest) => rentalRequest.negotiationOffers,
        {
            onDelete: "CASCADE",
        },
    )
    @JoinColumn({
        name: "rentalRequestId",
        referencedColumnName: "rentalRequestId",
    })
    rentalRequest!: RentalRequest;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "senderId",
        referencedColumnName: "userId",
    })
    sender!: User;
}