import e from "express";
import { filterLogLevels, Injectable } from '@nestjs/common';
import { DataSource, Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { RegisterUserDto } from "../users/Dto/register-user.dto";

import { EmailVerificationStatus } from "../users/enums/email-verification-status.enum";
import { UserRole } from "../users/enums/user-role.enum";
import bcrypt from 'bcrypt';
import { UserDocument } from "../users/entities/user-document.entity";
import { Multer } from "multer";
import { DocumentVerificationStatus } from "../users/enums/document-verification-status.enum";
import { EmailVerification } from "../users/entities/email-verification.entity";
import { EmailService } from "../../email/email.service";
import { UserStatus } from "../users/enums/user-status.enum";
import { promises } from "dns";
import { error } from "console";
import { iif, throwError } from "rxjs";
import { RegisterAdminDto } from "../users/Dto/register-admin.dto";
import { Admin } from "typeorm/driver/mongodb/typings.js";
import { RegisterModeratorDto } from "../users/Dto/register-moderator.dto";
import { RegisterRiderDto } from "../users/Dto/register-rider.dto";
import { RiderProfile } from "../users/entities/rider-profile.entity";
import { RiderStatus } from "../users/enums/rider-status.enum";
import { RiderDocument } from "../users/entities/rider-document.entity";
import { AcceptUserDocumentDto } from "../users/Dto/AcceptUserDocumentDto";
import { RejectUserDocumentDto } from "../users/Dto/RejectUserDocumentDto";


@Injectable()
export class AuthService 
{

constructor(
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService
)
 {

 }

private validateExistringUser(user : User |null) :void 
{
    if(!user)
    {
        return ;
    }
    if(user.emailVerificationStatus===EmailVerificationStatus.VERIFIED)
    {
        throw new Error('User already exists and is verified'); 
    }
} 

private async generateUserId(
  userRepository: Repository<User>,
  role: UserRole,
): Promise<string> {

  let prefix: string;

  switch (role) {
    case UserRole.ADMIN:
      prefix = 'ToolAdmin';

      break;

    case UserRole.MODERATOR:
      prefix = 'ToolModerator';

      break;

    case UserRole.RIDER:
      prefix = 'ToolRider';

      break;

    case UserRole.USER:
      prefix = 'ToolUser';

      break;
  }

  const lastUser =
    await userRepository.findOne({
      where: {
        role,
      },
      order: {
        userId: 'DESC',
      },
    });

  let nextNumber = 1;

  if (lastUser) {

    const lastNumber =
      parseInt(
        lastUser.userId.split('-')[1],
        10,
      );

    nextNumber = lastNumber + 1;
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}
private generateVerificationCode(): string {
  return Math.floor(
    100000 + Math.random() * 900000,
  ).toString();
}

private generatVerificationExpiry(): Date
{
    const result =  new Date (Date.now()+10*60*1000);
    return result;
}
private async createUserRegistration(
  dto: RegisterUserDto,
  role: UserRole,
  file: {
    profileImage: Express.Multer.File[];
    nidFrontImage: Express.Multer.File[];
    nidBackImage: Express.Multer.File[];
  },
): Promise<User> 
{
    const querryRunner = this.dataSource.createQueryRunner();
    await querryRunner.connect();
    await querryRunner.startTransaction();
    let verificationcode : string ;
    try 
    {
        const userRepository= querryRunner.manager.getRepository(User);
        const userDocumentRepositopry= querryRunner.manager.getRepository(UserDocument);
        const emailVerificationRepository= querryRunner.manager.getRepository(EmailVerification);
        const userId = await this.generateUserId(userRepository, role);
        const hasedPassword= await bcrypt.hash(dto.password,10);
        const user = userRepository.create 
        (
            {
                userId,
                firstName: dto.firstName,
                lastName : dto.lastName,
                email : dto.email,
                phone : dto.phone,
                password : hasedPassword,
                role ,
                status : UserStatus.PENDING,
                emailVerificationStatus : EmailVerificationStatus.PENDING,
            
            }
        );
        await userRepository.save(user);

        const userDocument= userDocumentRepositopry.create(
            {
                userId : user.id,
                profileImage : file.profileImage[0].filename,
                nidFrontImage : file.nidFrontImage[0].filename,
                nidBackImage: file.nidBackImage[0].filename,
                nidNumber : dto.nidNumber,
                verificationStatus: DocumentVerificationStatus.PENDING,
            }
        );
        await userDocumentRepositopry.save(userDocument);
        
        verificationcode= this.generateVerificationCode();
        const expiredAt=this.generatVerificationExpiry();
        const emailVerification= emailVerificationRepository.create(
            {
                userId: user.id,
                verificationCode : verificationcode,
                expiresAt: expiredAt,
                verifiedAt: null,



            }
        );
        await emailVerificationRepository.save(emailVerification);
        await querryRunner.commitTransaction();
        await this.emailService.sendEmailVerification(dto.email, verificationcode);
        return user ;


    }
    catch(error)
    {
            await querryRunner.rollbackTransaction();
            throw error;
    }
    finally
    {
        await querryRunner.release();
    }
}

private async findLatestEmailVerification(userId : string ) : Promise<EmailVerification | null>
{
        const emailVerificationRepository= this.dataSource.getRepository(EmailVerification);
        const result = await emailVerificationRepository.findOne(
            {
                where : 
                {
                    userId,
                },
                order: 
                {
                    createdAt :'DESC'
                },
            }
        );
        return result;

}
async verifyemail(email : string ,verificationCode : string ) : Promise <void>
{
    const userRepository= this.dataSource.getRepository(User);
    const user = await userRepository.findOne(
        {
            where : 
            {
                email,
            },
        }

    );
    if(!user)
    {
        throw new error ('user not found!');
    }
    if(user.emailVerificationStatus===EmailVerificationStatus.VERIFIED)
    {
        throw new error ('email is already verifieed!');
    }
    const emailVerification =
    await this.findLatestEmailVerification(user.id);
    if(!emailVerification)
    {
     throw new Error('email verification record not found!');
    }
    if(emailVerification.verificationCode!==verificationCode)
    {
      throw new error ('Invalid verification code.');
    }
    if(new Date()>emailVerification.expiresAt)
    {
        throw new Error('verification code has Expired.');
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try 
    {
        const emailVerificationRepository= queryRunner.manager.getRepository(EmailVerification);
        const userRepository=queryRunner.manager.getRepository(User);
        emailVerification.verifiedAt= new Date();
        await emailVerificationRepository.save(emailVerification);
        user.emailVerificationStatus=EmailVerificationStatus.VERIFIED;
        await  userRepository.save(user);
        await queryRunner.commitTransaction();

    }
    
    catch(error)
    {
             await queryRunner.rollbackTransaction();

    throw error;
    }
    finally
    {
        await queryRunner.release();
    }
}
    async resendOtp(email : string ) : Promise<void>
    {
          const userRepository = this.dataSource.getRepository(User);
          const user = await userRepository.findOne(
            {
                where :
                {
                    email,
                },
            }
          );
          if(!user)
          {
            throw new error('user not found!');
          }
          if(user.emailVerificationStatus===EmailVerificationStatus.VERIFIED)
          {
            throw new Error('email is already verified');
          }
          const querryRunner = this.dataSource.createQueryRunner();
          await querryRunner.connect();
          await querryRunner.startTransaction();


          try
          {
          
          const emailVerificationRepository= querryRunner.manager.getRepository(EmailVerification);
          const verificationCode =this.generateVerificationCode();
          const expiredAt= this.generatVerificationExpiry();
          const emailVerification= emailVerificationRepository.create(
            {
                userId:user.id,
                verificationCode,
                verifiedAt: null,
                expiresAt: expiredAt,
            }
        );
        

          await emailVerificationRepository.save(emailVerification);
          await querryRunner.commitTransaction();

          await this.emailService.sendEmailVerification(user.email, verificationCode);


    }
    catch(error)
    {
            await querryRunner.rollbackTransaction();
            throw error;
    }
    finally
    {
            await querryRunner.release();
    }
}
 async register(dto: RegisterUserDto,
    file : 
    {
            profileImage : Express.Multer.File[];
            nidFrontImage : Express.Multer.File[];
            nidBackImage : Express.Multer.File[];
    },
 ) : Promise<User>
 {
    const userRepository= this.dataSource.getRepository(User);
    const existingUser=  await userRepository.findOne(
        {
            where:
            {
                email : dto.email,
            }
        },

    );
    this.validateExistringUser(existingUser);
    return this.createUserRegistration(dto, UserRole.USER, file);


 }
 async registerAdmin(dto : RegisterAdminDto, files :
    {
        profileImage: Express.Multer.File[];
        nidFrontImage:Express.Multer.File[];
        nidBackImage:Express.Multer.File[];
    },
 ): Promise<User>
 {
    const userRepsitory= this.dataSource.getRepository(User);
    const existingUser= await userRepsitory.findOne(
        {
            where:
            {
                email : dto.email,
            }
        }
    );
    this.validateExistringUser(existingUser);
    return this.createUserRegistration(dto, UserRole.ADMIN, files);
 }

 async registerModerator(dto: RegisterModeratorDto, files :
    {
        profileImage : Express.Multer.File[],
        nidFrontImage: Express.Multer.File[],
        nidBackImage: Express.Multer.File[],
    }
 ) : Promise <User>
 {
    const userRepository= this.dataSource.getRepository(User);
    const existingUser= await userRepository.findOne(
        {
            where : 
            {
                email : dto.email.trim(),
            }
        }
    );
    this.validateExistringUser(existingUser);
     return this.createUserRegistration(dto, UserRole.MODERATOR, files);
 }
 async registerRider(
  dto: RegisterRiderDto,
  files: {
    profileImage: Express.Multer.File[];
    nidFrontImage: Express.Multer.File[];
    nidBackImage: Express.Multer.File[];
    drivingLicenseFront: Express.Multer.File[];
    drivingLicenseBack: Express.Multer.File[];
    vehicleImage: Express.Multer.File[];
  },
): Promise<User> 
 {
        const userRepository=this.dataSource.getRepository(User);
        const existingUser= await userRepository.findOne(
            {
                where :
                {
                    email: dto.email.trim(),
                }
            }
        );
        this.validateExistringUser(existingUser);

        const querryRunner= this.dataSource.createQueryRunner();
        await querryRunner.connect();
        await querryRunner.startTransaction();
        try 
        {

            const transectionUserRepository = querryRunner.manager.getRepository(User);
            const userId= await this.generateUserId(transectionUserRepository, UserRole.RIDER);
            const hasedPassword = await bcrypt.hash(dto.password, 10);
            const user = transectionUserRepository.create(
                {
                    userId,
                    firstName : dto.firstName.trim(),
                    lastName: dto.lastName.trim(),
                    email : dto.email.trim(),
                    phone : dto.phone.trim(),
                    password : dto.phone.trim(),
                    role : UserRole.RIDER,
                    status : UserStatus.PENDING,
                    emailVerificationStatus : EmailVerificationStatus.PENDING,

                }
            );
            await transectionUserRepository.save(user);
            const userDocumentRepository = querryRunner.manager.getRepository(UserDocument);
            const userDocument = userDocumentRepository.create(
                {
                    userId: user.id,
                    profileImage: files.profileImage[0].filename,
                    nidNumber : dto.nidNumber.trim(),
                    nidFrontImage : files.nidFrontImage[0].filename,
                    nidBackImage: files.nidBackImage[0].filename,
                    verificationStatus: DocumentVerificationStatus.PENDING,
                    rejectionReason: null,
                    verifiedAt : null,
                }
            );
            await userDocumentRepository.save(userDocument);
            const riderProfileRepository= querryRunner.manager.getRepository(RiderProfile);
            const riderProfile= riderProfileRepository.create(
                {
                    userId: user.id,
                    riderStatus: RiderStatus.PENDING,
                }
            );
            await riderProfileRepository.save(riderProfile);

            const riderDocumentRepository= querryRunner.manager.getRepository(RiderDocument);
            const riderDocument= riderDocumentRepository.create(
                {
                    riderProfileId : riderProfile.id,
                    drivingLicenseNumber : dto.drivingLicenseNumber,
                    drivingLicenseFront : files.drivingLicenseFront[0].filename,
                    drivingLicenseBack : files.drivingLicenseBack[0].filename,
                    vehicleType : dto.vehicleType.trim(),
                    vehicleRegistrationNumber: dto.vehicleRegistrationNumber.trim(),
                    vehicleBrand : dto.vehicleBrand.trim(),
                    vehicleModel : dto.vehicleModel.trim(),
                    vehicleImage: files.vehicleImage[0].filename,
                    verificationStatus:DocumentVerificationStatus.PENDING,
                    rejectionReason: null,
                    verifiedAt: null,




                }
            );
            await riderDocumentRepository.save(riderDocument);

            const emailVerificationRepository= querryRunner.manager.getRepository(EmailVerification);
            const verificaitonCode = this.generateVerificationCode();
            const expiredAt = this.generatVerificationExpiry();
            const emailVerification= emailVerificationRepository.create(
                {
                    userId:user.id,
                    verificationCode: verificaitonCode,
                    expiresAt:expiredAt,
                    verifiedAt: null

                }
            );
            await emailVerificationRepository.save(emailVerification);

            await querryRunner.commitTransaction();
            await this,this.emailService.sendEmailVerification(user.email, verificaitonCode);
            return user;

        }
        catch(error)
        {
            await querryRunner.rollbackTransaction();
            throw error;
        }
        finally
        {
            await querryRunner.release();
        }

 }
async acceptUserDocument(
  dto: AcceptUserDocumentDto,
): Promise<void> {
  const userRepository =
    this.dataSource.getRepository(User);

  const userDocumentRepository =
    this.dataSource.getRepository(UserDocument);

  const user =
    await userRepository.findOne({
      where: {
        userId: dto.userId,
      },
    });

  if (!user) {
    throw new Error('User not found.');
  }

  const userDocument =
    await userDocumentRepository.findOne({
      where: {
        userId: user.id,
      },
    });

  if (!userDocument) {
    throw new Error('User document not found.');
  }

  if (
    userDocument.verificationStatus ===
    DocumentVerificationStatus.APPROVED
  ) {
    throw new Error('User document is already verified.');
  }

  userDocument.verificationStatus =
    DocumentVerificationStatus.APPROVED;

  userDocument.rejectionReason = null;

  userDocument.verifiedAt = new Date();

  await userDocumentRepository.save(userDocument);
}

async rejectUserDocument(
  dto: RejectUserDocumentDto,
): Promise<void> {
  const userRepository =
    this.dataSource.getRepository(User);

  const userDocumentRepository =
    this.dataSource.getRepository(UserDocument);

  const user =
    await userRepository.findOne({
      where: {
        userId: dto.userId,
      },
    });

  if (!user) {
    throw new Error('User not found.');
  }

  const userDocument =
    await userDocumentRepository.findOne({
      where: {
        userId: user.id,
      },
    });

  if (!userDocument) {
    throw new Error('User document not found.');
  }

  if (
    userDocument.verificationStatus ===
    DocumentVerificationStatus.APPROVED
  ) {
    throw new Error(
      'Verified document cannot be rejected.',
    );
  }

  userDocument.verificationStatus =
    DocumentVerificationStatus.REJECTED;

  userDocument.rejectionReason =
    dto.rejectionReason.trim();

  userDocument.verifiedAt = null;

  await userDocumentRepository.save(userDocument);
}
}

