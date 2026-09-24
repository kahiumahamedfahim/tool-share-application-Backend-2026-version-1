import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';
import { EmailVerificationStatus } from '../enums/email-verification-status.enum';

import { UserDocument } from './user-document.entity';
import { EmailVerification } from './email-verification.entity';
import { RiderProfile } from './rider-profile.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'user_id',
    unique: true,
  })
  userId!: string;

  @Column({
    name: 'first_name',
  })
  firstName!: string;

  @Column({
    name: 'last_name',
  })
  lastName!: string;

  @Column({
    name: 'email',
    unique: true,
  })
  email!: string;

  @Column({
    unique: true,
  })
  phone!: string;

  @Column()
  password!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status!: UserStatus;

  @Column({
    name: 'email_verification_status',
    type: 'enum',
    enum: EmailVerificationStatus,
    default: EmailVerificationStatus.PENDING,
  })
  emailVerificationStatus!: EmailVerificationStatus;

  @Column({
    name: 'last_login_at',
    type: 'timestamp',
    nullable: true,
  })
  lastLoginAt!: Date | null;

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
    () => UserDocument,
    (userDocument) => userDocument.user,
  )
  userDocument!: UserDocument;

  // User 1:N EmailVerification
  @OneToMany(
    () => EmailVerification,
    (emailVerification) => emailVerification.user,
  )
  emailVerifications!: EmailVerification[];

  // User 1:1 RiderProfile
  @OneToOne(
    () => RiderProfile,
    (riderProfile) => riderProfile.user,
  )
  riderProfile!: RiderProfile;
}