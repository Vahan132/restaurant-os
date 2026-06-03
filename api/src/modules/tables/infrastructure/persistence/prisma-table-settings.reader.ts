import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { TableSettingsReader } from '../../application/ports/table-settings.reader';

/** Reads allowManualTableStatus from the restaurant's settings row. */
@Injectable()
export class PrismaTableSettingsReader implements TableSettingsReader {
  constructor(private readonly prisma: PrismaService) {}

  async allowManualTableStatus(restaurantId: string): Promise<boolean> {
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: { allowManualTableStatus: true },
    });
    // Default to false (flow-driven) when settings are missing.
    return settings?.allowManualTableStatus ?? false;
  }
}
