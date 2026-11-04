import { Inject, Injectable } from '@nestjs/common';
import { NegativeStockMode } from '../../domain/enums';
import {
  BRANCH_INVENTORY_POLICY_REPOSITORY,
  BranchInventoryPolicyRepository,
} from '../../domain/repositories/branch-inventory-policy.repository';
import { STOCK_ON_HAND_READER, StockOnHandReader } from '../ports/stock-on-hand.reader';
import { NegativeStockBlocked } from '../application.errors';

/**
 * Enforces the per-branch negative-stock policy (6A, §5) for MANUAL/ADMIN
 * depletions. ALLOW/WARN permit the depletion (WARN simply flags wentNegative
 * downstream); BLOCK rejects it BEFORE any ledger write when it would drive
 * on-hand below zero.
 *
 * NOTE: the POS-serve path NEVER blocks regardless of policy — that exception is
 * wired in 6C. The reusable StockConsumptionPort therefore stays warn-don't-block;
 * BLOCK is enforced here, in the manual-adjustment use cases only.
 */
@Injectable()
export class NegativeStockPolicyService {
  constructor(
    @Inject(BRANCH_INVENTORY_POLICY_REPOSITORY)
    private readonly policies: BranchInventoryPolicyRepository,
    @Inject(STOCK_ON_HAND_READER) private readonly onHand: StockOnHandReader,
  ) {}

  async mode(restaurantId: string, branchId: string): Promise<NegativeStockMode> {
    const policy = await this.policies.find(restaurantId, branchId);
    return policy?.negativeStockMode ?? NegativeStockMode.WARN;
  }

  /** Throws NEGATIVE_STOCK_BLOCKED when a manual depletion of the whole item would
   *  push total on-hand below zero under a BLOCK policy. */
  async assertItemDepletionAllowed(
    restaurantId: string,
    branchId: string,
    itemId: string,
    requestedOutBaseQty: number,
  ): Promise<void> {
    if ((await this.mode(restaurantId, branchId)) !== NegativeStockMode.BLOCK) {
      return;
    }
    const rows = await this.onHand.byItem(restaurantId, branchId, itemId);
    const current = rows.reduce((sum, r) => sum + r.quantity, 0);
    if (current - requestedOutBaseQty < 0) {
      throw NegativeStockBlocked();
    }
  }

  /** Throws when a manual depletion at a SPECIFIC location would push that
   *  location's on-hand below zero under a BLOCK policy. */
  async assertLocationDepletionAllowed(
    restaurantId: string,
    branchId: string,
    itemId: string,
    locationId: string,
    requestedOutBaseQty: number,
  ): Promise<void> {
    if ((await this.mode(restaurantId, branchId)) !== NegativeStockMode.BLOCK) {
      return;
    }
    const current = await this.onHand.quantityAt(restaurantId, branchId, itemId, locationId);
    if (current - requestedOutBaseQty < 0) {
      throw NegativeStockBlocked();
    }
  }
}
