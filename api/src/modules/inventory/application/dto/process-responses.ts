import { ApiProperty } from '@nestjs/swagger';
import { Process, ProcessInput, ProcessOutput } from '../../domain/entities/process';
import { ProcessRun } from '../../domain/entities/process-run';
import { ProcessRunDetail } from '../ports/process-run-detail.reader';
import { RelatedItems } from '../ports/process-graph.reader';
import { InventoryItemResponse, StockLayerResponse, StockMovementResponse } from './responses';

export class ProcessInputResponse {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQty!: number;

  static from(i: ProcessInput): ProcessInputResponse {
    return { id: i.id, itemId: i.itemId, baseQty: i.baseQty };
  }
}

export class ProcessOutputResponse {
  @ApiProperty() id!: string;
  @ApiProperty() itemId!: string;
  @ApiProperty() baseQty!: number;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ nullable: true, type: Number }) costShareBps!: number | null;

  static from(o: ProcessOutput): ProcessOutputResponse {
    return {
      id: o.id,
      itemId: o.itemId,
      baseQty: o.baseQty,
      isPrimary: o.isPrimary,
      costShareBps: o.costShareBps,
    };
  }
}

export class ProcessResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() name!: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() processingCost_amount!: number;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) status!: string;
  @ApiProperty({ type: [ProcessInputResponse] }) inputs!: ProcessInputResponse[];
  @ApiProperty({ type: [ProcessOutputResponse] }) outputs!: ProcessOutputResponse[];

  static from(p: Process): ProcessResponse {
    return {
      id: p.id,
      restaurantId: p.restaurantId,
      branchId: p.branchId,
      name: p.name,
      processingCost_amount: p.processingCostAmount,
      note: p.note,
      status: p.status,
      inputs: p.inputs.map(ProcessInputResponse.from),
      outputs: p.outputs.map(ProcessOutputResponse.from),
    };
  }
}

export class ProcessRunResponse {
  @ApiProperty() id!: string;
  @ApiProperty() restaurantId!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() processId!: string;
  @ApiProperty() multiplier!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() inputCost_amount!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() processingCost_amount!: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  @ApiProperty() totalCost_amount!: number;
  @ApiProperty() wentNegative!: boolean;
  @ApiProperty() runAt!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
  @ApiProperty() createdByUserId!: string;

  static from(r: ProcessRun): ProcessRunResponse {
    return {
      id: r.id,
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      processId: r.processId,
      multiplier: r.multiplier,
      inputCost_amount: r.inputCostAmount,
      processingCost_amount: r.processingCostAmount,
      totalCost_amount: r.totalCostAmount,
      wentNegative: r.wentNegative,
      runAt: r.runAt.toISOString(),
      note: r.note,
      createdByUserId: r.createdByUserId,
    };
  }
}

export class ProcessRunDetailResponse extends ProcessRunResponse {
  @ApiProperty({ type: [StockMovementResponse], description: 'PROCESS_OUT inputs consumed.' })
  consumed!: StockMovementResponse[];
  @ApiProperty({ type: [StockMovementResponse], description: 'PROCESS_IN outputs produced.' })
  produced!: StockMovementResponse[];
  @ApiProperty({ type: [StockLayerResponse], description: 'Layers created by the run.' })
  producedLayers!: StockLayerResponse[];

  static fromDetail(run: ProcessRun, detail: ProcessRunDetail): ProcessRunDetailResponse {
    return {
      ...ProcessRunResponse.from(run),
      consumed: detail.consumed.map(StockMovementResponse.from),
      produced: detail.produced.map(StockMovementResponse.from),
      producedLayers: detail.producedLayers.map(StockLayerResponse.from),
    };
  }
}

export class RelatedItemsResponse {
  @ApiProperty({ type: [InventoryItemResponse] }) rawSources!: InventoryItemResponse[];
  @ApiProperty({ type: [InventoryItemResponse] }) processedOutputs!: InventoryItemResponse[];

  static from(related: RelatedItems): RelatedItemsResponse {
    return {
      rawSources: related.rawSources.map(InventoryItemResponse.from),
      processedOutputs: related.processedOutputs.map(InventoryItemResponse.from),
    };
  }
}
