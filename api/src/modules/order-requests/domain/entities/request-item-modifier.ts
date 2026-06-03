export interface RequestItemModifierProps {
  modifierGroupId: string | null;
  modifierOptionId: string | null;
  nameSnapshot: string;
  priceDeltaAmount: number;
}

/** Snapshotted modifier selection on a request item (price never re-derived later). */
export class RequestItemModifier {
  private constructor(
    private readonly _id: string,
    private readonly props: RequestItemModifierProps,
  ) {}

  static create(id: string, props: RequestItemModifierProps): RequestItemModifier {
    return new RequestItemModifier(id, props);
  }
  static reconstitute(id: string, props: RequestItemModifierProps): RequestItemModifier {
    return new RequestItemModifier(id, props);
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
