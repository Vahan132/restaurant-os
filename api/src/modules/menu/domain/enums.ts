/** Menu domain enums (string values mirror the Prisma enums). Pure domain. */

export enum MenuStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ItemAvailability {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum PreparationStation {
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  DESSERT = 'DESSERT',
  OTHER = 'OTHER',
}

export enum ModifierSelectionType {
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
}
