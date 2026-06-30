import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ConsumerPrincipal } from './consumer-auth.guard';

/**
 * Injects the authenticated consumer's `customerAccountId` (set by ConsumerAuthGuard).
 * Usage: `@CurrentConsumer() customerAccountId: string`.
 */
export const CurrentConsumer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ consumerUser?: ConsumerPrincipal }>();
    return request.consumerUser?.sub ?? '';
  },
);
