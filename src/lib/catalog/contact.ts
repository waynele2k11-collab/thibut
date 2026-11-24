export const ORDER_CONTACT_ADDRESS = "support@thibut.com";

/** Pre-filled email link. The subject carries only chosen options, never customer data. */
export function orderMailto(subject: string): string {
  return `mailto:${ORDER_CONTACT_ADDRESS}?subject=${encodeURIComponent(subject)}`;
}
