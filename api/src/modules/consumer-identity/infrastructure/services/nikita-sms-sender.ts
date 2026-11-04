import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import { SmsMessage, SmsSender } from '../../application/ports/sms-sender';

/**
 * Nikita SMS adapter (per the Nikita broker integration guide):
 *  - HTTP Basic auth (SMS_NIKITA_USER / SMS_NIKITA_PASS).
 *  - POST {SMS_NIKITA_URL}/broker-api/send.
 *  - E.164 recipient, configured originator, STRING priority, a unique message-id.
 *  - Throws on any non-2xx response.
 *
 * Selected only when credentials are present (see the SMS_SENDER factory in the
 * module); otherwise the console stub is used. Callers treat send as best-effort —
 * a throw here must not abort OTP record creation.
 */
@Injectable()
export class NikitaSmsSender implements SmsSender {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly originator: string;
  private readonly priority: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<AppConfig, true>) {
    this.baseUrl = stripTrailingSlash(config.get('SMS_NIKITA_URL', { infer: true }) ?? '');
    const user = config.get('SMS_NIKITA_USER', { infer: true }) ?? '';
    const pass = config.get('SMS_NIKITA_PASS', { infer: true }) ?? '';
    this.authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    this.originator = config.get('SMS_NIKITA_ORIGINATOR', { infer: true }) ?? '';
    this.priority = String(config.get('SMS_NIKITA_PRIORITY', { infer: true }) ?? '0');
    this.timeoutMs = config.get('SMS_NIKITA_TIMEOUT_MS', { infer: true }) ?? 10_000;
  }

  async send(message: SmsMessage): Promise<void> {
    const messageId = randomUUID();
    const payload = {
      messages: [
        {
          recipient: message.to, // E.164
          'message-id': messageId,
          'sms': {
            originator: this.originator,
            content: { text: message.body },
          },
          priority: this.priority, // string per the guide
        },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/broker-api/send`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Nikita responded ${res.status}: ${text.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
