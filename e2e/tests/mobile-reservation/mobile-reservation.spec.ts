import { test } from '@playwright/test';

test.describe('mobile reservation', () => {
  test('browser E2E placeholder', async () => {
    test.skip(
      true,
      'mobile-reservation/android-missed-call-sync is an Expo Android app, not a deployed browser route.',
    );
  });
});
