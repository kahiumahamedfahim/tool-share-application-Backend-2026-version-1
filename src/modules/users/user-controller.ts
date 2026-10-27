import {
  Body,
  Controller,
  Post,
  Get,
  UploadedFiles,
  UseInterceptors,
  Param
} from '@nestjs/common';

import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Patch } from '@nestjs/common';

import { UserService } from './user-service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationCodeDto } from './dto/resend-verification-code.dto';
import { ApproveUserDocumentDto } from './dto/approve-user-document.dto';
import { BadRequestException } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/roles.guard';
import { UserRole } from './enums/user-role-enum';
import { Roles } from 'src/auth/roles.decorator';
import { request } from 'http';
import { Req } from '@nestjs/common';
import type  {AuthenticatedRequest} from 'src/auth/authenticated-request'
import { Query } from '@nestjs/common';
import { PaginationDto } from '../pagination/pagination-dto';
import { RejectUserDocumentDto } from './dto/reject-user-document.dto';
import { CreateRiderDto } from '../users/dto/create-rider-dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/forgot-password.dto';
import { ValidationPipe } from '@nestjs/common';
import { UsePipes } from '@nestjs/common';
import { ToggleUserStatusDto } from './dto/toggle-user-status.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateMyPasswordDto } from './dto/update-my-password.dto';

@Controller('users')
export class UserController{
  constructor(
    private readonly userService: UserService,
  ) {}

