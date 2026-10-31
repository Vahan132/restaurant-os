import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  CURRENT_KEK_VERSION,
  FiscalCryptoService,
  GcmBlob,
} from '../../../fiscal-config/infrastructure/crypto/fiscal-crypto.service';

/** Decrypted provider config — in-process only, NEVER on an HTTP read model. */
export interface PaynetSecrets {
  id: string;
  restaurantId: string;
  branchId: string;
  enabled: boolean;
  livemode: boolean;
  apiKey: string;
  webhookSecret: string | null;
  domain: string | null;
  processor: string | null;
}

/** Non-secret status view (structurally has no key/secret field). */
export interface PaymentProviderStatus {
  id: string;
  provider: 'PAYNET';
  enabled: boolean;
  livemode: boolean;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  webhookSecretConfigured: boolean;
  domain: string | null;
  processor: string | null;
  lastCheckAt: Date | null;
  lastCheckOk: boolean | null;
  lastCheckError: string | null;
  updatedAt: Date;
}

export interface UpsertPaynetConfigInput {
  restaurantId: string;
  branchId: string;
  enabled: boolean;
  /** Omit/blank to keep the stored key. */
  apiKey?: string | null;
  /** Omit/blank to keep; empty string with `clearWebhookSecret` removes it. */
  webhookSecret?: string | null;
  domain?: string | null;
  processor?: string | null;
}

export class PaymentConfigError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PaymentConfigError';
  }
}

/**
 * PAYNET-1 — Prisma store for per-branch payment provider configs. Secrets are
 * envelope-encrypted exactly like fiscal secrets (FiscalCryptoService: a per-row
 * random DEK wrapped by FISCAL_MASTER_KEK; AES-256-GCM). The row is cloud-only.
 */
