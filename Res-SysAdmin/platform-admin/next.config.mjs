/** @type {import('next').NextConfig} */
const basePath = "/res/platform-admin";

const nextConfig = {
  reactStrictMode: true,
  basePath,
  // Exposed to the client for hard window.location redirects (401 -> /login).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
