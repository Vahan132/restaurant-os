import { Inject, Injectable } from '@nestjs/common';
import {
  FISCAL_CONFIG_STORE,
  FiscalConfigStatus,
  FiscalConfigStore,
} from '../../../fiscal-config/application/ports/fiscal-config-store.port';

export interface GetFiscalConfigStatusQuery {
  restaurantId: string;
  branchId: string;
}

/** Platform-admin: non-secret fiscal-config status for a branch (null if unset). */
@Injectable()
export class GetFiscalConfigStatusUseCase {
  constructor(@Inject(FISCAL_CONFIG_STORE) private readonly store: FiscalConfigStore) {}

  execute(q: GetFiscalConfigStatusQuery): Promise<FiscalConfigStatus | null> {
    return this.store.getStatus(q.restaurantId, q.branchId);
  }
}
