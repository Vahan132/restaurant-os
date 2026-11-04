/**
 * Phase 05 — one enrolled POS tablet + one KDS device per branch (decision F),
 * through the REAL EnrollDeviceUseCase: it mints a high-entropy secret, stores
 * only sha256(secret), and returns the plaintext once (printed for the operator
 * to install + test PIN-login on a device of the staff member's branch).
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCH_LIST } from '../data/core';
import { DeviceSurface } from '../../../src/modules/identity/domain/entities/device';

export async function seedDevices(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;
  const ownerId = state.userIdBySlug['owner'];

  for (const branch of BRANCH_LIST) {
    const plan: Array<{ surface: DeviceSurface; label: string }> = [
      { surface: DeviceSurface.POS, label: `${branch.name} — POS` },
      { surface: DeviceSurface.KDS, label: `${branch.name} — KDS` },
    ];
    for (const d of plan) {
      const existing = await prisma.device.findFirst({
        where: { restaurantId: RESTAURANT.id, branchId: branch.id, surface: d.surface, label: d.label },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      const result = await uc.enrollDevice.execute({
        restaurantId: RESTAURANT.id,
        branchId: branch.id,
        surface: d.surface,
        label: d.label,
        enrolledByUserId: ownerId,
        ip: '192.168.10.20',
      });
      state.printouts.push(`DEVICE ${d.label} [${d.surface}] secret: ${result.secret}`);
    }
  }
}
