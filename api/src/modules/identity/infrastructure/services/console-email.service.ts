import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../application/ports/email.service';

/**
 * DEV email service — logs the message to the console instead of sending.
 * TODO: replace with a real SMTP/SES provider in production.
 */
@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendPasswordReset(email: string, link: string): Promise<void> {
    this.logger.log(`[DEV EMAIL] Password reset for ${email}: ${link}`);
  }
}
