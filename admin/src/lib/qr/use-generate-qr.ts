'use client';

import { useState } from 'react';

import { useTablesControllerUpdate } from '@/api/generated/tables/tables';
import { isApiError } from '@/lib/api-error';
import { generateQrToken } from '@/lib/qr/customer-url';
import { useTablesInvalidation } from '@/lib/tables/use-tables-data';

function isUniqueCollision(err: unknown): boolean {
  if (!isApiError(err)) return false;
  if (err.status === 409) return true;
  const hay = `${err.code} ${err.message}`.toLowerCase();
  return hay.includes('unique') || hay.includes('conflict') || hay.includes('duplicate');
}

/**
 * Assigns a fresh URL-safe qrIdentifier to a table via PATCH /tables/:id.
 * Retries with a new token on the rare @unique collision. Caller invalidates
 * the tables query (done here on success).
 */
export function useGenerateQr() {
  const update = useTablesControllerUpdate();
  const invalidate = useTablesInvalidation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const generate = async (tableId: string, attempts = 5): Promise<string> => {
    setPendingId(tableId);
    try {
      let lastError: unknown;
      for (let i = 0; i < attempts; i++) {
        const token = generateQrToken();
        try {
          await update.mutateAsync({ id: tableId, data: { qrIdentifier: token } });
          return token;
        } catch (err) {
          lastError = err;
          if (!isUniqueCollision(err)) throw err;
        }
      }
      throw lastError;
    } finally {
      setPendingId(null);
    }
  };

  return { generate, invalidate, pendingId, isPending: update.isPending };
}
