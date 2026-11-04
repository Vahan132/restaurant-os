"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlatformConsumerListingControllerSuppress } from "@/api/generated/endpoints/platform-consumer-listing/platform-consumer-listing";
import { getOrganizationsControllerGetQueryKey } from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import { getPlatformAdminControllerOrgRestaurantsQueryKey } from "@/api/generated/endpoints/platform/platform";
import { Spinner } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";

/**
 * Platform "kill switch" for a restaurant's consumer-app visibility.
 *
 * This is the landlord/platform override — distinct from the owner's own listing
 * toggle. When suppressed, every branch of the restaurant is hidden from the
 * consumer API regardless of the owner's settings; lifting it restores the
 * owner's listed/unlisted state.
 *
 * NOTE: the platform API exposes only the PUT kill-switch
 * (`PUT /platform-admin/consumer-listing/restaurants/:id/suppressed`). There is
 * no platform-scoped read of the current value, and the org→restaurants payload
 * (RestaurantWithHallsResponse) does not carry `consumerListingSuppressed`. We
 * accept an optional `initialSuppressed` for when a caller can supply it; when
 * unknown we render an indeterminate state and reflect the authoritative value
 * returned by the mutation once the admin sets it.
 */

const STRINGS = {
  heading: "Consumer App Visibility",
  subtitle: "Platform override — hides this restaurant from the consumer app regardless of the owner's listing.",
  labelSuppressed: "Suppressed",
  labelActive: "Visible",
  labelUnknown: "Not set",
  stateUnknownHint: "Current override is set by you here; state shown after you change it.",
  stateSuppressedHint: "Hidden from the consumer app. This overrides the owner's listing until lifted.",
  stateActiveHint: "Not overridden by platform. Visibility follows the owner's own listing toggle.",
  switchAria: "Toggle platform suppression of consumer-app visibility",
  confirmTitle: "Suppress consumer-app visibility?",
  confirmBody:
    "This is a platform override. It force-hides every branch of this restaurant from the consumer app, even while the owner has it listed. It persists until you lift it. The owner cannot undo it from their own listing controls.",
  confirmLabel: "Suppress listing",
  toastSuppressed: "Listing suppressed",
  toastSuppressedDesc: "The restaurant is now hidden from the consumer app.",
  toastLifted: "Suppression lifted",
  toastLiftedDesc: "Visibility now follows the owner's listing.",
  toastError: "Could not update visibility",
};

export function RestaurantVisibilityControl({
  restaurantId,
  orgId,
  initialSuppressed,
}: {
  restaurantId: string;
  orgId: string;
  /** Optional seed when a caller can provide current state; otherwise unknown. */
  initialSuppressed?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const suppress = usePlatformConsumerListingControllerSuppress();

  // null = unknown (no platform read available); true/false = known.
  const [suppressed, setSuppressed] = useState<boolean | null>(
    initialSuppressed ?? null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const pending = suppress.isPending;
  // When unknown, present the switch in the "off" position but allow enabling.
  const isOn = suppressed === true;

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: getOrganizationsControllerGetQueryKey(orgId),
    });
    void queryClient.invalidateQueries({
      queryKey: getPlatformAdminControllerOrgRestaurantsQueryKey(orgId),
    });
  }

  async function apply(value: boolean) {
    try {
      const res = await suppress.mutateAsync({
        restaurantId,
        data: { value },
      });
      // Reflect the authoritative state returned by the API.
      setSuppressed(res.consumerListingSuppressed);
      if (res.consumerListingSuppressed) {
        toast.success(STRINGS.toastSuppressed, STRINGS.toastSuppressedDesc);
      } else {
        toast.success(STRINGS.toastLifted, STRINGS.toastLiftedDesc);
      }
      invalidate();
    } catch (err) {
      toast.error(STRINGS.toastError, getErrorMessage(err));
    } finally {
      setConfirmOpen(false);
    }
  }

  function onToggle() {
    if (pending) return;
    if (isOn) {
      // Lifting needs no scary confirm.
      void apply(false);
    } else {
      // Enabling the override always confirms.
      setConfirmOpen(true);
    }
  }

  const stateLabel =
    suppressed === null
      ? STRINGS.labelUnknown
      : suppressed
        ? STRINGS.labelSuppressed
        : STRINGS.labelActive;

  const stateHint =
    suppressed === null
      ? STRINGS.stateUnknownHint
      : suppressed
        ? STRINGS.stateSuppressedHint
        : STRINGS.stateActiveHint;

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{STRINGS.heading}</p>
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
              (suppressed === null
                ? "bg-gray-100 text-gray-600"
                : suppressed
                  ? "bg-red-100 text-red-800"
                  : "bg-green-100 text-green-800")
            }
          >
            {stateLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{STRINGS.subtitle}</p>
        <p className="mt-0.5 text-xs text-gray-400">{stateHint}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={STRINGS.switchAria}
        disabled={pending}
        onClick={onToggle}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 " +
          (isOn ? "bg-red-600" : "bg-gray-300")
        }
      >
        <span
          className={
            "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform " +
            (isOn ? "translate-x-5" : "translate-x-0.5")
          }
        >
          {pending ? <Spinner className="h-3 w-3 text-gray-500" /> : null}
        </span>
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={STRINGS.confirmTitle}
        message={STRINGS.confirmBody}
        confirmLabel={STRINGS.confirmLabel}
        tone="danger"
        loading={pending}
        onConfirm={() => void apply(true)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
