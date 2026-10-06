import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import {UserModule} from './modules/users/user.module';
import { EmailModule } from './email/email.module';
import { AuthModule } from './auth/auth-module';
import { PusherModule } from './pusher/pusher.module';
import { CategoryModule } from './modules/Category/category.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EmailModule,
    AuthModule,
    UserModule,
    PusherModule,
    CategoryModule,
    

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: process.env.DB_PASSWORD,
      database: 'Tool-Share-Application-Version-1',
      autoLoadEntities: true,
      synchronize: true,
    }),
    
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}