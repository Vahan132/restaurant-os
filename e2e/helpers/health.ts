import { request as playwrightRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import { ENV, apiHealthUrlFor, socketPollingUrl, socketPollingUrlFor } from '../config/env';
import type { E2ESession } from './session';

const DEFAULT_TIMEOUT = 10_000;

async function bodySnippet(response: { text: () => Promise<string> }): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '<body unavailable>';
  }
}

async function withFreshRequestContext<T>(run: (request: APIRequestContext) => Promise<T>): Promise<T> {
  const context = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    return await run(context);
  } finally {
    await context.dispose();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function expectFrontendStatus(
  label: string,
  url: string,
  method: 'HEAD' | 'GET',
  response: APIResponse,
): Promise<void> {
  if (response.status() >= 500) {
    throw new Error(
      `[preflight] ${label} at ${url} returned HTTP ${response.status()} for ${method}: ` +
        (await bodySnippet(response)),
    );
  }
}

export async function expectReachable(
  request: APIRequestContext,
  label: string,
  url: string,
  options: { timeout?: number; requireOk?: boolean; maxRedirects?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const requireOk = options.requireOk ?? true;

  let response;
  try {
    response = await request.get(url, {
      timeout,
      maxRedirects: options.maxRedirects,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    });
  } catch (error) {
    throw new Error(`[preflight] ${label} is unreachable at ${url}: ${errorMessage(error)}`);
  }

  if (requireOk ? !response.ok() : response.status() >= 500) {
    throw new Error(
      `[preflight] ${label} at ${url} returned HTTP ${response.status()}: ` +
        (await bodySnippet(response)),
    );
  }
}

export async function expectFrontendReachable(
  _request: APIRequestContext,
  label: string,
  url: string,
  options: { timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  await withFreshRequestContext(async (request) => {
    let headError: string | undefined;

    try {
      const headResponse = await request.fetch(url, {
        method: 'HEAD',
        maxRedirects: 0,
        timeout,
        failOnStatusCode: false,
      });

      if (headResponse.status() !== 405) {
        await expectFrontendStatus(label, url, 'HEAD', headResponse);
        return;
      }
    } catch (error) {
      headError = errorMessage(error);
    }

    try {
      const getResponse = await request.fetch(url, {
        method: 'GET',
        maxRedirects: 0,
        timeout,
        failOnStatusCode: false,
      });
      await expectFrontendStatus(label, url, 'GET', getResponse);
    } catch (error) {
      const getError = errorMessage(error);
      throw new Error(
        `[preflight] ${label} is unreachable at ${url}. ` +
          `HEAD ${headError ? `failed: ${headError}` : 'returned HTTP 405'}; ` +
          `GET fallback failed: ${getError}`,
      );
    }
  });
}

export async function expectApiHealth(
  request: APIRequestContext,
  options: { label?: string; apiBaseUrl?: string } = {},
): Promise<void> {
  const label = options.label ?? 'API health';
  const url = apiHealthUrlFor(options.apiBaseUrl ?? ENV.apiBaseUrl);
  let response;
  try {
    response = await request.get(url, {
      timeout: DEFAULT_TIMEOUT,
      failOnStatusCode: false,
      ignoreHTTPSErrors: true,
    });
  } catch (error) {
    throw new Error(`[preflight] ${label} is unreachable at ${url}: ${errorMessage(error)}`);
  }

  if (!response.ok()) {
    throw new Error(
      `[preflight] ${label} at ${url} returned HTTP ${response.status()}: ` +
        (await bodySnippet(response)),
    );
  }

  const json = (await response.json().catch(() => null)) as { status?: string } | null;
  if (json?.status !== 'ok') {
    throw new Error(`[preflight] ${label} at ${url} did not return { status: "ok" }.`);
  }
}

export async function expectSocketReachable(
  request: APIRequestContext,
  options: { label?: string; socketBaseUrl?: string } = {},
): Promise<void> {
  await expectReachable(
    request,
    options.label ?? 'Socket.IO polling endpoint',
    options.socketBaseUrl ? socketPollingUrlFor(options.socketBaseUrl) : socketPollingUrl(),
  );
}

export async function expectProxyHealth(request: APIRequestContext): Promise<void> {
  await expectApiHealth(request, {
    label: 'API health through admin proxy',
    apiBaseUrl: ENV.adminApiBaseUrl,
  });
  await expectApiHealth(request, {
    label: 'API health through display proxy',
    apiBaseUrl: ENV.displayApiBaseUrl,
  });
  await expectSocketReachable(request, {
    label: 'Socket.IO through admin proxy',
    socketBaseUrl: ENV.adminSocketBaseUrl,
  });
  await expectSocketReachable(request, {
    label: 'Socket.IO through display proxy',
    socketBaseUrl: ENV.displaySocketBaseUrl,
  });
}

export async function preflightAllFlow(
  request: APIRequestContext,
  session: Pick<E2ESession, 'customerUrl'>,
): Promise<void> {
  await expectApiHealth(request);
  await expectFrontendReachable(request, 'website on admin PC', ENV.websiteBaseUrl);
  await expectFrontendReachable(request, 'admin on admin PC', ENV.adminBaseUrl);
  await expectFrontendReachable(request, 'POS on admin PC', ENV.posBaseUrl);
  await expectFrontendReachable(request, 'KDS on display PC', ENV.kdsBaseUrl);
  await expectFrontendReachable(request, 'customer QR menu on display PC', session.customerUrl);
  await expectProxyHealth(request);
}
