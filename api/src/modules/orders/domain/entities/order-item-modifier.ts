export interface OrderItemModifierProps {
  modifierGroupId: string | null;
  modifierOptionId: string | null;
  nameSnapshot: string;
  priceDeltaAmount: number;
}

/** A snapshotted modifier selection on an order item (inside the Order aggregate). */
export class OrderItemModifier {
  private constructor(
    private readonly _id: string,
    private props: OrderItemModifierProps,
  ) {}

  static create(id: string, props: OrderItemModifierProps): OrderItemModifier {
    return new OrderItemModifier(id, props);
  }

  static reconstitute(id: string, props: OrderItemModifierProps): OrderItemModifier {
    return new OrderItemModifier(id, props);
  }

  get id(): string {
    return this._id;
  }
  get modifierGroupId(): string | null {
    return this.props.modifierGroupId;
  }
  get modifierOptionId(): string | null {
    return this.props.modifierOptionId;
  }
  get nameSnapshot(): string {
    return this.props.nameSnapshot;
  }
  get priceDeltaAmount(): number {
    return this.props.priceDeltaAmount;
  }
}
