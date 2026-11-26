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

export const LCD_MAX_PRECISION = 2;

/** Decimals of an LCD display: 0 (the default) to 2. */
export const lcdPrecision = (precision: number | undefined): number =>
  Math.min(LCD_MAX_PRECISION, Math.max(0, Math.round(precision ?? 0)));

const countDigits = (text: string) => text.replace(/[^0-9]/g, "").length;

// A value with a single integer digit, like 3.07 A, shows this many decimals
// whatever the precision, as one digit alone says too little
const SINGLE_DIGIT_DECIMALS = 2;

const fitDigits = (
  value: number,
  maxDigits: number,
  precision: number
): string | undefined => {
  let integerDigits =
    value < 1 ? 1 : Math.max(1, Math.floor(Math.log10(value)) + 1);
  // Rounding can carry into a new integer digit, like 9.996 to 10.00, so
  // check the rounded text and count one more digit when it does
  for (;;) {
    if (integerDigits > maxDigits) {
      return undefined;
    }
    const wanted =
      integerDigits === 1
        ? Math.max(precision, SINGLE_DIGIT_DECIMALS)
        : precision;
    const decimals = Math.min(wanted, maxDigits - integerDigits);
    const text = value.toFixed(decimals);
    if (Number(text) < 10 ** integerDigits) {
      return countDigits(text) <= maxDigits ? text : undefined;
    }
    integerDigits++;
  }
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
 * A value in its base unit (kW → W, mA → A). Undefined when it is not a
 * number or its unit has no metric prefixes.
 */
export const toBaseUnit = (
  value: number,
  unit: string | undefined
): { value: number; unit: string } | undefined => {
  const split = unit ? splitUnit(unit) : null;
  return split && Number.isFinite(value)
    ? { value: value * split.factor, unit: split.base }
    : undefined;
};

export const DEFAULT_VOLTAGE_LOW = 210;
export const DEFAULT_VOLTAGE_HIGH = 250;

export type VoltageLevel = "low" | "high";

/**
 * Whether a voltage is below `low` or above `high` volts. Prefixed units
 * (kV, mV) are converted first. Returns undefined when it is in range, or
 * when it is not a voltage.
 */
export const voltageLevel = (
  value: number,
  unit: string | undefined,
  low = DEFAULT_VOLTAGE_LOW,
  high = DEFAULT_VOLTAGE_HIGH
): VoltageLevel | undefined => {
  const split = unit ? splitUnit(unit) : null;
  if (!Number.isFinite(value) || split?.base !== "V") {
    return undefined;
  }
  const volts = value * split.factor;
  if (volts < low) {
    return "low";
  }
  if (volts > high) {
    return "high";
  }
  return undefined;
};

/**
 * Whether a current is above `max` amperes. Prefixed units (mA, kA) are
 * converted first. False without a max, or when it is not a current.
 */
export const currentAboveMax = (
  value: number,
  unit: string | undefined,
  max: number | undefined
): boolean => {
  const split = unit ? splitUnit(unit) : null;
  return (
    max !== undefined &&
    Number.isFinite(value) &&
    split?.base === "A" &&
    Math.abs(value * split.factor) > max
  );
};

const BASE_INDEX = PREFIXES.findIndex(({ factor }) => factor === 1);

/**
 * Fit a measurement on a display of `size` digits, like a panel meter. The
 * value is shown in its base unit (W, A, V, ...) with `precision` decimals.
 * It switches to a larger prefix (k, M, ...) when it does not fit the digits,
 * and to a smaller one (m, µ) when it is below 1. Fewer decimals are shown
 * when they do not fit. A minus sign takes a digit. Zero is shown as "0".
 * Returns dashes when the value cannot be shown.
 */
export const formatLcdValue = (
  value: number,
  unit: string | undefined,
  size = 4,
  precision = 0
): LcdValue => {
  const dashes = { digits: "-".repeat(size), unit: unit ?? "" };
  if (!Number.isFinite(value)) {
    return dashes;
  }
  if (value === 0) {
    // Zero needs no decimals, whatever the precision
    return { digits: "0", unit: (unit && splitUnit(unit)?.base) ?? unit ?? "" };
  }
  const negative = value < 0;
  const sign = negative ? "-" : "";
  const maxDigits = size - (negative ? 1 : 0);
  const split = unit ? splitUnit(unit) : null;

  if (!split) {
    // A unit without metric prefixes, such as %: show it as it is
    const text = fitDigits(Math.abs(value), maxDigits, precision);
    return text === undefined
      ? dashes
      : { digits: `${sign}${text}`, unit: unit ?? "" };
  }

  const base = Math.abs(value) * split.factor;

  // Start at the base unit, or at the first smaller prefix that gives an
  // integer digit for values below 1, and move to larger prefixes until the
  // value fits
  let index = BASE_INDEX;
  while (base < PREFIXES[index].factor && index < PREFIXES.length - 1) {
    index++;
  }
  for (; index >= 0; index--) {
    const { prefix, factor } = PREFIXES[index];
    const text = fitDigits(base / factor, maxDigits, precision);
    if (text !== undefined) {
      return { digits: `${sign}${text}`, unit: `${prefix}${split.base}` };
    }
  }
  return dashes;
};
