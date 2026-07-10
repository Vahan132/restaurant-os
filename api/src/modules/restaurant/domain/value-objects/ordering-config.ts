import { InvalidOrderingConfigError } from '../restaurant.errors';

export interface OrderingConfigProps {
  /** Branch: pay-before ordering enabled. */
  prepaymentEnabled: boolean;
  /** Branch: pay-at-end (open tab) ordering enabled. */
  payAtEndEnabled: boolean;
  /** Branch: QR-web channel may create sessions (always prepayment when true). */
  qrOrderingEnabled: boolean;
  /** Idle auto-expiry threshold, minutes. Bounded [30, 480]. Default 150 (2.5h). */
  idleExpiryMinutes: number;
}

/**
 * OrderingConfig — a branch-level ordering flow policy (value object).
 *
 * This VO enforces only the branch config's INTERNAL coherence. The restaurant
 * ceiling (RestaurantSettings.enableCustomerOrdering / enableQrMenu) is applied
 * separately at session start ("effective = restaurant AND branch") — a branch
 * can never enable what the restaurant disabled.
 *
 * Invariants:
 *   - idleExpiryMinutes is an integer in [30, 480];
 *   - if any ordering flag is on, at least one of prepayment / payAtEnd is on;
 *   - qrOrderingEnabled ⇒ prepaymentEnabled.
 */
export class OrderingConfig {
  static readonly MIN_IDLE_MINUTES = 30;
  static readonly MAX_IDLE_MINUTES = 480;
  static readonly DEFAULT_IDLE_MINUTES = 150;

  private constructor(private readonly props: OrderingConfigProps) {}

  static create(props: OrderingConfigProps): OrderingConfig {
    OrderingConfig.validate(props);
    return new OrderingConfig({ ...props });
  }

  /** The default config for a new branch: ordering off, idle 150 minutes. */
  static default(): OrderingConfig {
    return new OrderingConfig({
      prepaymentEnabled: false,
      payAtEndEnabled: false,
      qrOrderingEnabled: false,
      idleExpiryMinutes: OrderingConfig.DEFAULT_IDLE_MINUTES,
    });
  }

  private static validate(p: OrderingConfigProps): void {
    if (
      !Number.isInteger(p.idleExpiryMinutes) ||
      p.idleExpiryMinutes < OrderingConfig.MIN_IDLE_MINUTES ||
      p.idleExpiryMinutes > OrderingConfig.MAX_IDLE_MINUTES
    ) {
      throw new InvalidOrderingConfigError(
        `idleExpiryMinutes must be an integer in [${OrderingConfig.MIN_IDLE_MINUTES}, ${OrderingConfig.MAX_IDLE_MINUTES}].`,
      );
    }
    const anyEnabled = p.prepaymentEnabled || p.payAtEndEnabled || p.qrOrderingEnabled;
    if (anyEnabled && !p.prepaymentEnabled && !p.payAtEndEnabled) {
      throw new InvalidOrderingConfigError(
        'At least one of prepaymentEnabled / payAtEndEnabled must be true when ordering is enabled.',
      );
    }
    if (p.qrOrderingEnabled && !p.prepaymentEnabled) {
      throw new InvalidOrderingConfigError('qrOrderingEnabled requires prepaymentEnabled.');
    }
  }

  get prepaymentEnabled(): boolean {
    return this.props.prepaymentEnabled;
  }
  get payAtEndEnabled(): boolean {
    return this.props.payAtEndEnabled;
  }
  get qrOrderingEnabled(): boolean {
    return this.props.qrOrderingEnabled;
  }
  get idleExpiryMinutes(): number {
    return this.props.idleExpiryMinutes;
  }

  /** Return a NEW validated config with the given fields patched. */
  with(patch: Partial<OrderingConfigProps>): OrderingConfig {
    return OrderingConfig.create({ ...this.props, ...patch });
  }

  equals(other: OrderingConfig): boolean {
    return (
      this.props.prepaymentEnabled === other.props.prepaymentEnabled &&
      this.props.payAtEndEnabled === other.props.payAtEndEnabled &&
      this.props.qrOrderingEnabled === other.props.qrOrderingEnabled &&
      this.props.idleExpiryMinutes === other.props.idleExpiryMinutes
    );
  }

  toJSON(): OrderingConfigProps {
    return { ...this.props };
  }
}
