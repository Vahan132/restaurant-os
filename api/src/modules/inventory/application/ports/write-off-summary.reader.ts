import { WriteOffReason } from '../../domain/enums';

export const WRITE_OFF_SUMMARY_READER = Symbol('WriteOffSummaryReader');

export interface WriteOffSummaryRow {
  reason: WriteOffReason;
  lineCount: number;
  totalCostAmount: number;
}

export interface WriteOffSummary {
  byReason: WriteOffSummaryRow[];
  overallLineCount: number;
  overallTotalCostAmount: number;
}

export interface WriteOffSummaryFilter {
  restaurantId: string;
  branchId: string;
  from?: Date;
  to?: Date;
}

/**
 * Waste summary grouped by reason (§5). Excludes voided write-offs;
 * branch-scoped within a tenant (restaurantId + branchId).
 */
export interface WriteOffSummaryReader {
  summary(filter: WriteOffSummaryFilter): Promise<WriteOffSummary>;
}
