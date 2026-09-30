import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { UserRole } from "./enums/user-role-enum";
import { User } from "./entity/user-entity";
import * as bcrypt from 'bcrypt';
import { CreateAdminDto } from "./dto/create-admin.dto";
import { CreateUserData } from "./interfaces/create-user-data.interface";
import { UserStatus } from "./enums/user-status-enum";
import { CreateUserDocumentData } from "./interfaces/create-user-document-data.interface";
import { Express } from "express";
import { Multer } from "multer";
import { UserDocument } from "./entity/user-document.entity";
import { DocumentVerificationStatus } from "./enums/document-verification-status.enum";
import { randomInt } from "crypto";
import { EmailVerification } from "./entity/email-verification.entity";
import { EmailModule } from "src/email/email.module";
import { EmailService } from "src/email/email.service";
import { ApproveUserDocumentDto } from "./dto/approve-user-document.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ExceptionsHandler } from "@nestjs/core/exceptions/exceptions-handler";
import { ResendVerificationCodeDto } from "./dto/resend-verification-code.dto";

@Injectable()
export class UserService 
{
    private readonly userDocumentRepsitory : Repository<UserDocument>
    private readonly userRepository: Repository<User>
    private readonly emailVerificationRepository : Repository<EmailVerification>
        constructor(private readonly dataSource : DataSource,
        private readonly emailService : EmailService

    )
    {
        this.userDocumentRepsitory=this.dataSource.getRepository(UserDocument);
        this.userRepository=this.dataSource.getRepository(User);
        this.emailVerificationRepository=this.dataSource.getRepository(EmailVerification);

    }
    

private async genarateUserId(
  manager: EntityManager,
  role: UserRole,
): Promise<string> {
  let prefix: string;

  switch (role) {
    case UserRole.ADMIN:
      prefix = 'TOS-Admin';
      break;

    case UserRole.MODERATOR:
      prefix = 'TOS-Moderator';
      break;

    case UserRole.RIDER:
      prefix = 'TOS-Rider';
      break;

    case UserRole.USER:
      prefix = 'TOS-User';
      break;

    default:
      throw new BadRequestException('Invalid user role');
  }
const lastUser = await manager
  .createQueryBuilder(User, 'user')
  .where('user.userId LIKE :prefix', {
    prefix: `${prefix}-%`,
  })
  .orderBy('user.userId', 'DESC')
  .getOne();
  let nextNumber = 1;

if (lastUser) {
  const lastNumber = parseInt(
    lastUser.userId.split('-').pop()!,
    10,
  );

  nextNumber = lastNumber + 1;
}
const formattedNumber = nextNumber
  .toString()
  .padStart(3, '0');
  return `${prefix}-${formattedNumber}`;
}

private async hasedPassword(password :string ): Promise<string>
{
    const salt = await bcrypt.genSalt();
    const hasedPassword= await bcrypt.hash(password,salt);
    return hasedPassword;
}

private async createUser(
    manager: EntityManager,
    data: CreateUserData,
    role : UserRole,
):Promise<User>
{
    const userId = await this.genarateUserId(manager,role);
    const hasedPassword= await this.hasedPassword(data.password);
    const user= manager.create(User,
        {
            userId,
            firstName:data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            password: hasedPassword,
            role,
            status:UserStatus.ACTIVE,

        }
    );
    return await manager.save(User, user);
}

private async createUserDocument(
    manager: EntityManager,
    userId : string ,
    data : CreateUserDocumentData,
    files : 
    {
        profileImage?:Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?:Express.Multer.File[];
    },
):Promise<UserDocument>
{
   const userDocument = manager.create(UserDocument, {
    userId,
    nidNumber: data.nidNumber,

    profileImage: files.profileImage?.[0]?.filename,
    nidFrontImage: files.nidFrontImage?.[0]?.filename,
    nidBackImage: files.nidBackImage?.[0]?.filename,

    verificationStatus: DocumentVerificationStatus.PENDING,
  });

  return await manager.save(UserDocument, userDocument);
}
private generateVerificationCode(): string 
{
    return randomInt(100000, 1000000).toString();
}
private async createEmailVerification(
    manager:EntityManager,
    userId: string,
    email : string ,

): Promise<EmailVerification>
{
    const verificationCode = this.generateVerificationCode();
    const expiredAt= new Date(Date.now() +10 *60 *1000);
    const emailVerification=manager.create(EmailVerification, 
        {
            userId,
            email,
            verificationCode,
            isUsed:false,
            expiredAt,
        }
    );
    return await manager.save(EmailVerification, emailVerification
    );
}
private async validateUserRegistration(
    manager:EntityManager,
    data: CreateUserData,
    nidNumber: string 
) : Promise<any>
{
    const existingEmail =await manager.findOne(User, 
        {
            where : 
            {
                email:data.email,
            }
        }
    );
    if(existingEmail)
    {
        throw new ConflictException("Email is already registred!");
    }
    const existingUserByPhone= await manager.findOne(User,
        {
            where :
            {
                phone : data.phone,
            }
        }
    );
    if(existingUserByPhone)
    {
        throw new ConflictException('phone number is already registered',)
    }
    const existingUserByDocumentNid= await manager.findOne(UserDocument,
        {
            where : 
            {
                nidNumber
            }
        }
    );
    if(existingUserByDocumentNid)
    {
        throw new ConflictException('Nid number is already registered!')
    }
}

async createAdmin(
    dto : CreateAdminDto,
    files : 
    {
        profileImage?:Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage ?: Express.Multer.File[];
    },
):Promise<any>
{
    const querryRunner = this.dataSource.createQueryRunner();
    await querryRunner.connect();
    await querryRunner.startTransaction();

    try 
    {
        const manager= querryRunner.manager;
        const userData: CreateUserData=
        {
            firstName: dto.firstName,
            lastName:dto.lastName,
            email : dto.email,
            phone:dto.phone,
            password:dto.password,
        };
        await this.validateUserRegistration(manager,
            userData,
            dto.nidNumber,
        )
        const user=await this.createUser(manager,userData,UserRole.ADMIN);
        const documentData:CreateUserDocumentData=
        {
            nidNumber : dto.nidNumber,
        };
        const userDocument= await this.createUserDocument(manager,
            user.userId,
            documentData,
            files
        );
        const emailVerification = await this.createEmailVerification(manager, 
            user.userId,
            user.email
        );
        await querryRunner.commitTransaction();
        await this.emailService.sendEmailVerification(user.email,
            emailVerification.verificationCode
        );
        return {
  message: 'Admin registered successfully. Please verify your email.',
  userId: user.userId,
};




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

async getPendingDocuments() : Promise<UserDocument[]>
{
    const documents = await this.userDocumentRepsitory.find(
        {
            where : 
            {
                verificationStatus: DocumentVerificationStatus.PENDING,

            }
        }
    );
    return documents;
    
}
async getUserDocumentById(userId : string ) : Promise<UserDocument>
{
    const document = await this.userDocumentRepsitory.findOne(
        {
            where : 
            {
                userId,
            }
        }
    );
    if(!document)
    {
        throw new NotFoundException('User document not found !');
    }
    return document;
}

async verifyEmail(
  dto: VerifyEmailDto,
): Promise<any> {

  try {

    // 1. Get the latest verification record
    const existingEmail =
      await this.emailVerificationRepository.findOne({
        where: {
          email: dto.email,
        },
        order: {
          createdAt: 'DESC',
        },
      });

    // 2. Verification record doesn't exist
    if (!existingEmail) {
      throw new NotFoundException(
        'Email is not registered yet',
      );
    }

    // 3. Check whether email is already verified
    if (existingEmail.isUsed === true) {
      throw new ConflictException(
        'Email is already verified!',
      );
    }

    // 4. Compare code with latest verification code
    if (
      existingEmail.verificationCode !==
      dto.verificationCode
    ) {
      throw new BadRequestException(
        'Invalid verification code!',
      );
    }

    // 5. Check expiration
    if (existingEmail.expiredAt < new Date()) {
      throw new BadRequestException(
        'Verification code is expired!',
      );
    }

    // 6. Mark verification as used
    existingEmail.isUsed = true;

    await this.emailVerificationRepository.save(
      existingEmail,
    );

    // 7. Find user
    const user = await this.userRepository.findOne({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    // 8. Mark user's email as verified
    user.emailVerificationStatus = true;

    await this.userRepository.save(user);

    // 9. Send confirmation email
    await this.emailService.sendEmailVerifiedConfirmation(
      dto.email,
      user.firstName,
    );

    return {
      success: true,
      message: 'Email verified successfully',
    };

  } catch (error) {
    throw error;
  }
}
async approveUserDocument(dto : ApproveUserDocumentDto,
  verifiedBy: string
) : Promise<any>
{
    const querryRunner = this.dataSource.createQueryRunner();
    await querryRunner.connect();
    await querryRunner.startTransaction();
    try 
    {
        const manager = querryRunner.manager;
        const userDocument = await manager.findOne(UserDocument,
            {
                where: 
                {
                    userId : dto.userId,
                }
            }
        )
        if(!userDocument)
        {
            throw new NotFoundException('user document not found here ');

        }
        if (
  userDocument.verificationStatus !==
  DocumentVerificationStatus.PENDING
) {
  throw new ConflictException(
    'User document has already been processed',
  );
}
userDocument.documentVerifiedBy=verifiedBy;
userDocument.documentVerifiedAt= new Date();

        userDocument.verificationStatus=DocumentVerificationStatus.APPROVED;
        await manager.save(UserDocument, userDocument);

        const user= await manager.findOne(User, 
            {
                where: 
                {
                        userId: dto.userId
                }
            }
        );
        if(!user)
        {
            throw new NotFoundException(`user not found for verifed document`);
        }
        user.status=UserStatus.ACTIVE;
        await manager.save(User, user);
        await querryRunner.commitTransaction();
        await this.emailService.documentVerifiedConfirmation(user.email,user.firstName);
        
           return {
            message: 'Document verification successful!',
            userId: user.userId,
                };
        
    }
    catch (error)
    {
        await querryRunner.rollbackTransaction();
        throw error;
    }
    finally
    {
         await querryRunner.release();
    }
}
async resendVerificationCode(
  dto: ResendVerificationCodeDto,
): Promise<any> {

  try {

    // 1. Find user
    const user = await this.userRepository.findOne({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    // 2. Check whether email is already verified
    if (user.emailVerificationStatus === true) {
      throw new ConflictException(
        'Email is already verified!',
      );
    }

    // 3. Get latest verification record
    const existingEmail =
      await this.emailVerificationRepository.findOne({
        where: {
          email: dto.email,
        },
        order: {
          createdAt: 'DESC',
        },
      });

    if (!existingEmail) {
      throw new NotFoundException(
        'Email verification record not found',
      );
    }

    // 4. Generate new verification code
    const verificationCode =
      this.generateVerificationCode();

    // 5. Update latest verification record
    existingEmail.verificationCode =
      verificationCode;

    existingEmail.expiredAt =
      new Date(
        Date.now() + 10 * 60 * 1000,
      );

    existingEmail.isUsed = false;

    // 6. Save updated verification record
    await this.emailVerificationRepository.save(
      existingEmail,
    );

    // 7. Send new verification code
    await this.emailService.sendEmailVerification(dto.email,user.firstName);

    return {
      success: true,
      message:
        'A new verification code has been sent to your email',
    };

  } catch (error) {
    throw error;
  }
}



}