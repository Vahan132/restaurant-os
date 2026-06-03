export const STATION_TICKETS_READER = Symbol('StationTicketsReader');

export interface StationTicketModifierData {
  name: string;
  priceDelta: number;
}

export interface StationTicketItemData {
  orderItemId: string;
  name: string;
  quantity: number;
  modifiers: StationTicketModifierData[];
  note: string | null;
  status: string;
  sentToKitchenAt: Date;
  prepTimeMinutes: number | null;
}

export interface StationTicketData {
  orderId: string;
  orderNumber: number;
  tableName: string | null;
  waiterName: string | null;
  orderNote: string | null;
  items: StationTicketItemData[];
}

/**
 * Read model for KDS station tickets — denormalized active items routed to a
 * station (status SENT/PREPARING/READY). Impl in infrastructure (tenant-scoped).
 */
export interface StationTicketsReader {
  getActiveTickets(restaurantId: string, station: string): Promise<StationTicketData[]>;
}
