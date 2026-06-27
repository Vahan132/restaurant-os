'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  usePublicReservationsControllerInfo,
  usePublicStorefrontControllerBranches,
  usePublicStorefrontControllerRestaurant,
} from '@/api/generated/public/public';
import type {
  PublicBranchResponse,
  PublicReservationsInfoResponse,
  PublicRestaurantResponse,
} from '@/api/generated/model';
import { isNotFound, type ApiError } from '@/api/mutator';
import { resolveBranchSlug, resolveSlug, withBranchParam } from '@/lib/tenant';

import BrandingHeader from '../BrandingHeader';
import LocationPicker from '../LocationPicker';
import { GenericError, MenuUnavailable } from '../StateScreens';
import ReservationConfirmation from './ReservationConfirmation';
import ReservationForm from './ReservationForm';
import ReservationsDisabled from './ReservationsDisabled';

/** What the form hands back on success (the confirmation response omits party size). */
export interface SubmittedReservation {
  reservedAt: string;
  guestCount: number;
}

/**
 * Public, unauthenticated reservation booking page (request-to-book), now
 * BRANCH-AWARE (BR-10). With no table context the customer first picks a
 * location, then we load that branch's reservations info
 * (GET /public/:slug/branch/:branchSlug/reservations/info), gate on the
 * branch's `enableReservations`, and submit to the branch endpoint. The chosen
 * location is reflected in the form and the confirmation.
 */
export default function ReservePage() {
  const t = useTranslations('reserve');
  const tLoc = useTranslations('location');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const restaurantSlug = resolveSlug();

  const [submitted, setSubmitted] = useState<SubmittedReservation | null>(null);
  // Set when the backend rejects with RESERVATIONS_DISABLED after info said ok.
  const [forcedDisabled, setForcedDisabled] = useState(false);
  const [pickedBranch, setPickedBranch] = useState<string | null>(null);
  const [branchReady, setBranchReady] = useState(false);
  useEffect(() => {
    setPickedBranch(resolveBranchSlug());
    setBranchReady(true);
  }, []);

  const restaurantQ = usePublicStorefrontControllerRestaurant<
    PublicRestaurantResponse,
    ApiError
  >();
  const branchesQ = usePublicStorefrontControllerBranches<PublicBranchResponse[], ApiError>(
    restaurantSlug,
    { query: { enabled: !!restaurantSlug } },
  );

  const pickedBranchSummary = useMemo(
    () => branchesQ.data?.find((b) => b.slug === pickedBranch) ?? null,
    [branchesQ.data, pickedBranch],
  );
  const branchSlug = pickedBranchSummary?.slug ?? null;

  const infoQ = usePublicReservationsControllerInfo<
    PublicReservationsInfoResponse,
    ApiError
  >(restaurantSlug, branchSlug ?? '', {
    query: { enabled: !!restaurantSlug && !!branchSlug },
  });

  function chooseBranch(slug: string) {
    setSubmitted(null);
    setForcedDisabled(false);
    setPickedBranch(slug);
    router.replace(withBranchParam(pathname, slug));
  }

  function changeLocation() {
    setSubmitted(null);
    setForcedDisabled(false);
    setPickedBranch(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('branch');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  // --- Top-level states -----------------------------------------------------
  if (isNotFound(restaurantQ.error) || isNotFound(branchesQ.error)) return <MenuUnavailable />;
  if (restaurantQ.isError || branchesQ.isError) return <GenericError />;
  if (!branchReady || restaurantQ.isLoading || !restaurantQ.data || branchesQ.isLoading || !branchesQ.data) {
    return <ReserveSkeleton />;
  }

  const restaurant = restaurantQ.data;

  // No location chosen yet (or a stale ?branch= that no longer exists): pick one.
  if (!pickedBranchSummary) {
    return (
      <div className="min-h-screen pb-12">
        <BrandingHeader name={restaurant.name} logoUrl={restaurant.logoUrl} />
        <LocationPicker
          branches={branchesQ.data}
          title={tLoc('bookTitle')}
          subtitle={tLoc('bookSubtitle')}
          onSelect={chooseBranch}
        />
      </div>
    );
  }

  if (isNotFound(infoQ.error)) return <MenuUnavailable />;
  if (infoQ.isError) return <GenericError />;
  if (infoQ.isLoading || !infoQ.data) return <ReserveSkeleton />;

  const info = infoQ.data;
  const locationName = pickedBranchSummary.name;

  return (
    <div className="min-h-screen pb-12">
      <BrandingHeader name={restaurant.name} logoUrl={restaurant.logoUrl} locationName={locationName} />

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <h1 className="text-xl font-semibold text-gray-900">{t('heading')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subheadingAt', { location: locationName })}</p>
        <button
          type="button"
          onClick={changeLocation}
          className="mt-1 text-xs font-medium text-brand-accent underline-offset-2 hover:underline"
        >
          {tLoc('change')}
        </button>
      </div>

      {submitted ? (
        <ReservationConfirmation
          reservedAt={submitted.reservedAt}
          guestCount={submitted.guestCount}
          timezone={info.timezone}
          locationName={locationName}
          locale={locale}
          onMakeAnother={() => setSubmitted(null)}
        />
      ) : !info.enableReservations || forcedDisabled ? (
        <ReservationsDisabled phone={null} />
      ) : (
        <ReservationForm
          info={info}
          restaurantSlug={restaurantSlug}
          branchSlug={pickedBranchSummary.slug}
          locale={locale}
          onSubmitted={setSubmitted}
          onDisabled={() => setForcedDisabled(true)}
        />
      )}
    </div>
  );
}

function ReserveSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-6" aria-hidden>
      <div className="mb-6 h-7 w-48 rounded bg-gray-200" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-11 w-full rounded-lg bg-gray-200" />
          </div>
        ))}
        <div className="h-12 w-full rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}
