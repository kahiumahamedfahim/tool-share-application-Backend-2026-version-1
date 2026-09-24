import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { RiderStatus } from '../enums/rider-status.enum';
import { User } from './user.entity';
import { RiderDocument } from './rider-document.entity';

@Entity('rider_profiles')
export class RiderProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'rider_status',
    type: 'enum',
    enum: RiderStatus,
    default: RiderStatus.PENDING,
  })
  riderStatus!: RiderStatus;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;

  // User ↔ RiderProfile
  @OneToOne(
    () => User,
    (user) => user.riderProfile,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'user_id',
  })
  user!: User;

  @Column({
  name: 'user_id',
  type: 'uuid',
  unique: true,
})
userId!: string;

  // RiderProfile ↔ RiderDocument
  @OneToOne(
    () => RiderDocument,
    (riderDocument) => riderDocument.riderProfile,
    {
      onDelete: 'CASCADE',
    },
  )
  riderDocument!: RiderDocument;
}