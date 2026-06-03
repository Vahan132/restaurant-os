import type { TableResponseStatus } from '@/api/generated/model';

/** Status -> tile background + legend swatch classes. */
export const STATUS_TILE: Record<TableResponseStatus, string> = {
  AVAILABLE: 'bg-status-available',
  OCCUPIED: 'bg-status-occupied',
  RESERVED: 'bg-status-reserved',
  CLEANING: 'bg-status-cleaning',
  DISABLED: 'bg-status-disabled',
};

export const STATUS_ORDER: TableResponseStatus[] = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'CLEANING',
  'DISABLED',
];
