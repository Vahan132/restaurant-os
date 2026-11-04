import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  IssuedSessionToken,
  SessionTokenService,
} from '../../application/ports/session-token.service';

/**
 * Opaque session tokens: a 48-byte random string (never a JWT); only its SHA-256
 * hash is persisted (mirrors the consumer refresh-token pattern). The plaintext
 * is returned to the client once at creation and never stored.
 */
@Injectable()
export class CryptoSessionTokenService implements SessionTokenService {
  generate(): IssuedSessionToken {
    const token = randomBytes(48).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
