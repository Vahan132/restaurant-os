import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ProcessStatus } from '../enums';
import { ProcessCreatedEvent } from '../events/inventory-events';
import { ProcessShapeError } from '../inventory.errors';
import { validateAllocation } from '../services/cost-allocation';

/** One input line: an item consumed per 1× batch (RAW or PROCESSED). */
export interface ProcessInputProps {
  id: string;
  branchId: string;
  itemId: string;
  baseQty: number;
}

export class ProcessInput {
  constructor(private readonly props: ProcessInputProps) {}
  get id(): string {
    return this.props.id;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
}

/** One output line: a PROCESSED item produced per 1× batch. */
export interface ProcessOutputProps {
  id: string;
  branchId: string;
  itemId: string;
  baseQty: number;
  isPrimary: boolean;
  costShareBps: number | null;
}

export class ProcessOutput {
  constructor(private readonly props: ProcessOutputProps) {}
  get id(): string {
    return this.props.id;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
  get isPrimary(): boolean {
    return this.props.isPrimary;
  }
  get costShareBps(): number | null {
    return this.props.costShareBps;
  }
}

export interface ProcessProps {
  restaurantId: string;
  branchId: string;
  name: string;
  processingCostAmount: number;
  note: string | null;
  status: ProcessStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  inputs: ProcessInput[];
  outputs: ProcessOutput[];
}

/**
 * Process aggregate (definition; catalog, soft-delete). Turns raw/processed
 * inputs into one or more PROCESSED outputs. Validates structural shape +
 * cost-allocation rule; the use case validates output item KIND (needs the DB).
 */
export class Process extends AggregateRoot<string> {
  private props: ProcessProps;

  private constructor(id: string, props: ProcessProps) {
    super(id);
    this.props = props;
  }

  private static assertShape(inputs: ProcessInput[], outputs: ProcessOutput[]): void {
    if (inputs.length < 1) {
      throw new ProcessShapeError('A process must have at least one input.');
    }
    if (outputs.length < 1) {
      throw new ProcessShapeError('A process must have at least one output.');
    }
    validateAllocation(
      outputs.map((o) => ({ isPrimary: o.isPrimary, costShareBps: o.costShareBps })),
    );
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    name: string;
    processingCostAmount?: number;
    note?: string | null;
    inputs: ProcessInput[];
    outputs: ProcessOutput[];
    actorUserId?: string | null;
  }): Process {
    Process.assertShape(input.inputs, input.outputs);
    const now = new Date();
    const process = new Process(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      processingCostAmount: input.processingCostAmount ?? 0,
      note: input.note ?? null,
      status: ProcessStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      inputs: input.inputs,
      outputs: input.outputs,
    });
    process.addDomainEvent(
      new ProcessCreatedEvent(input.id, input.restaurantId, input.actorUserId ?? null),
    );
    return process;
  }

  static reconstitute(id: string, props: ProcessProps): Process {
    return new Process(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get name(): string {
    return this.props.name;
  }
  get processingCostAmount(): number {
    return this.props.processingCostAmount;
  }
  get note(): string | null {
    return this.props.note;
  }
  get status(): ProcessStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get inputs(): ProcessInput[] {
    return this.props.inputs;
  }
  get outputs(): ProcessOutput[] {
    return this.props.outputs;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /** Update header fields and FULLY replace inputs/outputs (re-validates shape). */
  update(input: {
    name?: string;
    processingCostAmount?: number;
    note?: string | null;
    inputs?: ProcessInput[];
    outputs?: ProcessOutput[];
  }): void {
    const nextInputs = input.inputs ?? this.props.inputs;
    const nextOutputs = input.outputs ?? this.props.outputs;
    Process.assertShape(nextInputs, nextOutputs);
    if (input.name !== undefined) this.props.name = input.name;
    if (input.processingCostAmount !== undefined)
      this.props.processingCostAmount = input.processingCostAmount;
    if (input.note !== undefined) this.props.note = input.note;
    this.props.inputs = nextInputs;
    this.props.outputs = nextOutputs;
    this.touch();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.touch();
  }
}
