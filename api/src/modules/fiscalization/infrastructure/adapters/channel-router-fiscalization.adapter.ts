import { Injectable } from '@nestjs/common';
import {
  FiscalizationInput,
  FiscalizationPort,
  FiscalizationResult,
} from '../../application/ports/fiscalization.port';
import { EHdmFiscalizationAdapter } from './ehdm-fiscalization.adapter';
import { StubFiscalizationAdapter } from './stub-fiscalization.adapter';

/**
 * Channel-router FiscalizationPort (decision B). Bound to the single
 * FISCALIZATION_PORT token so call sites are unchanged; dispatches on
 * `input.channel`:
 *   - QR_WEB / APP  → electronic-HDM adapter (real fiscalization).
 *   - POS (default) → stub, until the physical-HDM adapter lands in FISCAL-2 and
 *                     replaces this branch (TCP/3DES, dine-in POS).
 * Routing the electronic channels only means POS lines are never sent to the SRC
 * web service by mistake.
 */
@Injectable()
export class ChannelRouterFiscalizationAdapter implements FiscalizationPort {
  constructor(
    private readonly ehdm: EHdmFiscalizationAdapter,
    private readonly stub: StubFiscalizationAdapter,
  ) {}

  fiscalize(input: FiscalizationInput): Promise<FiscalizationResult> {
    switch (input.channel) {
      case 'QR_WEB':
      case 'APP':
        return this.ehdm.fiscalize(input);
      case 'POS':
      default:
        return this.stub.fiscalize(input);
    }
  }
}
