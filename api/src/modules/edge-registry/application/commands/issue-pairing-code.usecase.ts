import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import {
  EDGE_PAIRING_CODE_REPOSITORY,
  EdgePairingCodeRepository,
} from '../../domain/repositories/edge-pairing-code.repository';
import { BRANCH_LOOKUP, BranchLookup } from '../ports/branch-lookup.port';
import { BranchNotInRestaurant, NoRestaurantInScope } from '../edge-registry.errors';
import { generatePairingCode, hashPairingCode } from '../edge-token.util';

/** How long a freshly issued pairing code stays redeemable. */
export const PAIRING_CODE_TTL_MS = 15 * 60_000; // 15 minutes

export interface IssuePairingCodeInput {
  organizationId: string;
  restaurantId: string | null;
  branchId: string;
  /** Name to give the EdgeNode created when the code is redeemed. */
  name: string;
  createdByUserId: string;
}

export interface IssuePairingCodeResult {
  /** Plaintext code — returned ONCE for the admin to read out. Only its hash is stored. */
  code: string;
  expiresAt: Date;
}

/**
 * EDGE-PAIR-2: issue a single-use, short-TTL, branch-scoped pairing code. The
 * restaurant admin (EDGE_MANAGE) generates it and reads it out; the hub redeems it
 * once at POST /edge/pair. The raw node token is never what the human handles.
 */
@Injectable()
export class IssuePairingCodeUseCase
  implements UseCase<IssuePairingCodeInput, IssuePairingCodeResult>
{
  constructor(
    @Inject(EDGE_PAIRING_CODE_REPOSITORY) private readonly codes: EdgePairingCodeRepository,
    @Inject(BRANCH_LOOKUP) private readonly branches: BranchLookup,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: IssuePairingCodeInput): Promise<IssuePairingCodeResult> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const branchOk = await this.branches.existsActive(input.restaurantId, input.branchId);
    if (!branchOk) {
      throw BranchNotInRestaurant();
    }

    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
    await this.codes.create({
      id: this.ids.generate(),
      codeHash: hashPairingCode(code),
      organizationId: input.organizationId,
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      createdByUserId: input.createdByUserId,
      expiresAt,
    });
    return { code, expiresAt };
  }
}
