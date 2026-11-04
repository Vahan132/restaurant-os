/**
 * Bookable-slot derivation (CX-3) — PURE domain rules. The public availability
 * surface (CX-1) only exposes raw busy-windows; it does NOT derive bookable
 * times. This is the single place that turns opening windows + existing
 * reservations + seating capacity into the discrete, selectable slots a consumer
 * can request. It owns the rules; the consumer context only orchestrates (resolves
 * the branch's opening hours and timezone) and renders the result.
 *
 * Everything is expressed in absolute epoch-ms so the domain stays timezone-free:
 * the caller resolves the branch-local opening hours to absolute [startMs, endMs)
 * windows before calling in.
 *
 * Rules applied:
 *  - GRID: candidate starts step every `slotIntervalMin` from each open window's
 *    start; a slot is only offered when a full turn (`turnTimeMin`) fits before the
 *    window closes (last start = close − turn).
 *  - LEAD TIME: slots starting before `now + leadTimeMin` are not offered.
 *  - CAPACITY: a slot is `available` when the party can be seated — there is a
 *    table large enough (`partySize ≤ maxTableSeats`) AND the seats already
 *    committed by reservations overlapping the slot's turn window leave room
 *    (`usedSeats + partySize ≤ totalSeats`). A slot that fails the capacity test is
 *    still returned, flagged `available: false`, so the app can show it disabled.
 */

export interface BookingOpenWindow {
  /** Absolute epoch-ms the branch opens for this stretch. */
  startMs: number;
  /** Absolute epoch-ms the branch stops seating for this stretch. */
  endMs: number;
}

export interface ExistingReservationLoad {
  startMs: number;
  durationMin: number;
  guestCount: number;
}

export interface SlotCapacity {
  /** Sum of seatCapacity across active tables in the branch. */
  totalSeats: number;
  /** Largest single table — a party bigger than this cannot be seated at all. */
  maxTableSeats: number;
}

export interface SlotDerivationConfig {
  slotIntervalMin: number;
  turnTimeMin: number;
  leadTimeMin: number;
}

export interface DerivedSlot {
  /** Absolute epoch-ms of the slot start. */
  startMs: number;
  available: boolean;
}

export interface DeriveBookableSlotsInput {
  openWindows: BookingOpenWindow[];
  existing: ExistingReservationLoad[];
  capacity: SlotCapacity;
  partySize: number;
  config: SlotDerivationConfig;
  nowMs: number;
}

const MIN_MS = 60_000;

/** Do [aStart, aEnd) and [bStart, bEnd) overlap? */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Derive the ordered, de-duplicated list of bookable slots for one day. Returns an
 * empty list when the branch is closed (no open windows) or no table can seat the
 * party for any slot.
 */
export function deriveBookableSlots(input: DeriveBookableSlotsInput): DerivedSlot[] {
  const { openWindows, existing, capacity, partySize, config, nowMs } = input;
  const intervalMs = config.slotIntervalMin * MIN_MS;
  const turnMs = config.turnTimeMin * MIN_MS;
  const earliestStartMs = nowMs + config.leadTimeMin * MIN_MS;

  if (intervalMs <= 0 || turnMs <= 0 || !Number.isInteger(partySize) || partySize < 1) {
    return [];
  }

  const canSeatParty = partySize <= capacity.maxTableSeats;

  const seen = new Set<number>();
  const slots: DerivedSlot[] = [];

  for (const window of openWindows) {
    const lastStart = window.endMs - turnMs;
    for (let start = window.startMs; start <= lastStart; start += intervalMs) {
      if (start < earliestStartMs || seen.has(start)) {
        continue;
      }
      seen.add(start);

      const slotEnd = start + turnMs;
      let usedSeats = 0;
      for (const r of existing) {
        const resEnd = r.startMs + r.durationMin * MIN_MS;
        if (overlaps(start, slotEnd, r.startMs, resEnd)) {
          usedSeats += r.guestCount;
        }
      }

      const available = canSeatParty && usedSeats + partySize <= capacity.totalSeats;
      slots.push({ startMs: start, available });
    }
  }

  return slots.sort((a, b) => a.startMs - b.startMs);
}