  @Post('admin/register')
   @UsePipes(new ValidationPipe())
  @UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@UseInterceptors(
  FileFieldsInterceptor(
    [
      {
        name: 'profileImage',
        maxCount: 1,
      },
      {
        name: 'nidFrontImage',
        maxCount: 1,
      },
      {
        name: 'nidBackImage',
        maxCount: 1,
      },
    ],
    {
      storage: diskStorage({
        destination: (req, file, callback) => {
          let folder = './uploads';

          if (file.fieldname === 'profileImage') {
            folder = './uploads/profile';
          } else if (file.fieldname === 'nidFrontImage') {
            folder = './uploads/nid-front';
          } else if (file.fieldname === 'nidBackImage') {
            folder = './uploads/nid-back';
          }

          callback(null, folder);
        },

        filename: (req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${file.originalname}`;

          callback(null, uniqueName);
        },
      }),
    },
  ),
)
  async registerAdmin(
    @Body() dto: CreateAdminDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      nidFrontImage?: Express.Multer.File[];
      nidBackImage?: Express.Multer.File[];
    },
    
  ) {
    if (
  !files.profileImage?.length ||
  !files.nidFrontImage?.length ||
  !files.nidBackImage?.length
) {
  throw new BadRequestException(
    'Profile image, NID front image and NID back image are required',
  );
}
    return await this.userService.createAdmin(
      dto,
      files,
    );
  }


  @Post('verify-email')
   @UsePipes(new ValidationPipe())
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ) {
    return await this.userService.verifyEmail(dto);
  }

  @Post('resend-verification-code')
  async resendVerificationCode(
    @Body() dto: ResendVerificationCodeDto,
  ) {
    return await this.userService.resendVerificationCode(dto);
  }

  @Post('forgot-password')
  @UsePipes(new ValidationPipe())
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ) {
    return await this.userService.forgotPassword(dto);
  }

  @Post('reset-password')
  @UsePipes(new ValidationPipe())
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    return await this.userService.resetPassword(dto);
  }

   @Get('documents')
   @UseGuards(JwtAuthGuard,RolesGuard)
   @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getAllDocuments() {
    return await this.userService.getPendingDocuments();
  }

  @Get('riders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getRiders() {
    return await this.userService.getRiders();
  }

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN,UserRole.MODERATOR)
  @Get(':userId/document')
   @UsePipes(new ValidationPipe())
  async getUserDocumentById(
    @Param('userId') userId: string,
  ) {
    return await this.userService.getUserDocumentById(userId);
  }
@Post('document/approve')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
async approveUserDocument(
  @Body() dto: ApproveUserDocumentDto,
  @Req() request: AuthenticatedRequest,
) {
  return await this.userService.approveUserDocument(
    dto,
    request.user.userId,
  );
}
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('Admin-Pending-documents')
 @UsePipes(new ValidationPipe())
  async allAdminPendingDocuments( @Query() paginationDto: PaginationDto,)
  {
      return await this.userService.allAdminPendingDocuments(paginationDto);
  }
@Post('document/reject')
 @UsePipes(new ValidationPipe())
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
async rejectUserDocument(
  @Body() dto: RejectUserDocumentDto,
  @Req() request: AuthenticatedRequest,
) {
  return await this.userService.rejectUserDocument(
    dto,
    request.user.userId,
  );
}
 @Post('moderator/register')
  @UsePipes(new ValidationPipe())
  @UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@UseInterceptors(
  FileFieldsInterceptor(
    [
      {
        name: 'profileImage',
        maxCount: 1,
      },
      {
        name: 'nidFrontImage',
        maxCount: 1,
      },
      {
        name: 'nidBackImage',
        maxCount: 1,
      },
    ],
    {
      storage: diskStorage({
        destination: (req, file, callback) => {
          let folder = './uploads';

          if (file.fieldname === 'profileImage') {
            folder = './uploads/profile';
          } else if (file.fieldname === 'nidFrontImage') {
            folder = './uploads/nid-front';
          } else if (file.fieldname === 'nidBackImage') {
            folder = './uploads/nid-back';
          }

          callback(null, folder);
        },

        filename: (req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${file.originalname}`;

          callback(null, uniqueName);
        },
      }),
    },
  ),
)
  async registerModerator(
    @Body() dto: CreateAdminDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      nidFrontImage?: Express.Multer.File[];
      nidBackImage?: Express.Multer.File[];
    },
    
  ) {
    if (
  !files.profileImage?.length ||
  !files.nidFrontImage?.length ||
  !files.nidBackImage?.length
) {
  throw new BadRequestException(
    'Profile image, NID front image and NID back image are required',
  );
}
    return await this.userService.createModerator(
      dto,
      files,
    );
  }

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Get('moderator-Pending-documents')
 @UsePipes(new ValidationPipe())
  async allModeratorPendingDocuments( @Query() paginationDto: PaginationDto,)
  {
      return await this.userService.allModeratorPendingDocuments(paginationDto);
  }


  @Post('rider/register')
   @UsePipes(new ValidationPipe())
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@UseInterceptors(
  FileFieldsInterceptor(
    [
      {
        name: 'profileImage',
        maxCount: 1,
      },
      {
        name: 'nidFrontImage',
        maxCount: 1,
      },
      {
        name: 'nidBackImage',
        maxCount: 1,
      },
      {
        name: 'drivingLicenseFrontImage',
        maxCount: 1,
      },
      {
        name: 'drivingLicenseBackImage',
        maxCount: 1,
      },
      {
        name: 'vehicleImage',
        maxCount: 1,
      },
    ],
    {
      storage: diskStorage({
        destination: (req, file, callback) => {
          let folder = './uploads';

          if (file.fieldname === 'profileImage') {
            folder = './uploads/profile';
          }
          else if (file.fieldname === 'nidFrontImage') {
            folder = './uploads/nid-front';
          }
          else if (file.fieldname === 'nidBackImage') {
            folder = './uploads/nid-back';
          }
          else if (
            file.fieldname === 'drivingLicenseFrontImage'
          ) {
            folder =
              './uploads/driving-license-front';
          }
          else if (
            file.fieldname === 'drivingLicenseBackImage'
          ) {
            folder =
              './uploads/driving-license-back';
          }
          else if (file.fieldname === 'vehicleImage') {
            folder = './uploads/vehicle';
          }

          callback(null, folder);
        },

        filename: (req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${file.originalname}`;

          callback(null, uniqueName);
        },
      }),
    },
  ),
)
async registerRider(
  @Body() dto: CreateRiderDto,

  @UploadedFiles()
  files:
  {
    profileImage?: Express.Multer.File[];
    nidFrontImage?: Express.Multer.File[];
    nidBackImage?: Express.Multer.File[];
    drivingLicenseFrontImage?: Express.Multer.File[];
    drivingLicenseBackImage?: Express.Multer.File[];
    vehicleImage?: Express.Multer.File[];
  },
)
{
  if (
    !files.profileImage?.length ||
    !files.nidFrontImage?.length ||
    !files.nidBackImage?.length ||
    !files.drivingLicenseFrontImage?.length ||
    !files.drivingLicenseBackImage?.length ||
    !files.vehicleImage?.length
  )
  {
    throw new BadRequestException(
      'Profile image, NID front image, NID back image, driving license front image, driving license back image and vehicle image are required',
    );
  }

  return await this.userService.createRider(
    dto,
    files,
  );
}

@Get('rider-pending-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
async allRiderPendingDocuments(
    @Query() paginationDto: PaginationDto,
)
{
    return await this.userService.allRiderPendingDocuments(
        paginationDto,
    );
}

  @Post('register')
   @UsePipes(new ValidationPipe())
 
@UseInterceptors(
  FileFieldsInterceptor(
    [
      {
        name: 'profileImage',
        maxCount: 1,
      },
      {
        name: 'nidFrontImage',
        maxCount: 1,
      },
      {
        name: 'nidBackImage',
        maxCount: 1,
      },
    ],
    {
      storage: diskStorage({
        destination: (req, file, callback) => {
          let folder = './uploads';

          if (file.fieldname === 'profileImage') {
            folder = './uploads/profile';
          } else if (file.fieldname === 'nidFrontImage') {
            folder = './uploads/nid-front';
          } else if (file.fieldname === 'nidBackImage') {
            folder = './uploads/nid-back';
          }

          callback(null, folder);
        },

        filename: (req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${file.originalname}`;

          callback(null, uniqueName);
        },
      }),
    },
  ),
)
  async register(
    @Body() dto: CreateAdminDto,
    @UploadedFiles()
    files: {
      profileImage?: Express.Multer.File[];
      nidFrontImage?: Express.Multer.File[];
      nidBackImage?: Express.Multer.File[];
    },
    
  ) {
    if (
  !files.profileImage?.length ||
  !files.nidFrontImage?.length ||
  !files.nidBackImage?.length
) {
  throw new BadRequestException(
    'Profile image, NID front image and NID back image are required',
  );
}
    return await this.userService.createUserRegistration(
      dto,
      files,
    );
  }

