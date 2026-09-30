import { Column, Entity, PrimaryGeneratedColumn,OneToMany,CreateDateColumn,UpdateDateColumn,OneToOne} from "typeorm";
import { UserStatus } from "../enums/user-status-enum";
import { UserRole } from "../enums/user-role-enum";
import { EmailVerification } from "./email-verification.entity";
import { UserDocument } from "./user-document.entity";
@Entity('users')
export class User 
{
    @PrimaryGeneratedColumn('uuid')
    id! : string ;

    @Column(
        {
            type:"varchar",
            length:50,
            unique: true,
        }
    )
    userId!: string;

    @Column(
        {
            type :"varchar",
            length : 100,
            
        }
    )
    firstName!: string;
    @Column({
        type : "varchar",
        length: 100,
    })
    lastName!: string ;
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email!: string;

  @Column({
    type:'boolean',
    default:false
  })
  emailVerificationStatus!: boolean;
  @Column({
    type: 'varchar',
    length: 20,
    unique: true,
  })
  phone!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  password!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
  })
  status!: UserStatus;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt!: Date;
  @OneToMany(
  () => EmailVerification,
  (emailVerification) => emailVerification.user,
)


  emailVerifications!: EmailVerification[];

  @OneToOne(
  () => UserDocument,
  (userDocument) => userDocument.user,
)
userDocument!: UserDocument;
}

