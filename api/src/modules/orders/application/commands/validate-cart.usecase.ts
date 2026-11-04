import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { computeTotals } from '../../domain/money';
import { CartEmpty, NoRestaurantInScope } from '../application.errors';
import { CartInput } from '../dto/qr-cart.types';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { CartPricingService } from '../services/cart-pricing.service';

export interface ValidateCartInput extends CartInput {
  restaurantId: string | null;
  branchId: string;
}

export interface ValidatedCartLineModifier {
  name: string;
  priceDeltaAmount: number;
}

export interface ValidatedCartLine {
  menuItemId: string;
  name: string;
  unitPriceAmount: number;
  quantity: number;
  modifiers: ValidatedCartLineModifier[];
  lineTotalAmount: number;
}

export interface ValidatedCart {
  currency: string;
  lines: ValidatedCartLine[];
  subtotalAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
}

/**
 * ValidateCart — recompute every price + line total server-side against the live
 * menu and verify availability/modifier rules. Client-supplied prices/totals are
 * never trusted; this returns the authoritative pricing the customer will pay.
 * Pure preview — nothing is persisted.
 */
@Injectable()
export class ValidateCartUseCase implements UseCase<ValidateCartInput, ValidatedCart> {
  constructor(
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    private readonly pricing: CartPricingService,
  ) {}

  async execute(input: ValidateCartInput): Promise<ValidatedCart> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    if (!input.lines || input.lines.length === 0) {
      throw CartEmpty();
    }
    const settings = await this.settings.get(input.restaurantId);
    const items = await this.pricing.buildItems(
      input.restaurantId,
      input.branchId,
      'cart-preview',
      input.lines,
    );

    const subtotal = items.reduce((sum, i) => sum + i.lineTotalAmount, 0);
    const totals = computeTotals(subtotal, null, null, settings.serviceFeeRateBps);

    return {
      currency: settings.currency,
      lines: items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.nameSnapshot,
        unitPriceAmount: i.unitPriceAmount,
        quantity: i.quantity,
        modifiers: i.modifiers.map((m) => ({
          name: m.nameSnapshot,
          priceDeltaAmount: m.priceDeltaAmount,
        })),
        lineTotalAmount: i.lineTotalAmount,
      })),
      subtotalAmount: totals.subtotalAmount,
      serviceFeeAmount: totals.serviceFeeAmount,
      totalAmount: totals.totalAmount,
    };
  }
}
