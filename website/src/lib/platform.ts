/** URLs of the sibling platform apps + the customer storefront, from env. */
export const platformUrls = {
  admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? "",
  pos: process.env.NEXT_PUBLIC_POS_URL ?? "",
  kds: process.env.NEXT_PUBLIC_KDS_URL ?? "",
};

/**
 * Build a customer storefront URL from NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE,
 * substituting {slug} and {qr}. Works for both the path-based query template
 * ("https://host/res/m/{slug}?qr={qr}") and the legacy subdomain/path form
 * ("http://{slug}.localhost:3004/{qr}"). With no qr, a dangling empty "?qr="
 * (or "&qr=") and any trailing slash left by {qr} are trimmed for a clean
 * preview.
 */
export function buildCustomerUrl(slug: string, qr = ""): string {
  const template =
    process.env.NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE ??
    "https://msi.tail8514ca.ts.net/res/m/{slug}?qr={qr}";
  let url = template.replace("{slug}", slug).replace("{qr}", qr);
  if (!qr) {
    url = url.replace(/[?&]qr=$/i, "").replace(/\/+$/, "");
  }
  return url;
}
