import { EffectiveOrderingPolicy } from '../../domain/ordering-flow.policy';

export const ORDERING_POLICY_READER = Symbol('OrderingPolicyReader');

/**
 * Reads the EFFECTIVE ordering policy for a (restaurant, branch): the restaurant
 * ceiling (RestaurantSettings.enableCustomerOrdering / enableQrMenu) combined
 * with the branch OrderingConfig. Returns null if the branch does not exist.
 */
export interface OrderingPolicyReader {
  get(restaurantId: string, branchId: string): Promise<EffectiveOrderingPolicy | null>;
}
