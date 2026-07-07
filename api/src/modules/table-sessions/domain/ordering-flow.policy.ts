import { TableSessionChannel, TableSessionFlow, TableSessionState } from './enums';
import { OrderingFlowNotPermittedError } from './table-sessions.errors';

/**
 * The EFFECTIVE ordering policy for a (restaurant, branch): the restaurant
 * ceiling AND the branch config. Branch config can only ever NARROW the
 * restaurant ceiling — it can never enable what the restaurant disabled.
 */
export interface EffectiveOrderingPolicy {
  /** Restaurant ceiling: RestaurantSettings.enableCustomerOrdering. */
  restaurantOrderingEnabled: boolean;
  /** Restaurant ceiling: RestaurantSettings.enableQrMenu (QR menu is shown). */
  restaurantQrMenuEnabled: boolean;
  /** Branch: pay-before ordering enabled. */
  prepaymentEnabled: boolean;
  /** Branch: pay-at-end (open tab) ordering enabled. */
  payAtEndEnabled: boolean;
  /** Branch: QR-web channel may create sessions (always prepayment). */
  qrOrderingEnabled: boolean;
}

export interface SessionStart {
  flow: TableSessionFlow;
  initialState: TableSessionState;
}

/** Effective prepayment capability = restaurant-allows AND branch-enables. */
function prepaymentAllowed(p: EffectiveOrderingPolicy): boolean {
  return p.restaurantOrderingEnabled && p.prepaymentEnabled;
}

/** Effective pay-at-end capability = restaurant-allows AND branch-enables. */
function payAtEndAllowed(p: EffectiveOrderingPolicy): boolean {
  return p.restaurantOrderingEnabled && p.payAtEndEnabled;
}

/**
 * Effective QR-web capability. QR-web is ALWAYS prepayment: it requires the
 * restaurant to allow ordering AND to show the QR menu, and the branch to enable
 * both QR ordering and prepayment.
 */
function qrWebAllowed(p: EffectiveOrderingPolicy): boolean {
  return (
    p.restaurantOrderingEnabled &&
    p.restaurantQrMenuEnabled &&
    p.qrOrderingEnabled &&
    p.prepaymentEnabled
  );
}

/**
 * Decide the flow + initial state for a NEW session, or throw
 * OrderingFlowNotPermittedError if the channel/flow is not permitted.
 *
 *   - QR_WEB is capped to PREPAYMENT irrespective of any requested flow, and is
 *     born OPEN.
 *   - APP may use whichever of prepayment / pay-at-end is effectively enabled.
 *     PREPAYMENT is born OPEN; PAY_AT_END is born PENDING_CONFIRM (awaiting a
 *     waiter confirm). When both flows are enabled the caller must specify one.
 */
export function decideSessionStart(
  channel: TableSessionChannel,
  requestedFlow: TableSessionFlow | undefined,
  policy: EffectiveOrderingPolicy,
): SessionStart {
  if (channel === TableSessionChannel.QR_WEB) {
    if (!qrWebAllowed(policy)) {
      throw new OrderingFlowNotPermittedError('QR-web ordering is not enabled for this table.');
    }
    // QR_WEB is ALWAYS prepayment, born OPEN.
    return { flow: TableSessionFlow.PREPAYMENT, initialState: TableSessionState.OPEN };
  }

  // APP channel.
  if (!policy.restaurantOrderingEnabled) {
    throw new OrderingFlowNotPermittedError('Customer ordering is not enabled for this restaurant.');
  }

  const canPrepay = prepaymentAllowed(policy);
  const canPayAtEnd = payAtEndAllowed(policy);

  let flow = requestedFlow;
  if (flow === undefined) {
    // No explicit request: use the only enabled flow, else require a choice.
    if (canPrepay && !canPayAtEnd) flow = TableSessionFlow.PREPAYMENT;
    else if (canPayAtEnd && !canPrepay) flow = TableSessionFlow.PAY_AT_END;
    else if (!canPrepay && !canPayAtEnd) {
      throw new OrderingFlowNotPermittedError('No ordering flow is enabled for this table.');
    } else {
      throw new OrderingFlowNotPermittedError(
        'Both flows are enabled; a flow must be specified for the app channel.',
      );
    }
  }

  if (flow === TableSessionFlow.PREPAYMENT) {
    if (!canPrepay) {
      throw new OrderingFlowNotPermittedError('Prepayment ordering is not enabled for this table.');
    }
    return { flow, initialState: TableSessionState.OPEN };
  }

  // PAY_AT_END
  if (!canPayAtEnd) {
    throw new OrderingFlowNotPermittedError('Pay-at-end ordering is not enabled for this table.');
  }
  return { flow, initialState: TableSessionState.PENDING_CONFIRM };
}
