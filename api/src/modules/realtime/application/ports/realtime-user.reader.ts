export const REALTIME_USER_READER = Symbol('RealtimeUserReader');

/** Verifies the socket's user is still active (not blocked/deleted) at connect time. */
export interface RealtimeUserReader {
  isActiveUser(organizationId: string, userId: string): Promise<boolean>;
}
