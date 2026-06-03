/** Tables domain enums (string values mirror the Prisma enums). Pure domain. */

export enum ZoneStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  CLEANING = 'CLEANING',
  DISABLED = 'DISABLED',
}

/** Source of a status change — staff (MANUAL) or an automatic flow (SYSTEM). */
export type StatusChangeSource = 'MANUAL' | 'SYSTEM';
