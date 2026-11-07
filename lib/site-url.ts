export function getSiteUrl(requestUrl: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return siteUrl ? new URL(siteUrl).origin : new URL(requestUrl).origin;
}
