import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { WriteOffLineKind, WriteOffReason } from '../enums';
import { WriteOffCreatedEvent, WriteOffVoidedEvent } from '../events/inventory-events';
import { WriteOffAlreadyVoidedError } from '../inventory.errors';

/** A single write-off line (ITEM = raw item, DISH = exploded recipe). */
export interface WriteOffLineProps {
  id: string;
  branchId: string;
  kind: WriteOffLineKind;
  itemId: string | null;
  menuItemId: string | null;
  enteredUnit: string | null;
  enteredQty: number | null;
  baseQty: number | null;
  units: number | null;
  modifierOptionIds: string[] | null;
  /** Actual consumed cost recorded for this line (positive magnitude, minor units). */
  costAmount: number;
}

export class WriteOffLine {
  constructor(private readonly props: WriteOffLineProps) {}
  get id(): string {
    return this.props.id;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get kind(): WriteOffLineKind {
    return this.props.kind;
  }
  get itemId(): string | null {
    return this.props.itemId;
  }
  get menuItemId(): string | null {
    return this.props.menuItemId;
  }
  get enteredUnit(): string | null {
    return this.props.enteredUnit;
  }
  get enteredQty(): number | null {
    return this.props.enteredQty;
  }
  get baseQty(): number | null {
    return this.props.baseQty;
  }
  get units(): number | null {
    return this.props.units;
  }
  get modifierOptionIds(): string[] | null {
    return this.props.modifierOptionIds;
  }
  get costAmount(): number {
    return this.props.costAmount;
  }
}

export interface WriteOffProps {
  restaurantId: string;
  branchId: string;
  reason: WriteOffReason;
  note: string | null;
  occurredAt: Date;
  createdByUserId: string;
  voidedAt: Date | null;
  voidedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: WriteOffLine[];
}

/**
 * WriteOff aggregate (operational; append-only except the void stamp). Reason-
 * coded loss or staff meal. The actual stock draws live on the movement ledger
 * (refType=WRITE_OFF, refId=writeOff.id); a void reverses them.
 */
export class WriteOff extends AggregateRoot<string> {
  private props: WriteOffProps;

  private constructor(id: string, props: WriteOffProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    reason: WriteOffReason;
    note?: string | null;
    occurredAt: Date;
    createdByUserId: string;
    lines: WriteOffLine[];
  }): WriteOff {
    const now = new Date();
    const writeOff = new WriteOff(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      reason: input.reason,
      note: input.note ?? null,
      occurredAt: input.occurredAt,
      createdByUserId: input.createdByUserId,
      voidedAt: null,
      voidedByUserId: null,
      createdAt: now,
      updatedAt: now,
      lines: input.lines,
    });
    writeOff.addDomainEvent(
      new WriteOffCreatedEvent(
        input.id,
        input.restaurantId,
        input.reason,
        writeOff.totalCostAmount,
        input.createdByUserId,
      ),
    );
    return writeOff;
  }

  static reconstitute(id: string, props: WriteOffProps): WriteOff {
    return new WriteOff(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get reason(): WriteOffReason {
    return this.props.reason;
  }
  get note(): string | null {
    return this.props.note;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get voidedAt(): Date | null {
    return this.props.voidedAt;
  }
  get voidedByUserId(): string | null {
    return this.props.voidedByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get lines(): WriteOffLine[] {
    return this.props.lines;
  }
  get isVoided(): boolean {
    return this.props.voidedAt !== null;
  }
  get totalCostAmount(): number {
    return this.props.lines.reduce((sum, l) => sum + l.costAmount, 0);
  }

  /** Mark voided. Throws if already voided (the reversal itself is idempotent). */
  void(voidedByUserId: string, at: Date = new Date()): void {
    if (this.props.voidedAt !== null) {
      throw new WriteOffAlreadyVoidedError();
    }
    this.props.voidedAt = at;
    this.props.voidedByUserId = voidedByUserId;
    this.props.updatedAt = new Date();
    this.addDomainEvent(new WriteOffVoidedEvent(this.id, this.props.restaurantId, voidedByUserId));
  }
}
