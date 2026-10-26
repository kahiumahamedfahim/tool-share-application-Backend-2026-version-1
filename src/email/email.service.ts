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

// ======================================================
// MODERATOR RENTAL REVIEW EMAILS
// Sent to BOTH the renter and the owner when the
// moderator approves or rejects a rental request.
// ======================================================

async rentalRequestReviewed(
    email: string,
    firstName: string,
    details: {
        rentalRequestId: string;
        productName: string;
        decision: 'APPROVED' | 'REJECTED';
        startDate: Date;
        endDate: Date;
        agreedPricePerDay: number;
        rentalDays: number;
        rentalAmount: number;
        deliveryFee?: number | null;
        partyRole?: 'OWNER' | 'RENTER';
        partyRentalFee?: number | null;
        partyDeliveryFee?: number | null;
        platformCommissionRate?: number | null;
        riderName?: string | null;
        riderEmail?: string | null;
    },
): Promise<void> {
    const isApproved =
        details.decision === 'APPROVED';

    const riderBlock =
        isApproved && details.riderName
            ? `
          <tr>
            <td style="padding: 6px 0; color: #555;"><strong>Assigned rider</strong></td>
            <td style="padding: 6px 0; color: #333;">${details.riderName}${details.riderEmail ? ` (${details.riderEmail})` : ''}</td>
          </tr>
        `
            : '';

    await this.mailerService.sendMail({
        to: email,
        subject: isApproved
            ? 'ToolShare - Rental Request Approved'
            : 'ToolShare - Rental Request Rejected',
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

          <h2 style="color: ${isApproved ? '#2e7d32' : '#d32f2f'};">
            Rental Request ${details.decision}
          </h2>

          <p>Hello ${firstName},</p>

          <p>
            Your rental request for <strong>${details.productName}</strong>
            has been <strong>${details.decision}</strong> by the ToolShare
            moderator team.
          </p>

          <table style="border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Request ID</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.rentalRequestId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Rental dates</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.startDate.toDateString()} to ${details.endDate.toDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Duration</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.rentalDays} day(s)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Agreed price</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.agreedPricePerDay.toFixed(2)} / day</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Rental amount</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.rentalAmount.toFixed(2)}</td>
            </tr>
            ${
                isApproved && details.partyRole && details.partyRentalFee != null
                    ? `
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Your ${details.partyRole.toLowerCase()} rental charge</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.partyRentalFee.toFixed(2)}</td>
            </tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Your ${details.partyRole.toLowerCase()} delivery charge</strong></td><td style="padding: 6px 0; color: #333;">${(details.partyDeliveryFee ?? 0).toFixed(2)}</td></tr>
              `
                    : ''
            }
            ${
                isApproved &&
                details.platformCommissionRate != null
                    ? `
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Platform commission</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.platformCommissionRate.toFixed(2)}%</td>
            </tr>
              `
                    : ''
            }
            ${riderBlock}
          </table>

          ${
              isApproved
                  ? `<p style="margin-top: 12px;">The assigned rider was verified by the moderator when the product was picked up, and it will be checked again after the rental term ends. Please keep this email for reference.</p>`
                  : `<p style="margin-top: 12px;">If you believe this decision was made in error, please contact the ToolShare support team.</p>`
          }

          <p>
            Regards,<br />
            <strong>ToolShare Team</strong>
          </p>

        </div>
      `,
    });
}

// ======================================================
// MODERATOR RIDER ASSIGNMENT EMAIL
// Sent to the assigned rider when the moderator
// assigns them for product pickup/delivery.
// ======================================================

async riderAssignmentNotification(
    email: string,
    firstName: string,
    details: {
        rentalRequestId: string;
        productName: string;
        pickupAddress: string;
        deliveryAddress: string;
    },
): Promise<void> {
    await this.mailerService.sendMail({
        to: email,
        subject: 'ToolShare - Rider Assignment',
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

          <h2 style="color: #1565c0;">
            You Have Been Assigned a Product Pickup
          </h2>

          <p>Hello ${firstName},</p>

          <p>
            You have been assigned by the ToolShare moderator
            team for the following rental request:
          </p>

          <table style="border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Request ID</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.rentalRequestId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Product</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.productName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Pickup address</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.pickupAddress}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Delivery address</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.deliveryAddress}</td>
            </tr>
          </table>

          <p style="margin-top: 12px;">The moderator verified the product condition at pickup and will check it again after the rental term. Please contact the ToolShare moderator team for pickup instructions.</p>

          <p>
            Regards,<br />
            <strong>ToolShare Team</strong>
          </p>

        </div>
      `,
    });
}

// ======================================================
// HANDOVER OTP EMAIL (PHASE 13)
// Sent to the responsible party (owner or renter)
// when the rider requests handover verification
// for their stage.
// ======================================================

async handoverOtpEmail(
    email: string,
    firstName: string,
    details: {
        rentalId: string;
        productName: string;
        stageLabel: string;
        otpCode: string;
        expiresAt: Date;
    },
): Promise<void> {
    const expiresAtText =
        details.expiresAt.toLocaleString();

    await this.mailerService.sendMail({
        to: email,
        subject: 'ToolShare - Handover Verification Code',
        html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">

          <h2 style="color: #1565c0;">
            Handover Verification Code
          </h2>

          <p>Hello ${firstName},</p>

          <p>
            A verification code was generated for the
            following handover step:
          </p>

          <table style="border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Rental ID</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.rentalId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Product</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.productName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #555;"><strong>Step</strong></td>
              <td style="padding: 6px 0; color: #333;">${details.stageLabel}</td>
            </tr>
          </table>

          <div style="margin-top: 16px; padding: 12px; background: #e3f2fd; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #555;">Your verification code is</p>
            <p style="margin: 4px 0 0; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0d47a1;">
              ${details.otpCode}
            </p>
          </div>

          <p style="margin-top: 12px;">
            This code expires at <strong>${expiresAtText}</strong>
            and can only be used once. Share it only with
            the assigned rider at the handover location.
          </p>

          <p>
            If you did not expect this handover step,
            contact the ToolShare moderator team immediately.
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
