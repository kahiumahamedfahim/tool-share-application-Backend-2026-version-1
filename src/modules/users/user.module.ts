import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entity/user-entity';
import { UserDocument } from './entity/user-document.entity';
import { EmailVerification } from './entity/email-verification.entity';

import { UserController } from './user-controller';
import { UserService } from './user-service';

import { EmailModule } from 'src/email/email.module';
import { AuthModule } from 'src/auth/auth-module';
import { PusherModule } from 'src/pusher/pusher.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserDocument,
      EmailVerification,
    ]),

    EmailModule,
    AuthModule,
    PusherModule
  ],

  controllers: [
    UserController,
  ],

  providers: [
    UserService,
  ],
})
export class UserModule {}