import { Entity } from '../../../../shared/domain/entity';

export interface ProcessRunProps {
  restaurantId: string;
  branchId: string;
  processId: string;
  multiplier: number;
  inputCostAmount: number;
  processingCostAmount: number;
  totalCostAmount: number;
  wentNegative: boolean;
  runAt: Date;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProcessRun (execution record; operational, append-only — no soft delete).
 * There is NO undo for a run in MVP: corrections are made via INV-1 manual
 * adjustments. Produced layers/movements link back via refType=PROCESS_RUN,
 * refId=run.id.
 */
export class ProcessRun extends Entity<string> {
  private props: ProcessRunProps;

  private constructor(id: string, props: ProcessRunProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: ProcessRunProps): ProcessRun {
    return new ProcessRun(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get processId(): string {
    return this.props.processId;
  }
  get multiplier(): number {
    return this.props.multiplier;
  }
  get inputCostAmount(): number {
    return this.props.inputCostAmount;
  }
  get processingCostAmount(): number {
    return this.props.processingCostAmount;
  }
  get totalCostAmount(): number {
    return this.props.totalCostAmount;
  }
  get wentNegative(): boolean {
    return this.props.wentNegative;
  }
  get runAt(): Date {
    return this.props.runAt;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
