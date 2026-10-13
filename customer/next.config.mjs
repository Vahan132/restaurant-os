import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Served behind one Tailscale host under /res/m (path-based, no subdomains).
// URLs look like /res/m/<slug>?qr=<qr>. Single source of truth shared with the
// client tenant resolver (src/lib/tenant.ts reads the same env) so the basePath
// used to strip the slug can never drift from what Next actually serves under.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/res/m';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  assetPrefix: basePath,
  reactStrictMode: true,
  images: {
    // Public menu images can come from any backend-configured host.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default withNextIntl(nextConfig);
