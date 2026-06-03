import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvalidRateError } from '../restaurant.errors';

export interface OpeningHour {
  day: number; // 0-6
  open: string; // "HH:mm"
  close: string; // "HH:mm"
  closed: boolean;
}

export interface RestaurantSettingsProps {
  restaurantId: string;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  taxRateBps: number;
  serviceFeeRateBps: number;
  receiptFooter: string | null;
  openingHours: OpeningHour[] | null;
  allowDiscounts: boolean;
  allowOrderCancellation: boolean;
  requireApprovalForCancellation: boolean;
  requireApprovalForDiscount: boolean;
  enableReservations: boolean;
  enableKds: boolean;
  allowManualTableStatus: boolean;
  enableQrMenu: boolean;
  enableCustomerOrdering: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateRestaurantSettingsInput {
  logoUrl?: string | null;
  phone?: string | null;
  address?: string | null;
  taxRateBps?: number;
  serviceFeeRateBps?: number;
  receiptFooter?: string | null;
  openingHours?: OpeningHour[] | null;
  allowDiscounts?: boolean;
  allowOrderCancellation?: boolean;
  requireApprovalForCancellation?: boolean;
  requireApprovalForDiscount?: boolean;
  enableReservations?: boolean;
  enableKds?: boolean;
  allowManualTableStatus?: boolean;
  enableQrMenu?: boolean;
  enableCustomerOrdering?: boolean;
}

/** RestaurantSettings aggregate (1:1 with Restaurant). Rates are basis points. */
export class RestaurantSettings extends AggregateRoot<string> {
  private props: RestaurantSettingsProps;

  private constructor(id: string, props: RestaurantSettingsProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: RestaurantSettingsProps): RestaurantSettings {
    return new RestaurantSettings(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get snapshot(): Readonly<RestaurantSettingsProps> {
    return this.props;
  }

  private static assertBps(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidRateError(field);
    }
  }

  updateSettings(input: UpdateRestaurantSettingsInput): void {
    if (input.taxRateBps !== undefined) {
      RestaurantSettings.assertBps(input.taxRateBps, 'taxRateBps');
      this.props.taxRateBps = input.taxRateBps;
    }
    if (input.serviceFeeRateBps !== undefined) {
      RestaurantSettings.assertBps(input.serviceFeeRateBps, 'serviceFeeRateBps');
      this.props.serviceFeeRateBps = input.serviceFeeRateBps;
    }
    if (input.logoUrl !== undefined) this.props.logoUrl = input.logoUrl;
    if (input.phone !== undefined) this.props.phone = input.phone;
    if (input.address !== undefined) this.props.address = input.address;
    if (input.receiptFooter !== undefined) this.props.receiptFooter = input.receiptFooter;
    if (input.openingHours !== undefined) this.props.openingHours = input.openingHours;
    if (input.allowDiscounts !== undefined) this.props.allowDiscounts = input.allowDiscounts;
    if (input.allowOrderCancellation !== undefined)
      this.props.allowOrderCancellation = input.allowOrderCancellation;
    if (input.requireApprovalForCancellation !== undefined)
      this.props.requireApprovalForCancellation = input.requireApprovalForCancellation;
    if (input.requireApprovalForDiscount !== undefined)
      this.props.requireApprovalForDiscount = input.requireApprovalForDiscount;
    if (input.enableReservations !== undefined)
      this.props.enableReservations = input.enableReservations;
    if (input.enableKds !== undefined) this.props.enableKds = input.enableKds;
    if (input.allowManualTableStatus !== undefined)
      this.props.allowManualTableStatus = input.allowManualTableStatus;
    if (input.enableQrMenu !== undefined) this.props.enableQrMenu = input.enableQrMenu;
    if (input.enableCustomerOrdering !== undefined)
      this.props.enableCustomerOrdering = input.enableCustomerOrdering;
    // Keep stored state honest: customer ordering requires the public QR menu.
    if (this.props.enableCustomerOrdering && !this.props.enableQrMenu) {
      this.props.enableCustomerOrdering = false;
    }
    this.props.updatedAt = new Date();
  }
}
