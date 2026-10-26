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

import { User } from "src/modules/users/entity/user-entity";
import {
    CheckpointMediaType,
    HandoverCheckpointStatus,
    HandoverStage,
} from "../enum/handover-stage.enum";

// =====================================================
// HANDOVER CHECKPOINT
// One row per verified custody transfer.
// =====================================================

@Entity("handover_checkpoints")
export class HandoverCheckpoint {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // Checkpoint ID
    // =========================

    @Column({
        type: "varchar",
        length: 50,
        unique: true,
    })
    checkpointId!: string;

    // =========================
    // Rental Reference
    // =========================

    @Column({
        type: "varchar",
        length: 50,
    })
    rentalId!: string;

    // =========================
    // Stage
    // =========================

    @Column({
        type: "enum",
        enum: HandoverStage,
    })
    stage!: HandoverStage;

    // =========================
    // Actors
    // =========================

    // Who executed this checkpoint
    // (rider / renter / owner userId).

    @Column({
        type: "varchar",
        length: 50,
    })
    actorId!: string;

    // Moderator ID — saved when a moderator
    // warehouse gate is verified.
    // (Captured server-side from JWT.)

    @Column({
        type: "varchar",
        length: 50,
        nullable: true,
    })
    verifiedById?: string | null;

    // =========================
    // Status & Note
    // =========================

    @Column({
        type: "enum",
        enum: HandoverCheckpointStatus,
        default: HandoverCheckpointStatus.PENDING,
    })
    status!: HandoverCheckpointStatus;

    @Column({
        type: "text",
        nullable: true,
    })
    note?: string | null;

    // =========================
    // Early Return (Stage 4)
    // =========================

    // Set server-side when the rider submits the
    // return-pickup checkpoint before the rental
    // endDate. The moderator must approve the
    // early return before the OTP is sent.

    @Column({
        type: "boolean",
        default: false,
    })
    isEarlyReturn!: boolean;

    @Column({
        type: "boolean",
        nullable: true,
    })
    earlyReturnApproved?: boolean | null;

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

    @Column({
        type: "timestamp",
        nullable: true,
    })
    verifiedAt?: Date | null;

    // =========================
    // Relations
    // =========================

    @ManyToOne(() => User)
    @JoinColumn({
        name: "actorId",
        referencedColumnName: "userId",
    })
    actor?: User;

    @ManyToOne(() => User)
    @JoinColumn({
        name: "verifiedById",
        referencedColumnName: "userId",
    })
    verifiedBy?: User;

    @OneToMany(
        () => CheckpointMedia,
        (media) => media.checkpoint,
    )
    media!: CheckpointMedia[];
}

// =====================================================
// CHECKPOINT MEDIA
// Photos (mandatory) + videos (optional)
// captured at each rider checkpoint.
// =====================================================

@Entity("checkpoint_media")
export class CheckpointMedia {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    // =========================
    // Checkpoint Reference
    // =========================

    @Column({
        type: "varchar",
        length: 50,
    })
    checkpointId!: string;

    // =========================
    // Media Type
    // =========================

    @Column({
        type: "enum",
        enum: CheckpointMediaType,
    })
    mediaType!: CheckpointMediaType;

    // =========================
    // File Path
    // =========================

    @Column({
        type: "varchar",
        length: 500,
    })
    fileUrl!: string;

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
        () => HandoverCheckpoint,
        (checkpoint) => checkpoint.media,
        {
            onDelete: "CASCADE",
        },
    )
    @JoinColumn({
        name: "checkpointId",
        referencedColumnName: "checkpointId",
    })
    checkpoint!: HandoverCheckpoint;
}
