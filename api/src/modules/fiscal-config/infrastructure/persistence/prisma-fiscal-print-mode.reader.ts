import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  FiscalPrintMode,
  FiscalPrintModeReader,
} from '../../application/ports/fiscal-print-mode.reader';

/**
 * Prisma-backed print-mode reader (FISCAL-EDGE-3). Reads only the non-secret
 * `active` + `fiscalPrintMode` scalars — no decryption, never fails closed. On
 * the hub this reads the SYNCED local fiscal config row. Returns `null` when the
 * branch has no active fiscal config so the dine-in trigger skips fiscalization
 * without touching the order's fiscal state.
 */
@Injectable()
export class PrismaFiscalPrintModeReader implements FiscalPrintModeReader {
  constructor(private readonly prisma: PrismaService) {}

  async getPrintMode(restaurantId: string, branchId: string): Promise<FiscalPrintMode | null> {
    const cfg = await this.prisma.fiscalConfig.findUnique({
      where: { restaurantId_branchId: { restaurantId, branchId } },
      select: { active: true, fiscalPrintMode: true },
    });
    if (!cfg || !cfg.active) {
      return null;
    }
    return cfg.fiscalPrintMode as FiscalPrintMode;
  }
}
