import { Injectable, Logger } from '@nestjs/common';
import { SmsMessage, SmsSender } from '../../application/ports/sms-sender';

/**
 * Dev console-stub SMS sender — auto-selected when Nikita credentials are absent.
 * Prints the message (incl. the OTP code) so the OTP flow works end-to-end without
 * a real SMS gateway. NEVER selected in production with creds set.
 */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS(console-stub)');

  send(message: SmsMessage): Promise<void> {
    this.logger.log(`To ${message.to}: ${message.body}`);
    return Promise.resolve();
  }
}
