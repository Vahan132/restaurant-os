import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Locale, parseLocale } from '../i18n/locale';

/** The custom consumer header carrying the guest's requested content locale. */
export const GUEST_LOCALE_HEADER = 'x-locale';

/**
 * LOCALE-1 — `@GuestLocale()` injects the guest's REQUESTED locale from the
 * `X-Locale` request header (`hy|ru|en`), or `null` when absent/invalid. It reads
 * the header the same way the storefront guard reads `X-Restaurant-Slug`
 * (`request.headers['x-...']`), and does NOT apply the restaurant-default fallback —
 * that belongs in the use-case, which has the `restaurantId` (so the effective
 * locale is computed once, where the default is known). LOCALE-2B consumes this to
 * resolve trilingual menu content per guest.
 */
export const GuestLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Locale | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const raw = request.headers[GUEST_LOCALE_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return parseLocale(value);
  },
);
