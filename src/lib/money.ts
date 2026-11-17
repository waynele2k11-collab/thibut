/**
 * Universal BigInt Minor-Unit Money Formatter & Parser (R-506, INV-006).
 *
 * Uses strictly integer BigInt arithmetic + ES2023 `Intl.NumberFormat` string
 * numeric formatting — NEVER converts monetary values through JS `Number` floats.
 */

const MINOR_UNITS_PER_MAJOR: Readonly<Record<string, { divisor: bigint; decimals: number }>> = {
  USD: { divisor: 100n, decimals: 2 },
  EUR: { divisor: 100n, decimals: 2 },
  GBP: { divisor: 100n, decimals: 2 },
  CAD: { divisor: 100n, decimals: 2 },
  AUD: { divisor: 100n, decimals: 2 },
  JPY: { divisor: 1n, decimals: 0 },
  KRW: { divisor: 1n, decimals: 0 },
  VND: { divisor: 1n, decimals: 0 },
};

export function toBigIntMinor(value: bigint | string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid serialized minor-unit integer: "${value}"`);
  }
  return BigInt(trimmed);
}

/**
 * Formats minor units (e.g. `1499n` or `"1499"`) into a localized currency string
 * (e.g. `"$14.99"`) using pure BigInt string decomposition and `Intl.NumberFormat`.
 */
export function formatMinor(
  minor: bigint | string,
  currency = "USD",
  locale = "en-US"
): string {
  const normalizedCurrency = currency.trim().toUpperCase() || "USD";
  const amount = toBigIntMinor(minor);
  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;

  const scale = MINOR_UNITS_PER_MAJOR[normalizedCurrency] ?? {
    divisor: 100n,
    decimals: 2,
  };

  let decimalLiteral: string;
  if (scale.decimals === 0) {
    decimalLiteral = `${isNegative ? "-" : ""}${absAmount.toString()}`;
  } else {
    const whole = absAmount / scale.divisor;
    const fraction = (absAmount % scale.divisor)
      .toString()
      .padStart(scale.decimals, "0");
    decimalLiteral = `${isNegative ? "-" : ""}${whole.toString()}.${fraction}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: scale.decimals,
    maximumFractionDigits: scale.decimals,
  }).format(decimalLiteral as Intl.StringNumericLiteral);
}

/**
 * Converts minor units to a plain fixed-decimal string (e.g. `1499n` -> `"14.99"`)
 * for controlled form `<input>` default values without using float division.
 */
export function minorToDecimalInput(minor: bigint | string): string {
  const amount = toBigIntMinor(minor);
  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;
  const whole = absAmount / 100n;
  const cents = (absAmount % 100n).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${whole.toString()}.${cents}`;
}

/**
 * Parses a user-entered dollar string (e.g. `"36.69"`, `"$36.69"`, `"37"`) into
 * exact `BigInt` cents without floating-point rounding drift.
 */
export function parseDecimalDollarsToMinor(raw: string): bigint {
  const cleaned = raw.trim().replace(/^\$/, "").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new Error(`Invalid dollar amount: "${raw}"`);
  }
  const wholeDollars = BigInt(match[1] ?? "0");
  const centsStr = (match[2] ?? "").padEnd(2, "0");
  const cents = BigInt(centsStr);
  return wholeDollars * 100n + cents;
}
