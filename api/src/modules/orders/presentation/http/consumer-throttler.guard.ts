import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ORDER-4: rate-limits the app ordering surface PER CONSUMER, not per IP. The
 * authenticated consumer's `sub` (set by ConsumerAuthGuard, which must be bound
 * BEFORE this guard) is the tracker key, so a shared NAT/carrier IP doesn't pool
 * unrelated consumers into one bucket. Falls back to the IP only if the principal
 * is somehow absent (it never is behind ConsumerAuthGuard).
 */
@Injectable()
export class ConsumerThrottlerGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const sub: string | undefined = req?.consumerUser?.sub;
    const ip: string | undefined = req?.ip;
    return sub ? `consumer:${sub}` : `ip:${ip ?? 'unknown'}`;
  }
}
