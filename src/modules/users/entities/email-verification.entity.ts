import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity'; 

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'verification_code',
  })
  verificationCode!: string;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
  })
  expiresAt!: Date;

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

  //relationship
  @ManyToOne(
  () => User,
  (user) => user.emailVerifications,
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