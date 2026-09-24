import { Module } from '@nestjs/common';


import { AuthService } from '../Auth/auth-service';

import { EmailModule } from '../../email/email.module';

@Module({
  imports: [
    EmailModule,
  ],
  controllers: [
    
  ],
  providers: [
    AuthService,
  ],
})
export class AuthModule {}