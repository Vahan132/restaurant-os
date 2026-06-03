export const EMAIL_SERVICE = Symbol('EmailService');

/** Outbound email port. Real SMTP/SES is a documented TODO; dev impl logs to console. */
export interface EmailService {
  sendPasswordReset(email: string, link: string): Promise<void>;
}
