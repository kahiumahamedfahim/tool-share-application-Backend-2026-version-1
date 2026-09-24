import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { UserDocument } from './entities/user-document.entity';
import { RiderProfile } from './entities/rider-profile.entity';
import { RiderDocument } from './entities/rider-document.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
     User,
  UserDocument,
  EmailVerification,
  RiderProfile,
  RiderDocument,
    ]),
  ],
})
export class UserModule {}