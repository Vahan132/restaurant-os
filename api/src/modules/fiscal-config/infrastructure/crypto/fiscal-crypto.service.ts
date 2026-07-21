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
    const dek = this.generateDek();
    const cert = this.sealUnderDek(dek, certPem);
    const key = this.sealUnderDek(dek, keyPem);
    const dekBlob = this.wrapDek(dek);
    return { cert, key, dek: dekBlob, kekVersion: CURRENT_KEK_VERSION };
  }

  /** Unwrap the DEK with the KEK, then decrypt cert + key. */
  unwrap(w: WrappedSecrets): { cert: Buffer; key: Buffer } {
    const dek = this.unwrapDek(w.dek);
    return { cert: this.openUnderDek(dek, w.cert), key: this.openUnderDek(dek, w.key) };
  }

  // ── DEK primitives (FISCAL-EDGE-1) ─────────────────────────────────────────
  // Exposed so callers can SHARE a single per-row DEK across several secrets
  // (cert, key, device password) — the device password is sealed under the same
  // DEK as the cert/key rather than getting its own. The raw DEK never leaves the
  // process; the KEK stays inside this service.

  /** A fresh random per-row DEK. */
  generateDek(): Buffer {
    return randomBytes(DEK_BYTES);
  }

  /** Wrap (encrypt) a DEK under the master KEK. */
  wrapDek(dek: Buffer): GcmBlob {
    return this.encrypt(this.masterKey(), dek);
  }

  /**
   * Unwrap (decrypt) a DEK with the master KEK. If the KEK does not match the one
   * that wrapped it, GCM auth-tag verification throws here — decryption fails
   * closed and no plaintext is produced.
   */
  unwrapDek(dekBlob: GcmBlob): Buffer {
    return this.decrypt(this.masterKey(), dekBlob);
  }

  /** Encrypt a value under an already-unwrapped DEK. */
  sealUnderDek(dek: Buffer, plaintext: Buffer): GcmBlob {
    return this.encrypt(dek, plaintext);
  }

  /** Decrypt a value that was sealed under the given DEK. */
  openUnderDek(dek: Buffer, blob: GcmBlob): Buffer {
    return this.decrypt(dek, blob);
  }

  // ── Per-hub KEK re-wrap (EDGE-KEK-1) ────────────────────────────────────────
  // A per-hub fiscal KEK is a fresh 32-byte key (same shape as a DEK). The cloud
  // generates one per hub, wraps it under the MASTER KEK for at-rest storage on
  // the edge_nodes row, and — at sync time — re-wraps each fiscal row's DEK to it.
  // Re-wrap NEVER decrypts the secrets sealed under the DEK (cert/key/device
  // password); only the DEK itself is unwrapped (master) then re-wrapped (hub KEK).
  // A stolen hub therefore only holds a KEK that opens its OWN branch's DEKs.

  /** A fresh random per-hub fiscal KEK (32 bytes). */
  generateHubKek(): Buffer {
    return randomBytes(DEK_BYTES);
  }

  /** Wrap a per-hub KEK under the master KEK (for at-rest storage on the node). */
  wrapHubKek(hubKek: Buffer): GcmBlob {
    return this.encrypt(this.masterKey(), hubKek);
  }

  /**
   * Unwrap a per-hub KEK that was wrapped under the master KEK. Fails closed at
   * GCM verify if the master KEK does not match the one that wrapped it.
   */
  unwrapHubKek(blob: GcmBlob): Buffer {
    return this.decrypt(this.masterKey(), blob);
  }

  /**
   * Re-wrap a row DEK from the master KEK to a target hub's per-hub KEK. The DEK
   * is unwrapped with the master KEK and re-wrapped under `hubKek`; the secrets
   * sealed under the DEK are NEVER decrypted (they travel as-is). The hub later
   * unwraps the DEK with its own KEK — a mismatched KEK fails closed at GCM verify
   * with no plaintext, containing a compromise to that hub's branch.
   */
  rewrapDekForHub(masterWrappedDek: GcmBlob, hubKek: Buffer): GcmBlob {
    const dek = this.unwrapDek(masterWrappedDek); // unwrap under the master KEK
    return this.encrypt(hubKek, dek); // re-wrap under the per-hub KEK
  }
}
