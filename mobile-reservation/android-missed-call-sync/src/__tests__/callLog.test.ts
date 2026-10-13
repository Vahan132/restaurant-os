import { isMissed, mapEntry, selectNewMissed, toPayload, RawCallLogEntry } from '../calllog/callLog';

const e = (over: Partial<RawCallLogEntry>): RawCallLogEntry => ({
  phoneNumber: '+15551234567',
  name: '',
  timestamp: 1_700_000_000_000,
  type: 'MISSED',
  ...over,
});

describe('isMissed', () => {
  it('matches MISSED by string type (case-insensitive)', () => {
    expect(isMissed(e({ type: 'MISSED' }))).toBe(true);
    expect(isMissed(e({ type: 'missed' }))).toBe(true);
  });
  it('rejects non-missed types', () => {
    expect(isMissed(e({ type: 'INCOMING' }))).toBe(false);
    expect(isMissed(e({ type: 'OUTGOING' }))).toBe(false);
  });
  it('falls back to rawType 3 when type missing', () => {
    expect(isMissed(e({ type: null, rawType: 3 }))).toBe(true);
    expect(isMissed(e({ type: null, rawType: 1 }))).toBe(false);
  });
});

describe('mapEntry', () => {
  it('maps epoch (number) to ISO and includes name when present', () => {
    const m = mapEntry(e({ timestamp: 1_700_000_000_000, name: 'Jane' }));
    expect(m).not.toBeNull();
    expect(m!.occurredAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(m!.callerName).toBe('Jane');
    expect(m!.epochMs).toBe(1_700_000_000_000);
  });

  it('parses string epochs from OEM logs', () => {
    const m = mapEntry(e({ timestamp: '1700000000000' }));
    expect(m!.epochMs).toBe(1_700_000_000_000);
  });

  it('omits callerName when blank', () => {
    const m = mapEntry(e({ name: '   ' }));
    expect(m!.callerName).toBeUndefined();
  });

  it('returns null for empty number or bad timestamp', () => {
    expect(mapEntry(e({ phoneNumber: '' }))).toBeNull();
    expect(mapEntry(e({ timestamp: 0 }))).toBeNull();
    expect(mapEntry(e({ timestamp: 'not-a-number' }))).toBeNull();
  });
});

describe('selectNewMissed', () => {
  const entries: RawCallLogEntry[] = [
    e({ type: 'INCOMING', timestamp: 5000 }),
    e({ type: 'MISSED', timestamp: 3000, phoneNumber: '111' }),
    e({ type: 'MISSED', timestamp: 1000, phoneNumber: '222' }), // before cursor
    e({ type: 'MISSED', timestamp: 4000, phoneNumber: '333' }),
    e({ type: 'OUTGOING', timestamp: 9000 }),
  ];

  it('keeps only MISSED strictly after the cursor, oldest-first', () => {
    const out = selectNewMissed(entries, 2000);
    expect(out.map((c) => c.epochMs)).toEqual([3000, 4000]);
    expect(out.map((c) => c.phoneNumber)).toEqual(['111', '333']);
  });

  it('returns empty when nothing is newer', () => {
    expect(selectNewMissed(entries, 999999)).toEqual([]);
  });

  it('excludes the exact cursor value (strictly greater)', () => {
    const out = selectNewMissed(entries, 3000);
    expect(out.map((c) => c.epochMs)).toEqual([4000]);
  });
});

describe('toPayload', () => {
  it('strips local bookkeeping fields', () => {
    const reported = mapEntry(e({ name: 'Bob', timestamp: 7000 }))!;
    expect(toPayload(reported)).toEqual({
      phoneNumber: '+15551234567',
      occurredAt: new Date(7000).toISOString(),
      callerName: 'Bob',
    });
  });
});
