const PREFIXES = [
  { prefix: "T", factor: 1e12 },
  { prefix: "G", factor: 1e9 },
  { prefix: "M", factor: 1e6 },
  { prefix: "k", factor: 1e3 },
  { prefix: "", factor: 1 },
  { prefix: "m", factor: 1e-3 },
  { prefix: "µ", factor: 1e-6 },
] as const;

const PREFIX_FACTORS: Record<string, number> = {
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  m: 1e-3,
  µ: 1e-6,
  u: 1e-6,
};

// Units that can take a metric prefix
const BASE_UNITS = ["W", "A", "V", "VA", "var", "Wh", "VAh", "Hz"];

export interface LcdValue {
  /** Digits for a seven-segment display; "." does not take a digit. */
  digits: string;
  unit: string;
}

const countDigits = (text: string) => text.replace(/[^0-9]/g, "").length;

const fitDigits = (value: number, maxDigits: number): string | undefined => {
  const integerDigits = Math.max(1, Math.floor(Math.log10(value)) + 1);
  const decimals = Math.max(0, maxDigits - integerDigits);
  let text = value.toFixed(decimals);
  // Rounding can carry into a new integer digit, like 9.9997 to 10.000
  if (countDigits(text) > maxDigits && decimals > 0) {
    text = value.toFixed(decimals - 1);
  }
  return countDigits(text) <= maxDigits ? text : undefined;
};

const splitUnit = (unit: string): { base: string; factor: number } | null => {
  if (BASE_UNITS.includes(unit)) {
    return { base: unit, factor: 1 };
  }
  const base = unit.slice(1);
  const factor = PREFIX_FACTORS[unit[0]];
  if (factor !== undefined && BASE_UNITS.includes(base)) {
    return { base, factor };
  }
  return null;
};

/**
 * Fit a measurement on a display of `size` digits, like a panel meter: switch
 * to the metric prefix (k, M, m, ...) that keeps the value within the digits,
 * and fill the remaining digits with decimals. A minus sign takes a digit.
 * Returns dashes when the value cannot be shown.
 */
export const formatLcdValue = (
  value: number,
  unit: string | undefined,
  size = 4
): LcdValue => {
  const dashes = { digits: "-".repeat(size), unit: unit ?? "" };
  if (!Number.isFinite(value)) {
    return dashes;
  }
  const negative = value < 0;
  const sign = negative ? "-" : "";
  const maxDigits = size - (negative ? 1 : 0);
  const split = unit ? splitUnit(unit) : null;

  if (!split) {
    // A unit without metric prefixes, such as %: show it as it is
    const text = fitDigits(Math.abs(value), maxDigits);
    return text === undefined
      ? dashes
      : { digits: `${sign}${text}`, unit: unit ?? "" };
  }

  const base = Math.abs(value) * split.factor;
  if (base === 0) {
    return { digits: (0).toFixed(maxDigits - 1), unit: split.base };
  }

  // Use the largest prefix that keeps an integer digit, like 1.234 kW rather
  // than 1234 W, and fall back to a larger one if the value does not fit
  let index = PREFIXES.findIndex(({ factor }) => base >= factor);
  if (index === -1) {
    index = PREFIXES.length - 1;
  }
  for (; index >= 0; index--) {
    const { prefix, factor } = PREFIXES[index];
    const text = fitDigits(base / factor, maxDigits);
    if (text !== undefined) {
      return { digits: `${sign}${text}`, unit: `${prefix}${split.base}` };
    }
  }
  return dashes;
};
