/**
 * Recognises a signing secret that was copied from `.env.example` (or a similar template)
 * without being replaced. Such a value is long enough to pass a length check but is public,
 * so it must count as "not set". Pure.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^replace[-_ ]?with/i,
  /^replace[-_ ]?me/i,
  /^change[-_ ]?me/i,
  /^your[-_ ]/i,
  /placeholder/i,
  /^example/i,
];

export function isPlaceholderSecret(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}
