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

@Controller('users')
export class UserController{
  constructor(
    private readonly userService: UserService,
  ) {}

  @Post('admin/register')
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

   @Get('documents')
   @UseGuards(JwtAuthGuard,RolesGuard)
   @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getAllDocuments() {
    return await this.userService.getPendingDocuments();
  }


  @Get(':userId/document')
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

  
}