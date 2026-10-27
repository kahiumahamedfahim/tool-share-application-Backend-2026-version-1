import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, Repository, MoreThan, In } from "typeorm";
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
import { error } from "console";
import { PaginationDto } from "../pagination/pagination-dto";
import { InternalServerErrorException } from "@nestjs/common";
import { RejectUserDocumentDto } from "./dto/reject-user-document.dto";
import { CreateRiderDto } from "./dto/create-rider-dto";
import { UpdateMyProfileDto } from "./dto/update-my-profile.dto";
import { UpdateMyPasswordDto } from "./dto/update-my-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/forgot-password.dto";
import { PusherService } from 'src/pusher/pusher.service';
import { PUSHER_CHANNELS, PUSHER_EVENTS } from "src/pusher/pusher.constants";
import { PusherNotificationData,PusherNotificationType } from "src/pusher/pusher.types";
import { ActualRental, ActualRentalStatus } from "src/modules/rental/entity/actual-rental.entity";
import { RentalRequest } from "src/modules/rental/entity/rental-request.entity";
@Injectable()
export class UserService 
{
    private readonly userDocumentRepsitory : Repository<UserDocument>
    private readonly userRepository: Repository<User>
    private readonly emailVerificationRepository : Repository<EmailVerification>
        constructor(private readonly dataSource : DataSource,
        private readonly emailService : EmailService,
        private readonly pusherService : PusherService

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
            status:UserStatus.PENDING,

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
    const expiredAt= new Date(Date.now() +2 *60 *1000);
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
    manager: EntityManager,
    data: CreateUserData,
    nidNumber: string
): Promise<any>
{
    const existingEmail =
        await manager.findOne(
            User,
            {
                where:
                {
                    email: data.email,
                }
            }
        );

    if(existingEmail)
    {
        if(existingEmail.emailVerificationStatus == true)
        {
            const exisiingUseerDocument =
                await manager.findOne(
                    UserDocument,
                    {
                        where:
                        {
                            userId: existingEmail.userId,
                        }
                    }
                );

            if(!exisiingUseerDocument)
            {
                throw new NotFoundException(
                    'User document not found for existing email'
                );
            }
            else
            {
                if(
                    exisiingUseerDocument.verificationStatus ==
                    DocumentVerificationStatus.PENDING
                )
                {
                    throw new ConflictException(
                        'Email is already registered and document verification is pending'
                    );
                }
                else if(
                    exisiingUseerDocument.verificationStatus ==
                    DocumentVerificationStatus.APPROVED
                )
                {
                    throw new ConflictException(
                        'Email is already registered and document is already approved'
                    );
                }
                else
                {
                    return existingEmail;
                }
            }
        }

        return existingEmail;
    }

    const existingUserByPhone =
        await manager.findOne(
            User,
            {
                where:
                {
                    phone: data.phone,
                }
            }
        );

    if(existingUserByPhone)
    {
        throw new ConflictException(
            'phone number is already registered',
        );
    }

    const existingUserByDocumentNid =
        await manager.findOne(
            UserDocument,
            {
                where:
                {
                    nidNumber
                }
            }
        );

    if(existingUserByDocumentNid)
    {
        throw new ConflictException(
            'Nid number is already registered!'
        );
    }

    return null;
}

async createAdmin(
    dto: CreateAdminDto,
    files:
    {
        profileImage?: Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?: Express.Multer.File[];
    },
): Promise<any>
{
    const querryRunner =
        this.dataSource.createQueryRunner();

    await querryRunner.connect();

    await querryRunner.startTransaction();

    try
    {
        const manager =
            querryRunner.manager;

        const userData: CreateUserData =
        {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            password: dto.password,
        };

        const existingUser =
            await this.validateUserRegistration(
                manager,
                userData,
                dto.nidNumber,
            );

        let user: User;

        if(existingUser)
        {
            existingUser.firstName =
                userData.firstName;

            existingUser.lastName =
                userData.lastName;

            existingUser.phone =
                userData.phone;

            existingUser.password =
                await this.hasedPassword(
                    userData.password
                );

            existingUser.role =
                UserRole.ADMIN;

            existingUser.emailVerificationStatus =
                false;

            user =
                await manager.save(
                    User,
                    existingUser
                );
        }
        else
        {
            user =
                await this.createUser(
                    manager,
                    userData,
                    UserRole.ADMIN
                );
        }

        const documentData:
            CreateUserDocumentData =
        {
            nidNumber:
                dto.nidNumber,
        };

        let userDocument: UserDocument;

        if(existingUser)
        {
            const existingUserDocument =
                await manager.findOne(
                    UserDocument,
                    {
                        where:
                        {
                            userId:
                                user.userId,
                        }
                    }
                );

            if(!existingUserDocument)
            {
                throw new NotFoundException(
                    'User document not found'
                );
            }

            existingUserDocument.nidNumber =
                dto.nidNumber;

            if(files.profileImage?.[0])
            {
                existingUserDocument.profileImage =
                    files.profileImage[0].filename;
            }

            if(files.nidFrontImage?.[0])
            {
                existingUserDocument.nidFrontImage =
                    files.nidFrontImage[0].filename;
            }

            if(files.nidBackImage?.[0])
            {
                existingUserDocument.nidBackImage =
                    files.nidBackImage[0].filename;
            }

            existingUserDocument.verificationStatus =
                DocumentVerificationStatus.PENDING;

            existingUserDocument.rejectionReason =
                null;

            existingUserDocument.documentVerifiedBy =
                null;

            existingUserDocument.documentVerifiedAt =
                null;

            userDocument =
                await manager.save(
                    UserDocument,
                    existingUserDocument
                );
        }
        else
        {
            userDocument =
                await this.createUserDocument(
                    manager,
                    user.userId,
                    documentData,
                    files
                );
        }

        const emailVerification =
            await this.createEmailVerification(
                manager,
                user.userId,
                user.email
            );

        await querryRunner.commitTransaction();

        await this.emailService.sendEmailVerification(
            user.email,
            emailVerification.verificationCode
        );

        return {
            message:
                'Admin registered successfully. Please verify your email.',
            userId:
                user.userId,
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
async getRiders() : Promise<User[]>
{
    return await this.userRepository.find(
        {
            where :
            {
                role: UserRole.RIDER,
            },
            select :
            {
                userId: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                role: true,
                emailVerificationStatus: true,
            },
            order :
            {
                firstName: 'ASC',
            },
        },
    );
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
      role : user.role,
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
async rejectUserDocument(
  dto: RejectUserDocumentDto,
  verifiedBy: string,
): Promise<{
  message: string;
  userId: string;
}> {
  const queryRunner = this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  let user: User;

  try {
    const manager = queryRunner.manager;

    // ---------------------------------------------
    // Find User Document
    // ---------------------------------------------

    const userDocument = await manager.findOne(UserDocument, {
      where: {
        userId: dto.userId,
      },
    });

    if (!userDocument) {
      throw new NotFoundException(
        'User document not found',
      );
    }

    // ---------------------------------------------
    // Check Document Status
    // ---------------------------------------------

    if (
      userDocument.verificationStatus !==
      DocumentVerificationStatus.PENDING
    ) {
      throw new ConflictException(
        'User document has already been processed',
      );
    }

    // ---------------------------------------------
    // Update Rejection Information
    // ---------------------------------------------

    userDocument.verificationStatus =
      DocumentVerificationStatus.REJECTED;

    userDocument.rejectionReason =
      dto.rejectionReason;

    userDocument.documentVerifiedBy =
      verifiedBy;

    userDocument.documentVerifiedAt =
      new Date();

    await manager.save(
      UserDocument,
      userDocument,
    );

    // ---------------------------------------------
    // Find User
    // ---------------------------------------------

    const foundUser = await manager.findOne(User, {
      where: {
        userId: dto.userId,
      },
    });

    if (!foundUser) {
      throw new NotFoundException(
        'User not found for rejected document',
      );
    }

    user = foundUser;

    // ---------------------------------------------
    // Commit Transaction
    // ---------------------------------------------

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }

  // ---------------------------------------------
  // Send Rejection Email
  // ---------------------------------------------

  await this.emailService.documentRejection(
    user.email,
    user.firstName,
    dto.rejectionReason,
  );

  // ---------------------------------------------
  // Response
  // ---------------------------------------------

  return {
    message: 'Document rejected successfully!',
    userId: user.userId,
  };
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

async allAdminPendingDocuments(
  paginationDto: PaginationDto,
): Promise<{
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  try {
    const { page, limit } = paginationDto;

    const skip = (page - 1) * limit;

    const [usersWithPendingDocuments, total] =
      await this.userRepository.findAndCount({
        where: {
          emailVerificationStatus: true,
          role: UserRole.ADMIN,
          userDocument: {
            verificationStatus: DocumentVerificationStatus.PENDING,
          },
        },
        relations: {
          userDocument: true,
        },
        order: {
          createdAt: 'DESC',
        },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(total / limit);

    return {
      data: usersWithPendingDocuments,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    console.error(
      'Error fetching pending documents:',
      error,
    );

    throw new InternalServerErrorException(
      'Failed to fetch pending documents',
    );
  }
}

async createModerator(
    dto: CreateAdminDto,
    files:
    {
        profileImage?: Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?: Express.Multer.File[];
    },
): Promise<any>
{
    const querryRunner =
        this.dataSource.createQueryRunner();

    await querryRunner.connect();

    await querryRunner.startTransaction();

    try
    {
        const manager =
            querryRunner.manager;

        const userData: CreateUserData =
        {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            password: dto.password,
        };

        const existingUser =
            await this.validateUserRegistration(
                manager,
                userData,
                dto.nidNumber,
            );

        let user: User;

        if(existingUser)
        {
            existingUser.firstName =
                userData.firstName;

            existingUser.lastName =
                userData.lastName;

            existingUser.phone =
                userData.phone;

            existingUser.password =
                await this.hasedPassword(
                    userData.password
                );

            existingUser.role =
                UserRole.MODERATOR;

            existingUser.emailVerificationStatus =
                false;

            user =
                await manager.save(
                    User,
                    existingUser
                );
        }
        else
        {
            user =
                await this.createUser(
                    manager,
                    userData,
                    UserRole.MODERATOR
                );
        }

        const documentData:
            CreateUserDocumentData =
        {
            nidNumber: dto.nidNumber,
        };

        let userDocument: UserDocument;

        if(existingUser)
        {
            const existingUserDocument =
                await manager.findOne(
                    UserDocument,
                    {
                        where:
                        {
                            userId:
                                user.userId,
                        }
                    }
                );

            if(!existingUserDocument)
            {
                throw new NotFoundException(
                    'User document not found'
                );
            }

            existingUserDocument.nidNumber =
                dto.nidNumber;

            if(files.profileImage?.[0])
            {
                existingUserDocument.profileImage =
                    files.profileImage[0].filename;
            }

            if(files.nidFrontImage?.[0])
            {
                existingUserDocument.nidFrontImage =
                    files.nidFrontImage[0].filename;
            }

            if(files.nidBackImage?.[0])
            {
                existingUserDocument.nidBackImage =
                    files.nidBackImage[0].filename;
            }

            existingUserDocument.verificationStatus =
                DocumentVerificationStatus.PENDING;

            existingUserDocument.rejectionReason =
                null;

            existingUserDocument.documentVerifiedBy =
                null;

            existingUserDocument.documentVerifiedAt =
                null;

            userDocument =
                await manager.save(
                    UserDocument,
                    existingUserDocument
                );
        }
        else
        {
            userDocument =
                await this.createUserDocument(
                    manager,
                    user.userId,
                    documentData,
                    files
                );
        }

        const emailVerification =
            await this.createEmailVerification(
                manager,
                user.userId,
                user.email
            );

        await querryRunner.commitTransaction();

        await this.emailService.sendEmailVerification(
            user.email,
            emailVerification.verificationCode
        );

        return {
            message:
                'Moderator registered successfully. Please verify your email.',
            userId:
                user.userId,
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
async allModeratorPendingDocuments(
    paginationDto: PaginationDto,
): Promise<{
    data: User[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>
{
    try
    {
        const { page, limit } = paginationDto;

        const skip = (page - 1) * limit;

        const [usersWithPendingDocuments, total] =
            await this.userRepository.findAndCount({
                where:
                {
                    emailVerificationStatus: true,

                    role: UserRole.MODERATOR,

                    userDocument:
                    {
                        verificationStatus:
                            DocumentVerificationStatus.PENDING,
                    },
                },

                relations:
                {
                    userDocument: true,
                },

                order:
                {
                    createdAt: 'DESC',
                },

                skip,

                take: limit,
            });

        const totalPages = Math.ceil(
            total / limit
        );

        return {
            data: usersWithPendingDocuments,

            meta:
            {
                page,

                limit,

                total,

                totalPages,
            },
        };
    }
    catch(error)
    {
        console.error(
            'Error fetching moderator pending documents:',
            error,
        );

        throw new InternalServerErrorException(
            'Failed to fetch moderator pending documents',
        );
    }
}
private async validateRiderRegistration(
    manager: EntityManager,
    drivingLicenseNumber: string,
    vehicleNumber: string,
    existingUserId?: string,
): Promise<any>
{
    const existingUserByDrivingLicense =
        await manager.findOne(
            UserDocument,
            {
                where:
                {
                    drivingLicenseNumber,
                }
            }
        );

    if(
        existingUserByDrivingLicense &&
        existingUserByDrivingLicense.userId !== existingUserId
    )
    {
        throw new ConflictException(
            'Driving license number is already registered!'
        );
    }

    const existingVehicle =
        await manager.findOne(
            UserDocument,
            {
                where:
                {
                    vehicleNumber,
                }
            }
        );

    if(
        existingVehicle &&
        existingVehicle.userId !== existingUserId
    )
    {
        throw new ConflictException(
            'Vehicle number is already registered!'
        );
    }
}
private async createRiderDocument(
    manager: EntityManager,
    userId: string,
    data: CreateUserDocumentData,
    files:
    {
        profileImage?: Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?: Express.Multer.File[];
        drivingLicenseFrontImage?: Express.Multer.File[];
        drivingLicenseBackImage?: Express.Multer.File[];
        vehicleImage?: Express.Multer.File[];
    },
): Promise<UserDocument>
{
    const userDocument =
        manager.create(
            UserDocument,
            {
                userId,

                nidNumber:
                    data.nidNumber,

                drivingLicenseNumber:
                    data.drivingLicenseNumber,

                vehicleType:
                    data.vehicleType,

                vehicleNumber:
                    data.vehicleNumber,

                profileImage:
                    files.profileImage?.[0]?.filename,

                nidFrontImage:
                    files.nidFrontImage?.[0]?.filename,

                nidBackImage:
                    files.nidBackImage?.[0]?.filename,

                drivingLicenseFrontImage:
                    files.drivingLicenseFrontImage?.[0]?.filename,

                drivingLicenseBackImage:
                    files.drivingLicenseBackImage?.[0]?.filename,

                vehicleImage:
                    files.vehicleImage?.[0]?.filename,

                verificationStatus:
                    DocumentVerificationStatus.PENDING,
            },
        );

    return await manager.save(
        UserDocument,
        userDocument,
    );
}
async createRider(
    dto: CreateRiderDto,
    files:
    {
        profileImage?: Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?: Express.Multer.File[];
        drivingLicenseFrontImage?: Express.Multer.File[];
        drivingLicenseBackImage?: Express.Multer.File[];
        vehicleImage?: Express.Multer.File[];
    },
): Promise<any>
{
    const querryRunner =
        this.dataSource.createQueryRunner();

    await querryRunner.connect();

    await querryRunner.startTransaction();

    try
    {
        const manager =
            querryRunner.manager;

        const userData: CreateUserData =
        {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            password: dto.password,
        };

        const existingUser =
            await this.validateUserRegistration(
                manager,
                userData,
                dto.nidNumber,
            );

        await this.validateRiderRegistration(
            manager,
            dto.drivingLicenseNumber,
            dto.vehicleNumber,
            existingUser?.userId,
        );

        let user: User;

        if(existingUser)
        {
            existingUser.firstName =
                userData.firstName;

            existingUser.lastName =
                userData.lastName;

            existingUser.phone =
                userData.phone;

            existingUser.password =
                await this.hasedPassword(
                    userData.password
                );

            existingUser.role =
                UserRole.RIDER;

            existingUser.emailVerificationStatus =
                false;

            user =
                await manager.save(
                    User,
                    existingUser
                );
        }
        else
        {
            user =
                await this.createUser(
                    manager,
                    userData,
                    UserRole.RIDER
                );
        }

        const documentData:
            CreateUserDocumentData =
        {
            nidNumber:
                dto.nidNumber,

            drivingLicenseNumber:
                dto.drivingLicenseNumber,

            vehicleType:
                dto.vehicleType,

            vehicleNumber:
                dto.vehicleNumber,
        };

        let userDocument: UserDocument;

        if(existingUser)
        {
            const existingUserDocument =
                await manager.findOne(
                    UserDocument,
                    {
                        where:
                        {
                            userId:
                                user.userId,
                        }
                    }
                );

            if(!existingUserDocument)
            {
                throw new NotFoundException(
                    'User document not found'
                );
            }

            existingUserDocument.nidNumber =
                dto.nidNumber;

            existingUserDocument.drivingLicenseNumber =
                dto.drivingLicenseNumber;

            existingUserDocument.vehicleType =
                dto.vehicleType;

            existingUserDocument.vehicleNumber =
                dto.vehicleNumber;

            if(files.profileImage?.[0])
            {
                existingUserDocument.profileImage =
                    files.profileImage[0].filename;
            }

            if(files.nidFrontImage?.[0])
            {
                existingUserDocument.nidFrontImage =
                    files.nidFrontImage[0].filename;
            }

            if(files.nidBackImage?.[0])
            {
                existingUserDocument.nidBackImage =
                    files.nidBackImage[0].filename;
            }

            if(files.drivingLicenseFrontImage?.[0])
            {
                existingUserDocument.drivingLicenseFrontImage =
                    files.drivingLicenseFrontImage[0].filename;
            }

            if(files.drivingLicenseBackImage?.[0])
            {
                existingUserDocument.drivingLicenseBackImage =
                    files.drivingLicenseBackImage[0].filename;
            }

            if(files.vehicleImage?.[0])
            {
                existingUserDocument.vehicleImage =
                    files.vehicleImage[0].filename;
            }

            existingUserDocument.verificationStatus =
                DocumentVerificationStatus.PENDING;

            existingUserDocument.rejectionReason =
                null;

            existingUserDocument.documentVerifiedBy =
                null;

            existingUserDocument.documentVerifiedAt =
                null;

            userDocument =
                await manager.save(
                    UserDocument,
                    existingUserDocument
                );
        }
        else
        {
            userDocument =
                await this.createRiderDocument(
                    manager,
                    user.userId,
                    documentData,
                    files
                );
        }

        const emailVerification =
            await this.createEmailVerification(
                manager,
                user.userId,
                user.email
            );

        await querryRunner.commitTransaction();

        await this.emailService.sendEmailVerification(
            user.email,
            emailVerification.verificationCode
        );

        return {
            message:
                'Rider registered successfully. Please verify your email.',

            userId:
                user.userId,
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
async allRiderPendingDocuments(
    paginationDto: PaginationDto,
): Promise<{
    data: User[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>
{
    try
    {
        const { page, limit } = paginationDto;

        const skip = (page - 1) * limit;

        const [usersWithPendingDocuments, total] =
            await this.userRepository.findAndCount({
                where:
                {
                    emailVerificationStatus: true,

                    role: UserRole.RIDER,

                    userDocument:
                    {
                        verificationStatus:
                            DocumentVerificationStatus.PENDING,
                    },
                },

                relations:
                {
                    userDocument: true,
                },

                order:
                {
                    createdAt: 'DESC',
                },

                skip,

                take: limit,
            });

        const totalPages = Math.ceil(
            total / limit
        );

        return {
            data: usersWithPendingDocuments,

            meta:
            {
                page,

                limit,

                total,

                totalPages,
            },
        };
    }
    catch(error)
    {
        console.error(
            'Error fetching rider pending documents:',
            error,
        );

        throw new InternalServerErrorException(
            'Failed to fetch rider pending documents',
        );
    }
}

async createUserRegistration(
    dto: CreateAdminDto,
    files:
    {
        profileImage?: Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?: Express.Multer.File[];
    },
): Promise<any>
{
    const querryRunner =
        this.dataSource.createQueryRunner();

    await querryRunner.connect();

    await querryRunner.startTransaction();

    try
    {
        const manager =
            querryRunner.manager;

        const userData: CreateUserData =
        {
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            password: dto.password,
        };

        const existingUser =
            await this.validateUserRegistration(
                manager,
                userData,
                dto.nidNumber,
            );

        let user: User;

        if(existingUser)
        {
            existingUser.firstName =
                userData.firstName;

            existingUser.lastName =
                userData.lastName;

            existingUser.phone =
                userData.phone;

            existingUser.password =
                await this.hasedPassword(
                    userData.password
                );

            existingUser.role =
                UserRole.USER;

            existingUser.emailVerificationStatus =
                false;

            user =
                await manager.save(
                    User,
                    existingUser
                );
        }
        else
        {
            user =
                await this.createUser(
                    manager,
                    userData,
                    UserRole.USER
                );
        }

        const documentData:
            CreateUserDocumentData =
        {
            nidNumber: dto.nidNumber,
        };

        let userDocument: UserDocument;

        if(existingUser)
        {
            const existingUserDocument =
                await manager.findOne(
                    UserDocument,
                    {
                        where:
                        {
                            userId:
                                user.userId,
                        }
                    }
                );

            if(!existingUserDocument)
            {
                throw new NotFoundException(
                    'User document not found'
                );
            }

            existingUserDocument.nidNumber =
                dto.nidNumber;

            if(files.profileImage?.[0])
            {
                existingUserDocument.profileImage =
                    files.profileImage[0].filename;
            }

            if(files.nidFrontImage?.[0])
            {
                existingUserDocument.nidFrontImage =
                    files.nidFrontImage[0].filename;
            }

            if(files.nidBackImage?.[0])
            {
                existingUserDocument.nidBackImage =
                    files.nidBackImage[0].filename;
            }

            existingUserDocument.verificationStatus =
                DocumentVerificationStatus.PENDING;

            existingUserDocument.rejectionReason =
                null;

            existingUserDocument.documentVerifiedBy =
                null;

            existingUserDocument.documentVerifiedAt =
                null;

            userDocument =
                await manager.save(
                    UserDocument,
                    existingUserDocument
                );
        }
        else
        {
            userDocument =
                await this.createUserDocument(
                    manager,
                    user.userId,
                    documentData,
                    files
                );
        }

        const emailVerification =
            await this.createEmailVerification(
                manager,
                user.userId,
                user.email
            );

        await querryRunner.commitTransaction();

        await this.emailService.sendEmailVerification(
            user.email,
            emailVerification.verificationCode
        );
       const notificationData: PusherNotificationData =
{
    type:
        PusherNotificationType.DOCUMENT_SUBMITTED,

    title:
        'New Document Submission',

    message:
        `${user.firstName} ${user.lastName} has submitted documents for verification.`,

    userId:
        user.userId,

    userName:
        `${user.firstName} ${user.lastName}`,

    email:
        user.email,

    timestamp:
        new Date(),
};

await this.pusherService.trigger(
    PUSHER_CHANNELS.ADMIN_MODERATOR,
    PUSHER_EVENTS.DOCUMENT_SUBMITTED,
    notificationData,
);
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
async allUsersPendingDocuments(
    paginationDto: PaginationDto,
): Promise<{
    data: User[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}>
{
    try
    {
        const { page, limit } = paginationDto;

        const skip = (page - 1) * limit;

        const [usersWithPendingDocuments, total] =
            await this.userRepository.findAndCount({
                where:
                {
                    emailVerificationStatus: true,

                    role: UserRole.USER,

                    userDocument:
                    {
                        verificationStatus:
                            DocumentVerificationStatus.PENDING,
                    },
                },

                relations:
                {
                    userDocument: true,
                },

                order:
                {
                    createdAt: 'DESC',
                },

                skip,

                take: limit,
            });

        const totalPages = Math.ceil(
            total / limit
        );

        return {
            data: usersWithPendingDocuments,

            meta:
            {
                page,

                limit,

                total,

                totalPages,
            },
        };
    }
    catch(error)
    {
        console.error(
            'Error fetching User pending documents:',
            error,
        );

        throw new InternalServerErrorException(
            'Failed to fetch User pending documents',
        );
    }
}

async getAllUsers(
    paginationDto: PaginationDto,
): Promise<{
    data: any[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}> {
    try {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [users, total] =
            await this.userRepository.findAndCount({
                select: {
                    userId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    role: true,
                    status: true,
                    emailVerificationStatus: true,
                    createdAt: true,
                    updatedAt: true,
                },
                order: {
                    createdAt: "DESC",
                },
                skip,
                take: limit,
            });

        const totalPages = Math.ceil(total / limit);

        return {
            data: users,
            meta: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    } catch (error) {
        console.error(
            "Error fetching all users:",
            error,
        );

        throw new InternalServerErrorException(
            "Failed to fetch all users",
        );
    }
}

async toggleUserStatus(
    userId: string,
    actorId: string,
    actorRole: UserRole,
    status: UserStatus,
): Promise<User> {
    const user =
        await this.userRepository.findOne({
            where: { userId },
        });

    if (!user) {
        throw new NotFoundException("User not found");
    }

    // Cannot deactivate an admin user
    if (
        user.role === UserRole.ADMIN &&
        status === UserStatus.INACTIVE
    ) {
        throw new BadRequestException(
            "Cannot deactivate an admin user",
        );
    }

    // If deactivating, check restrictions
    if (status === UserStatus.INACTIVE) {
        // Only ADMIN can deactivate MODERATOR/RIDER/USER
        // MODERATOR can deactivate RIDER/USER but not MODERATOR/ADMIN
        if (
            actorRole === UserRole.MODERATOR &&
            (user.role === UserRole.ADMIN ||
                user.role === UserRole.MODERATOR)
        ) {
            throw new BadRequestException(
                "Moderator cannot deactivate admin or other moderator users",
            );
        }

        // Check if user has active rentals (cannot deactivate)
        const activeRentals =
            await this.getActiveRentalsForUser(userId);

        if (activeRentals.length > 0) {
            throw new BadRequestException(
                "Cannot deactivate user with active rentals. Please wait until all rentals are completed and 30 days have passed.",
            );
        }

        // Check if user has completed rentals within the last 30 days
        const recentCompletedRentals =
            await this.getRecentCompletedRentalsForUser(userId);

        if (recentCompletedRentals.length > 0) {
            throw new BadRequestException(
                "Cannot deactivate user with rentals completed within the last 30 days",
            );
        }
    }

    user.status = status;
    return await this.userRepository.save(user);
}

async getAllRentalLogs(
    paginationDto: PaginationDto,
): Promise<{
    data: any[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}> {
    try {
        const { page, limit } = paginationDto;
        const skip = (page - 1) * limit;

        const [rentals, total] =
            await this.dataSource
                .getRepository(RentalRequest)
                .createQueryBuilder("request")
                .leftJoinAndSelect(
                    "request.product",
                    "product",
                )
                .leftJoinAndSelect(
                    "request.renter",
                    "renter",
                )
                .leftJoinAndSelect(
                    "request.owner",
                    "owner",
                )
                .orderBy("request.createdAt", "DESC")
                .skip(skip)
                .take(limit)
                .getManyAndCount();

        const totalPages = Math.ceil(total / limit);

        // Fetch actual rentals for all rental request IDs
        const rentalRequestIds = rentals.map((r) => r.rentalRequestId);
        const actualRentals =
            await this.dataSource
                .getRepository(ActualRental)
                .find({
                    where: rentalRequestIds.length > 0
                        ? {
                            rentalRequestId: In(rentalRequestIds),
                        }
                        : {},
                });

        const actualRentalMap = new Map();
        actualRentals.forEach((ar) => {
            actualRentalMap.set(ar.rentalRequestId, {
                rentalId: ar.rentalId,
                status: ar.status,
            });
        });

        return {
            data: rentals.map((r) => {
                const ar = actualRentalMap.get(r.rentalRequestId);
                return {
                    rentalRequestId: r.rentalRequestId,
                    productName: r.product?.name,
                    productId: r.product?.productId,
                    renterName:
                        r.renter?.firstName +
                        " " +
                        r.renter?.lastName,
                    renterId: r.renterId,
                    ownerName:
                        r.owner?.firstName +
                        " " +
                        r.owner?.lastName,
                    ownerId: r.ownerId,
                    startDate: r.startDate,
                    endDate: r.endDate,
                    rentalDays: r.rentalDays,
                    status: r.status,
                    agreedPricePerDay: r.agreedPricePerDay,
                    createdAt: r.createdAt,
                    actualRentalStatus: ar?.status || null,
                    actualRentalId: ar?.rentalId || null,
                };
            }),
            meta: {
                page,
                limit,
                total,
                totalPages,
            },
        };
    } catch (error) {
        console.error(
            "Error fetching rental logs:",
            error,
        );

        throw new InternalServerErrorException(
            "Failed to fetch rental logs",
        );
    }
}

private async getActiveRentalsForUser(
    userId: string,
): Promise<any[]> {
    return await this.dataSource
        .getRepository(ActualRental)
        .find({
            where: [
                { renterId: userId, status: ActualRentalStatus.ACTIVE },
                { renterId: userId, status: ActualRentalStatus.PENDING_HANDOVER },
                { ownerId: userId, status: ActualRentalStatus.ACTIVE },
                { ownerId: userId, status: ActualRentalStatus.PENDING_HANDOVER },
            ],
        });
}

private async getRecentCompletedRentalsForUser(
    userId: string,
): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await this.dataSource
        .getRepository(ActualRental)
        .find({
            where: [
                {
                    renterId: userId,
                    status: ActualRentalStatus.COMPLETED,
                    updatedAt: MoreThan(thirtyDaysAgo),
                },
                {
                    ownerId: userId,
                    status: ActualRentalStatus.COMPLETED,
                    updatedAt: MoreThan(thirtyDaysAgo),
                },
            ],
        });
    }

    async getMyProfile(userId: string): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { userId },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return user;
    }

    async updateMyProfile(
        userId: string,
        dto: UpdateMyProfileDto,
    ): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { userId },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        if (dto.firstName !== undefined) {
            user.firstName = dto.firstName;
        }

        if (dto.lastName !== undefined) {
            user.lastName = dto.lastName;
        }

        if (dto.phone !== undefined) {
            user.phone = dto.phone;
        }

        if (dto.address !== undefined) {
            user.address = dto.address;
        }

        if (dto.latitude !== undefined) {
            user.latitude = dto.latitude;
        }

        if (dto.longitude !== undefined) {
            user.longitude = dto.longitude;
        }

        return await this.userRepository.save(user);
    }

    async updateMyPassword(
        userId: string,
        dto: UpdateMyPasswordDto,
    ): Promise<{ message: string }> {
        const user = await this.userRepository.findOne({
            where: { userId },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        const isPasswordValid = await bcrypt.compare(
            dto.currentPassword,
            user.password,
        );

        if (!isPasswordValid) {
            throw new BadRequestException("Current password is incorrect");
        }

        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException(
                "New password and confirm password do not match",
            );
        }

        user.password = await this.hasedPassword(dto.newPassword);
        return await this.userRepository.save(user).then(() => ({
            message: "Password updated successfully",
        }));
    }

    async uploadMyDocument(
        userId: string,
        files: {
            profileImage?: Express.Multer.File[];
            nidFrontImage?: Express.Multer.File[];
            nidBackImage?: Express.Multer.File[];
        },
    ): Promise<{ message: string }> {
        const userDocument =
            await this.userDocumentRepsitory.findOne({
                where: { userId },
            });

        if (!userDocument) {
            throw new NotFoundException("User document not found");
        }

        if (files.profileImage?.[0]) {
            userDocument.profileImage = files.profileImage[0].filename;
        }

        if (files.nidFrontImage?.[0]) {
            userDocument.nidFrontImage = files.nidFrontImage[0].filename;
        }

        if (files.nidBackImage?.[0]) {
            userDocument.nidBackImage = files.nidBackImage[0].filename;
        }

        await this.userDocumentRepsitory.save(userDocument);

        return { message: "Documents uploaded successfully" };
    }

    async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
        const user = await this.userRepository.findOne({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException("User not found with this email");
        }

        // Generate verification code
        const verificationCode = this.generateVerificationCode();

        // Create email verification record
        const emailVerification = this.emailVerificationRepository.create({
            user: user,
            email: dto.email,
            verificationCode: verificationCode,
            expiredAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            isUsed: false,
        });

        await this.emailVerificationRepository.save(emailVerification);

        // Send email with OTP
        await this.emailService.sendEmailVerification(
            dto.email,
            verificationCode,
        );

        return { message: "Password reset code sent to your email" };
    }

    async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
        const user = await this.userRepository.findOne({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException("User not found");
        }

        // Find the latest verification record
        const emailVerification =
            await this.emailVerificationRepository.findOne({
                where: { email: dto.email },
                order: { createdAt: "DESC" },
            });

        if (!emailVerification) {
            throw new NotFoundException(
                "No verification code found for this email",
            );
        }

        if (emailVerification.isUsed) {
            throw new BadRequestException(
                "Verification code has already been used",
            );
        }

        if (emailVerification.expiredAt < new Date()) {
            throw new BadRequestException(
                "Verification code has expired",
            );
        }

        if (emailVerification.verificationCode !== dto.verificationCode) {
            throw new BadRequestException("Invalid verification code");
        }

        // Mark as used
        emailVerification.isUsed = true;
        await this.emailVerificationRepository.save(emailVerification);

        // Update password
        user.password = await this.hasedPassword(dto.newPassword);
        await this.userRepository.save(user);

        return { message: "Password reset successfully" };
    }
}

