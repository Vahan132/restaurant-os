/** DI token for the SmsSender port. */
export const SMS_SENDER = Symbol('SmsSender');

export interface SmsMessage {
  /** Recipient in E.164. */
  to: string;
  body: string;
}

/**
 * Outbound SMS port. Implemented by the Nikita adapter in prod and a console-stub
 * in dev (auto-selected when Nikita creds are absent). Callers MUST NOT let a send
 * failure abort their own write (e.g. OTP record creation) — treat send as
 * best-effort and catch.
 */
export interface SmsSender {
  send(message: SmsMessage): Promise<void>;
}
