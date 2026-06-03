import { TableResponseStatus } from '@/api/generated/model';
import type { TableStatus } from '@/lib/tables/transitions';

/** Accessible, distinct color treatment per table status. */
export const STATUS_STYLE: Record<
  TableStatus,
  { tile: string; swatch: string; text: string }
> = {
  [TableResponseStatus.AVAILABLE]: {
    tile: 'border-green-300 bg-green-50 hover:bg-green-100',
    swatch: 'bg-green-500',
    text: 'text-green-900',
  },
  [TableResponseStatus.OCCUPIED]: {
    tile: 'border-red-300 bg-red-50 hover:bg-red-100',
    swatch: 'bg-red-500',
    text: 'text-red-900',
  },
  [TableResponseStatus.RESERVED]: {
    tile: 'border-amber-300 bg-amber-50 hover:bg-amber-100',
    swatch: 'bg-amber-500',
    text: 'text-amber-900',
  },
  [TableResponseStatus.CLEANING]: {
    tile: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
    swatch: 'bg-blue-500',
    text: 'text-blue-900',
  },
  [TableResponseStatus.DISABLED]: {
    tile: 'border-gray-300 bg-gray-100 hover:bg-gray-200',
    swatch: 'bg-gray-400',
    text: 'text-gray-600',
  },
};
