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

import { RiderProfile } from './rider-profile.entity';

@Entity('rider_documents')
export class RiderDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'driving_license_number',
    type: 'varchar',
    nullable: true,
  })
  drivingLicenseNumber!: string | null;

  @Column({
    name: 'driving_license_front',
    type: 'varchar',
    nullable: true,
  })
  drivingLicenseFront!: string | null;

  @Column({
    name: 'driving_license_back',
    type: 'varchar',
    nullable: true,
  })
  drivingLicenseBack!: string | null;

  @Column({
    name: 'vehicle_type',
    type: 'varchar',
    nullable: true,
  })
  vehicleType!: string | null;

  @Column({
    name: 'vehicle_registration_number',
    type: 'varchar',
    nullable: true,
  })
  vehicleRegistrationNumber!: string | null;

  @Column({
    name: 'vehicle_brand',
    type: 'varchar',
    nullable: true,
  })
  vehicleBrand!: string | null;

  @Column({
    name: 'vehicle_model',
    type: 'varchar',
    nullable: true,
  })
  vehicleModel!: string | null;

  @Column({
    name: 'vehicle_image',
    type: 'varchar',
    nullable: true,
  })
  vehicleImage!: string | null;

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

  // RiderProfile ↔ RiderDocument
  @OneToOne(
    () => RiderProfile,
    (riderProfile) => riderProfile.riderDocument,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'rider_profile_id',
  })
  riderProfile!: RiderProfile;

  @Column({
    name: 'rider_profile_id',
    type: 'uuid',
    unique: true,
  })
  riderProfileId!: string;
}