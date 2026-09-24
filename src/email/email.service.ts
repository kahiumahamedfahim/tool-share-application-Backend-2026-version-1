import { Injectable } from '@nestjs/common'
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService 
{
    constructor(private readonly mailerService : MailerService,)
    {

    }


    async sendTestEmail(email : string ) : Promise<void>
    {
        await this.mailerService.sendMail(
            {
                to: email,
                subject: 'toolShare Email serivce Test',
                 html: `
        <div>
          <h2>ToolShare Email Service</h2>

          <p>Hello,</p>

          <p>
            This is a test email from the ToolShare backend.
          </p>

          <p>
            If you received this email, your email service
            is working correctly.
          </p>

          <p>
            Regards,<br />
            ToolShare Team
          </p>
        </div>
      `,

            }
        );
    }
    async sendEmailVerification(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,

      subject: 'ToolShare - Email Verification',

      html: `
        <div>
          <h2>Verify Your Email</h2>

          <p>
            Thank you for registering with ToolShare.
          </p>

          <p>
            Your email verification code is:
          </p>

          <h1>${verificationCode}</h1>

          <p>
            This code will expire in 10 minutes.
          </p>

          <p>
            If you did not create this account,
            please ignore this email.
          </p>
        </div>
      `,
    });
  }
}