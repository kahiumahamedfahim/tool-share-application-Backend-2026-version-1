import {
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Column } from "typeorm";
import { HandoverStage } from "../enum/handover-stage.enum";

@Entity("handover_rider_assignments")
@Index(["rentalId", "stage", "assignedAt"])
export class HandoverRiderAssignment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 50, unique: true })
    assignmentId!: string;

    @Column({ type: "varchar", length: 50 })
    rentalId!: string;

    @Column({ type: "enum", enum: HandoverStage })
    stage!: HandoverStage;

    @Column({ type: "varchar", length: 50 })
    riderId!: string;

    @Column({ type: "varchar", length: 50 })
    assignedById!: string;

    @CreateDateColumn({ type: "timestamp" })
    assignedAt!: Date;
}