@Get('user-pending-documents')
 @UsePipes(new ValidationPipe())
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
async allUserPendingDocuments(
    @Query() paginationDto: PaginationDto,
)
{
    return await this.userService.allUsersPendingDocuments(
        paginationDto,
    );
}

@Get('all')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
async getAllUsers(
    @Query() paginationDto: PaginationDto,
) {
    return await this.userService.getAllUsers(paginationDto);
}

@Patch(':userId/status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@UsePipes(new ValidationPipe())
async toggleUserStatus(
    @Param('userId') userId: string,
    @Body() dto: ToggleUserStatusDto,
    @Req() request: AuthenticatedRequest,
) {
    return await this.userService.toggleUserStatus(
        userId,
        request.user.userId,
        request.user.role,
        dto.status,
    );
}

@Get('rental-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
async getAllRentalLogs(
    @Query() paginationDto: PaginationDto,
) {
    return await this.userService.getAllRentalLogs(paginationDto);
}

@Get('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.RIDER, UserRole.MODERATOR, UserRole.ADMIN)
async getMyProfile(
    @Req() req: AuthenticatedRequest,
) {
    return await this.userService.getMyProfile(req.user.userId);
}

@Patch('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.RIDER, UserRole.MODERATOR, UserRole.ADMIN)
@UsePipes(new ValidationPipe())
async updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateMyProfileDto,
) {
    return await this.userService.updateMyProfile(
        req.user.userId,
        dto,
    );
}

@Patch('me/password')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.RIDER, UserRole.MODERATOR, UserRole.ADMIN)
@UsePipes(new ValidationPipe())
async updateMyPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateMyPasswordDto,
) {
    return await this.userService.updateMyPassword(
        req.user.userId,
        dto,
    );
}

@Get('me/document')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.RIDER, UserRole.MODERATOR, UserRole.ADMIN)
async getMyDocument(
    @Req() req: AuthenticatedRequest,
) {
    return await this.userService.getUserDocumentById(req.user.userId);
}

@Post('me/document')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.RIDER, UserRole.MODERATOR, UserRole.ADMIN)
@UseInterceptors(
    FileFieldsInterceptor(
        [
            {
                name: 'profileImage',
                maxCount: 1,
            },
            {
                name: 'nidFrontImage',
                maxCount: 1,
            },
            {
                name: 'nidBackImage',
                maxCount: 1,
            },
        ],
        {
            storage: diskStorage({
                destination: (req, file, callback) => {
                    let folder = './uploads';
                    if (file.fieldname === 'profileImage') {
                        folder = './uploads/profile';
                    } else if (file.fieldname === 'nidFrontImage') {
                        folder = './uploads/nid-front';
                    } else if (file.fieldname === 'nidBackImage') {
                        folder = './uploads/nid-back';
                    }
                    callback(null, folder);
                },
                filename: (req, file, callback) => {
                    const uniqueName = `${Date.now()}-${file.originalname}`;
                    callback(null, uniqueName);
                },
            }),
        },
    ),
)
async uploadMyDocument(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles()
    files: {
        profileImage?: Express.Multer.File[];
        nidFrontImage?: Express.Multer.File[];
        nidBackImage?: Express.Multer.File[];
    },
) {
    return await this.userService.uploadMyDocument(
        req.user.userId,
        files,
    );
}

}