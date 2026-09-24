import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DocumentVerificationStatus } from '../enums/document-verification-status.enum';

import { User } from './user.entity';

@Entity('user_documents')
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'profile_image',
  })
  profileImage!: string;

  @Column({
    name: 'nid_number',
    unique: true,
  })
  nidNumber!: string;

  @Column({
    name: 'nid_front_image',
  })
  nidFrontImage!: string;

  @Column({
    name: 'nid_back_image',
  })
  nidBackImage!: string;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: DocumentVerificationStatus,
    default: DocumentVerificationStatus.PENDING,
  })
  verificationStatus!: DocumentVerificationStatus;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    nullable: true,
  })
  rejectionReason!: string | null;

  @Column({
    name: 'verified_at',
    type: 'timestamp',
    nullable: true,
  })
  verifiedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
  })
  updatedAt!: Date;

  // User 1:1 UserDocument
  @OneToOne(
    () => User,
    (user) => user.userDocument,
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
}