@Injectable()
export class PaymentProviderConfigStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FiscalCryptoService,
  ) {}

  async getStatus(restaurantId: string, branchId: string): Promise<PaymentProviderStatus | null> {
    const row = await this.prisma.paymentProviderConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
    });
    if (!row) return null;
    return {
      id: row.id,
      provider: 'PAYNET',
      enabled: row.enabled,
      livemode: row.livemode,
      apiKeyConfigured: row.apiKeyCipher !== null,
      apiKeyLast4: row.apiKeyLast4,
      webhookSecretConfigured: row.webhookSecretCipher !== null,
      domain: row.domain,
      processor: row.processor,
      lastCheckAt: row.lastCheckAt,
      lastCheckOk: row.lastCheckOk,
      lastCheckError: row.lastCheckError,
      updatedAt: row.updatedAt,
    };
  }

  async upsert(input: UpsertPaynetConfigInput): Promise<void> {
    const where = {
      restaurantId_branchId: { restaurantId: input.restaurantId, branchId: input.branchId },
    };
    const existing = await this.prisma.paymentProviderConfig.findUnique({ where });
    const apiKey = input.apiKey?.trim() || null;
    const webhookSecret = input.webhookSecret?.trim() || null;

    if (apiKey && !/^sk_(live|test)_[A-Za-z0-9_-]{8,}$/.test(apiKey)) {
      throw new PaymentConfigError(
        'PAYNET_KEY_INVALID',
        'The Paynet secret key must start with sk_live_ or sk_test_.',
      );
    }
    if (!apiKey && !existing?.apiKeyCipher && input.enabled) {
      throw new PaymentConfigError('PAYNET_KEY_REQUIRED', 'Enter the Paynet secret key first.');
    }

    // Reuse the row DEK when present; otherwise mint one.
    let dek: Buffer;
    let dekColumns: Record<string, unknown> = {};
    if (existing?.dekCipher && existing.dekIv && existing.dekAuthTag) {
      dek = this.crypto.unwrapDek({
        cipher: existing.dekCipher,
        iv: existing.dekIv,
        authTag: existing.dekAuthTag,
      });
    } else {
      dek = this.crypto.generateDek();
      const wrapped = this.crypto.wrapDek(dek);
      dekColumns = {
        dekCipher: wrapped.cipher,
        dekIv: wrapped.iv,
        dekAuthTag: wrapped.authTag,
        kekVersion: CURRENT_KEK_VERSION,
      };
    }
    const seal = (v: string): GcmBlob => this.crypto.sealUnderDek(dek, Buffer.from(v, 'utf8'));

    const data = {
      enabled: input.enabled,
      ...(input.domain !== undefined ? { domain: input.domain?.trim() || null } : {}),
      ...(input.processor !== undefined ? { processor: input.processor?.trim() || null } : {}),
      ...dekColumns,
      ...(apiKey
        ? (() => {
            const b = seal(apiKey);
            return {
              apiKeyCipher: b.cipher,
              apiKeyIv: b.iv,
              apiKeyAuthTag: b.authTag,
              apiKeyLast4: apiKey.slice(-4),
              livemode: apiKey.startsWith('sk_live_'),
              // a new key invalidates the last check
              lastCheckAt: null,
              lastCheckOk: null,
              lastCheckError: null,
            };
          })()
        : {}),
      ...(webhookSecret
        ? (() => {
            const b = seal(webhookSecret);
            return {
              webhookSecretCipher: b.cipher,
              webhookSecretIv: b.iv,
              webhookSecretAuthTag: b.authTag,
            };
          })()
        : {}),
    };

    if (existing) {
      await this.prisma.paymentProviderConfig.update({ where, data });
    } else {
      await this.prisma.paymentProviderConfig.create({
        data: { restaurantId: input.restaurantId, branchId: input.branchId, ...data },
      });
    }
  }

  /** Active (enabled + key) config for a branch, decrypted; null when none. */
  async getActiveSecrets(restaurantId: string, branchId: string): Promise<PaynetSecrets | null> {
    const row = await this.prisma.paymentProviderConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
    });
    if (!row || !row.enabled) return null;
    return this.open(row);
  }

  /** Any config (enabled or not) for a branch, decrypted; null when no key. Admin test only. */
  async getSecrets(restaurantId: string, branchId: string): Promise<PaynetSecrets | null> {
    const row = await this.prisma.paymentProviderConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
    });
    return row ? this.open(row) : null;
  }

  /** By row id (the webhook URL carries it); null when unknown/no key. */
  async getSecretsById(id: string): Promise<PaynetSecrets | null> {
    const row = await this.prisma.paymentProviderConfig.findUnique({ where: { id } });
    return row ? this.open(row) : null;
  }

  async recordCheck(restaurantId: string, branchId: string, ok: boolean, error: string | null) {
    await this.prisma.paymentProviderConfig.update({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      data: { lastCheckAt: new Date(), lastCheckOk: ok, lastCheckError: error },
    });
  }

  private open(row: {
    id: string;
    restaurantId: string;
    branchId: string;
    enabled: boolean;
    livemode: boolean;
    apiKeyCipher: Buffer | null;
    apiKeyIv: Buffer | null;
    apiKeyAuthTag: Buffer | null;
    webhookSecretCipher: Buffer | null;
    webhookSecretIv: Buffer | null;
    webhookSecretAuthTag: Buffer | null;
    dekCipher: Buffer | null;
    dekIv: Buffer | null;
    dekAuthTag: Buffer | null;
    domain: string | null;
    processor: string | null;
  }): PaynetSecrets | null {
    if (
      !row.apiKeyCipher ||
      !row.apiKeyIv ||
      !row.apiKeyAuthTag ||
      !row.dekCipher ||
      !row.dekIv ||
      !row.dekAuthTag
    ) {
      return null;
    }
    const dek = this.crypto.unwrapDek({
      cipher: row.dekCipher,
      iv: row.dekIv,
      authTag: row.dekAuthTag,
    });
    const apiKey = this.crypto
      .openUnderDek(dek, { cipher: row.apiKeyCipher, iv: row.apiKeyIv, authTag: row.apiKeyAuthTag })
      .toString('utf8');
    const webhookSecret =
      row.webhookSecretCipher && row.webhookSecretIv && row.webhookSecretAuthTag
        ? this.crypto
            .openUnderDek(dek, {
              cipher: row.webhookSecretCipher,
              iv: row.webhookSecretIv,
              authTag: row.webhookSecretAuthTag,
            })
            .toString('utf8')
        : null;
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      branchId: row.branchId,
      enabled: row.enabled,
      livemode: row.livemode,
      apiKey,
      webhookSecret,
      domain: row.domain,
      processor: row.processor,
    };
  }
}
