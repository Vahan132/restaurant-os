import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const DEK_BYTES = 32;
/** Current master-KEK version; bump + re-wrap DEKs on rotation. */
export const CURRENT_KEK_VERSION = 1;

export interface GcmBlob {
  cipher: Buffer;
  iv: Buffer;
  authTag: Buffer;
}
export interface WrappedSecrets {
  cert: GcmBlob;
  key: GcmBlob;
  /** The per-tenant DEK, itself encrypted under the master KEK. */
  dek: GcmBlob;
  kekVersion: number;
}

/**
 * Envelope encryption for fiscal secrets (FISCAL-4). A per-tenant random DEK
 * (AES-256-GCM) encrypts the cert + key; the DEK is wrapped by the master KEK
 * (`FISCAL_MASTER_KEK` — outside the DB, KMS is the scale follow-up). Rotating
 * the KEK re-wraps DEKs only (no cert re-encryption); one leaked cert never
 * implies the others. The KEK is BOOT-VALIDATED (present + correct 32-byte hex)
 * so a present-but-malformed key fails fast here, not at first decrypt. Secrets
 * are never logged.
 */
@Injectable()
export class FiscalCryptoService {
  private readonly kek: Buffer | null;

  constructor(config: ConfigService<AppConfig, true>) {
    const hex = config.get('FISCAL_MASTER_KEK', { infer: true }) as string | undefined;
    if (hex !== undefined) {
      if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error('FISCAL_MASTER_KEK must be 64 hex chars (32 bytes).');
      }
      this.kek = Buffer.from(hex, 'hex');
    } else {
      this.kek = null;
    }
  }

  /** True when a valid master KEK is present. */
  get isConfigured(): boolean {
    return this.kek !== null;
  }

  private masterKey(): Buffer {
    if (!this.kek) {
      throw new Error('FISCAL_MASTER_KEK is not configured; cannot handle fiscal secrets.');
    }
    return this.kek;
  }

  private encrypt(key: Buffer, plaintext: Buffer): GcmBlob {
    const iv = randomBytes(IV_BYTES);
    const c = createCipheriv(ALGO, key, iv);
    const cipher = Buffer.concat([c.update(plaintext), c.final()]);
    return { cipher, iv, authTag: c.getAuthTag() };
  }

  private decrypt(key: Buffer, blob: GcmBlob): Buffer {
    const d = createDecipheriv(ALGO, key, blob.iv);
    d.setAuthTag(blob.authTag);
    return Buffer.concat([d.update(blob.cipher), d.final()]);
  }

  /** Envelope-encrypt cert + key under a fresh DEK; wrap the DEK with the KEK. */
  wrap(certPem: Buffer, keyPem: Buffer): WrappedSecrets {
    const dek = randomBytes(DEK_BYTES);
    const cert = this.encrypt(dek, certPem);
    const key = this.encrypt(dek, keyPem);
    const dekBlob = this.encrypt(this.masterKey(), dek);
    return { cert, key, dek: dekBlob, kekVersion: CURRENT_KEK_VERSION };
  }

  /** Unwrap the DEK with the KEK, then decrypt cert + key. */
  unwrap(w: WrappedSecrets): { cert: Buffer; key: Buffer } {
    const dek = this.decrypt(this.masterKey(), w.dek);
    return { cert: this.decrypt(dek, w.cert), key: this.decrypt(dek, w.key) };
  }
}
