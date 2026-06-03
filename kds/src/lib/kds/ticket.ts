import type { KdsTicketResponse } from '@/api/generated/model/kdsTicketResponse';
import type { KdsTicketItemResponse } from '@/api/generated/model/kdsTicketItemResponse';
import { KdsTicketItemResponseStatus } from '@/api/generated/model/kdsTicketItemResponseStatus';
import type { Station } from '@/lib/realtime/client';

export type ItemStatus = KdsTicketItemResponseStatus;
export const ItemStatus = KdsTicketItemResponseStatus;

/** Default delay threshold (seconds) when an item has no prep estimate. */
export const DEFAULT_DELAY_SECONDS = 900;

/** A ticket tagged with the station whose endpoint produced it. */
export interface BoardTicket extends KdsTicketResponse {
  station: Station;
  /** Stable key across stations: a single order can route to several stations. */
  key: string;
}

export type AgeLevel = 'fresh' | 'aging' | 'delayed';

/** Live elapsed seconds for an item given the current clock. */
export function itemElapsedSeconds(item: KdsTicketItemResponse, nowMs: number): number {
  const sentMs = Date.parse(item.sentToKitchenAt);
  if (Number.isNaN(sentMs)) return item.elapsedSeconds;
  return Math.max(0, Math.round((nowMs - sentMs) / 1000));
}

/** Threshold (seconds) past which an item counts as delayed. */
export function itemThresholdSeconds(item: KdsTicketItemResponse): number {
  return item.prepTimeMinutes && item.prepTimeMinutes > 0
    ? item.prepTimeMinutes * 60
    : DEFAULT_DELAY_SECONDS;
}

/**
 * Delayed = backend flag OR live computation (elapsed > threshold). Honoring
 * both means the board highlights a delay the instant the clock crosses it,
 * without waiting for a refetch, while never under-reporting the server's view.
 */
export function isItemDelayed(item: KdsTicketItemResponse, nowMs: number): boolean {
  if (item.status === ItemStatus.READY) return false;
  if (item.delayed) return true;
  return itemElapsedSeconds(item, nowMs) > itemThresholdSeconds(item);
}

/** Color/escalation bucket for an item based on how close it is to its threshold. */
export function itemAgeLevel(item: KdsTicketItemResponse, nowMs: number): AgeLevel {
  if (isItemDelayed(item, nowMs)) return 'delayed';
  const ratio = itemElapsedSeconds(item, nowMs) / itemThresholdSeconds(item);
  return ratio >= 0.66 ? 'aging' : 'fresh';
}

/** Earliest sentToKitchenAt across a ticket's items = the ticket's age anchor. */
export function ticketSentAtMs(ticket: KdsTicketResponse): number {
  const times = ticket.items
    .map((i) => Date.parse(i.sentToKitchenAt))
    .filter((n) => !Number.isNaN(n));
  return times.length > 0 ? Math.min(...times) : Number.MAX_SAFE_INTEGER;
}

export function ticketElapsedSeconds(ticket: KdsTicketResponse, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - ticketSentAtMs(ticket)) / 1000));
}

export function isTicketAllReady(ticket: KdsTicketResponse): boolean {
  return ticket.items.length > 0 && ticket.items.every((i) => i.status === ItemStatus.READY);
}

export function isTicketDelayed(ticket: KdsTicketResponse, nowMs: number): boolean {
  return ticket.items.some((i) => isItemDelayed(i, nowMs));
}

export function ticketAgeLevel(ticket: KdsTicketResponse, nowMs: number): AgeLevel {
  if (isTicketAllReady(ticket)) return 'fresh';
  if (isTicketDelayed(ticket, nowMs)) return 'delayed';
  const worst = ticket.items
    .filter((i) => i.status !== ItemStatus.READY)
    .map((i) => itemAgeLevel(i, nowMs));
  return worst.includes('aging') ? 'aging' : 'fresh';
}
