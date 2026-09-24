import { Controller, Get } from '@nestjs/common';
import { EmailService  } from './email.service'

@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: EmailService,
  ) {}

  @Get('test')
  async testEmail(): Promise<string> {
    await this.mailService.sendTestEmail(
      'kahiumahamedfahim@gmail.com',
    );

    return 'Test email sent successfully.';
  }
}