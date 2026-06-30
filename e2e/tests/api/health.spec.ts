import { test } from '@playwright/test';
import { expectApiHealth } from '../../helpers/health';

test.describe('API', () => {
  test('reports public health', async ({ request }) => {
    await expectApiHealth(request);
  });
});
