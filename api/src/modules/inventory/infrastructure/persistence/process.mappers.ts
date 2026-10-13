import {
  Process as PrismaProcess,
  ProcessInput as PrismaProcessInput,
  ProcessOutput as PrismaProcessOutput,
  ProcessRun as PrismaProcessRun,
} from '@prisma/client';
import { Process, ProcessInput, ProcessOutput } from '../../domain/entities/process';
import { ProcessRun } from '../../domain/entities/process-run';
import { ProcessStatus } from '../../domain/enums';

type ProcessRow = PrismaProcess & {
  inputs: PrismaProcessInput[];
  outputs: PrismaProcessOutput[];
};

export class ProcessMapper {
  static toDomain(r: ProcessRow): Process {
    return Process.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      name: r.name,
      processingCostAmount: r.processingCostAmount,
      note: r.note,
      status: r.status as ProcessStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      inputs: r.inputs.map(
        (i) =>
          new ProcessInput({
            id: i.id,
            branchId: i.branchId,
            itemId: i.itemId,
            baseQty: i.baseQty,
          }),
      ),
      outputs: r.outputs.map(
        (o) =>
          new ProcessOutput({
            id: o.id,
            branchId: o.branchId,
            itemId: o.itemId,
            baseQty: o.baseQty,
            isPrimary: o.isPrimary,
            costShareBps: o.costShareBps,
          }),
      ),
    });
  }

  static toHeaderCreate(p: Process) {
    return {
      id: p.id,
      restaurantId: p.restaurantId,
      branchId: p.branchId,
      name: p.name,
      processingCostAmount: p.processingCostAmount,
      note: p.note,
      status: p.status as ProcessStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }

  static toHeaderUpdate(p: Process) {
    return {
      name: p.name,
      processingCostAmount: p.processingCostAmount,
      note: p.note,
      status: p.status as ProcessStatus,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }

  static toInputRows(p: Process) {
    return p.inputs.map((i) => ({
      id: i.id,
      processId: p.id,
      branchId: i.branchId,
      itemId: i.itemId,
      baseQty: i.baseQty,
    }));
  }

  static toOutputRows(p: Process) {
    return p.outputs.map((o) => ({
      id: o.id,
      processId: p.id,
      branchId: o.branchId,
      itemId: o.itemId,
      baseQty: o.baseQty,
      isPrimary: o.isPrimary,
      costShareBps: o.costShareBps,
    }));
  }
}

export class ProcessRunMapper {
  static toDomain(r: PrismaProcessRun): ProcessRun {
    return ProcessRun.reconstitute(r.id, {
      restaurantId: r.restaurantId,
      branchId: r.branchId,
      processId: r.processId,
      multiplier: r.multiplier,
      inputCostAmount: r.inputCostAmount,
      processingCostAmount: r.processingCostAmount,
      totalCostAmount: r.totalCostAmount,
      wentNegative: r.wentNegative,
      runAt: r.runAt,
      note: r.note,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
