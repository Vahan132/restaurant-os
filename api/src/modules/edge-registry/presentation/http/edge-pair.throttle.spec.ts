import 'reflect-metadata';
import { EDGE_PAIR_THROTTLE } from './edge-pair.controller';

/**
 * EDGE-PAIR-3: guardrail on the public pairing route's rate limit. A behavioural
 * (HTTP) throttle test needs an app harness the repo doesn't have; this pins the
 * intended limit so it can't be loosened by accident.
 */
describe('EDGE-PAIR-3 pairing route throttle', () => {
  it('caps POST /edge/pair at 5 attempts per minute (per IP)', () => {
    expect(EDGE_PAIR_THROTTLE.default.limit).toBe(5);
    expect(EDGE_PAIR_THROTTLE.default.ttl).toBe(60_000);
  });
});
