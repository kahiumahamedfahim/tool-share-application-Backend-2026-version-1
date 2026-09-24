import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { EmailService } from './email.service';
import { MailController } from './mail.controller';

@Module({
  imports: [
    ConfigModule,

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAIL_HOST'),
          port: Number(
            configService.get<string>('MAIL_PORT'),
          ),
          secure:
            configService.get<string>('MAIL_SECURE') === 'true',

          auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_PASSWORD'),
          },
        },

        defaults: {
          from: `"Tool Sharing Platform" <${configService.get<string>(
            'MAIL_FROM',
          )}>`,
        },
      }),
    }),
  ],
  controllers:[MailController],
  providers: [EmailService],

  exports: [EmailService],
})
export class EmailModule {}