import createNextIntlPlugin from 'next-intl/plugin';

// Points next-intl at our request config (locale + messages resolution).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Served behind one Tailscale host under /res/admin (path-based, no subdomains).
const basePath = '/res/admin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  assetPrefix: basePath,
  // Expose the basePath to client code so non-React hard redirects (e.g. the
  // 401 -> /login bounce in the axios mutator) can prefix it correctly.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
