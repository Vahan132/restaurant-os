import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Served behind one Tailscale host under /res/m (path-based, no subdomains).
  // URLs look like /res/m/<slug>?qr=<qr>.
  basePath: '/res/m',
  assetPrefix: '/res/m',
  reactStrictMode: true,
  images: {
    // Public menu images can come from any backend-configured host.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default withNextIntl(nextConfig);
