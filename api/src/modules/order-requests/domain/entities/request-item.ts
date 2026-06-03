import { RequestItemModifier } from './request-item-modifier';

export interface RequestItemProps {
  menuItemId: string;
  nameSnapshot: string;
  unitPriceAmount: number;
  quantity: number;
  note: string | null;
  lineTotalAmount: number;
  modifiers: RequestItemModifier[];
}

/** A snapshotted line on a customer order request (name/price/deltas captured at creation). */
export class RequestItem {
  private constructor(
    private readonly _id: string,
    private readonly props: RequestItemProps,
  ) {}

  static create(id: string, input: Omit<RequestItemProps, 'lineTotalAmount'>): RequestItem {
    const modifiersTotal = input.modifiers.reduce((s, m) => s + m.priceDeltaAmount, 0);
    const lineTotalAmount = (input.unitPriceAmount + modifiersTotal) * input.quantity;
    return new RequestItem(id, { ...input, lineTotalAmount });
  }
  static reconstitute(id: string, props: RequestItemProps): RequestItem {
    return new RequestItem(id, props);
  }

  get id(): string {
    return this._id;
  }
  get menuItemId(): string {
    return this.props.menuItemId;
  }
  get nameSnapshot(): string {
    return this.props.nameSnapshot;
  }
  get unitPriceAmount(): number {
    return this.props.unitPriceAmount;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get note(): string | null {
    return this.props.note;
  }
  get lineTotalAmount(): number {
    return this.props.lineTotalAmount;
  }
  get modifiers(): RequestItemModifier[] {
    return [...this.props.modifiers];
  }
}
