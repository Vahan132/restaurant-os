import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { OtpCodeHasher } from '../../application/ports/otp-code-hasher';

/** argon2id hasher for short OTP codes (same primitive family as staff PINs). */
@Injectable()
export class Argon2OtpCodeHasher implements OtpCodeHasher {
  hash(code: string): Promise<string> {
    return argon2.hash(code, { type: argon2.argon2id });
  }

  async verify(hash: string, code: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, code);
    } catch {
      return false;
    }
  }
}
