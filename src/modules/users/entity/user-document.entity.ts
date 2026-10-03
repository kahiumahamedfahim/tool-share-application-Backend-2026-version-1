import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './user-entity';
import { DocumentVerificationStatus } from '../enums/document-verification-status.enum';

@Entity('user_documents')
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  profileImage!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  nidNumber!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  nidFrontImage!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  nidBackImage!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  drivingLicenseNumber!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  drivingLicenseFrontImage!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  drivingLicenseBackImage!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  vehicleImage!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  vehicleNumber!: string | null;

   @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  vehicleType!: string | null;

  @Column({
    type: 'enum',
    enum: DocumentVerificationStatus,
    default: DocumentVerificationStatus.PENDING,
  })
  verificationStatus!: DocumentVerificationStatus;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  documentVerifiedBy!: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  documentVerifiedAt!: Date | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  rejectionReason!: string | null;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.userDocument, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    referencedColumnName: 'userId',
  })
  user!: User;
}