import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

// Served behind one Tailscale host under /res/* (path-based, no subdomains).
const basePath = "/res";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  assetPrefix: basePath,
  // Expose the basePath to client code so non-React hard redirects (e.g. the
  // 401 -> /login bounce in the axios mutator) can prefix it correctly.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Allow .mdx files to be treated as pages/routes alongside ts/tsx.
  pageExtensions: ["ts", "tsx", "mdx"],
  reactStrictMode: true,
};

const withMDX = createMDX({
  options: {
    // rehype-slug adds id="" to headings so the on-page TOC can link to them
    // and anchor-scrolling works. (Autolinking headings is intentionally
    // omitted: it would route generated <a> tags through the MDX link styles.)
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  },
});

// next-intl plugin points at the per-request i18n config (messages + locale).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(withMDX(nextConfig));
