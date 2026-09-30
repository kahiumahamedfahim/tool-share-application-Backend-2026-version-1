import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from './user-entity';

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
  })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  email!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  verificationCode!: string;

  @Column({
    type: 'boolean',
    default: false,
  })
  isUsed!: boolean;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt!: Date;

  @Column({
    type: 'timestamp',
  })
  expiredAt!: Date;

  @ManyToOne(()=>User, (user)=>user.emailVerifications,
{
    onDelete: 'CASCADE',
})
@JoinColumn({
  name: 'userId',
  referencedColumnName: 'userId',
})
user!: User;

  }