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
  async sendEmailVerifiedConfirmation(
  email: string,
  firstName: string,
): Promise<void> {
  await this.mailerService.sendMail({
    to: email,
    subject: 'ToolShare - Email Verified Successfully',
    html: `
      <div>
        <h2>Email Verified Successfully</h2>

        <p>Hello ${firstName},</p>

        <p>
          Your ToolShare email address has been
          successfully verified.
        </p>

        <p>
          Your account is now waiting for
          document verification.
        </p>

        <p>
          Regards,<br />
          ToolShare Team
        </p>
      </div>
    `,
  });
}

  async documentVerifiedConfirmation(
  email: string,
  firstName: string,
): Promise<void> {
  await this.mailerService.sendMail({
    to: email,
    subject: 'ToolShare - Document  Verified Successfully',
    html: `
      <div>
        <h2>Document Submitted Verified Successfully</h2>

        <p>Hello ${firstName},</p>

        <p>
          Your ToolShare Document  has been
          successfully verified.
        </p>

        <p>
          Your can log in now and start your journy with us 
        </p>

        <p>
          Regards,<br />
          ToolShare Team
        </p>
      </div>
    `,
  });
}

 
async documentRejection(
  email: string,
  firstName: string,
  rejectionReason: string,
): Promise<void> {
  await this.mailerService.sendMail({
    to: email,
    subject: 'ToolShare - Document Verification Failed',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        
        <h2 style="color: #d32f2f;">
          Document Verification Failed
        </h2>

        <p>Hello ${firstName},</p>

        <p>
          We are sorry to inform you that your submitted documents
          could not be verified by the ToolShare verification team.
        </p>

        <p>
          <strong>Reason for rejection:</strong>
        </p>

        <p style="padding: 12px; background-color: #f5f5f5; border-left: 4px solid #d32f2f;">
          ${rejectionReason}
        </p>

        <p>
          Please review the reason above and submit the required
          documents again with the necessary corrections.
        </p>

        <p>
          If you believe this decision was made in error or need
          further assistance, please contact the ToolShare support team.
        </p>

        <p>
          Regards,<br />
          <strong>ToolShare Team</strong>
        </p>

      </div>
    `,
  });
}


}