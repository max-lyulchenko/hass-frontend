import { describe, expect, it } from "vitest";
import {
  currentAboveMax,
  formatLcdValue,
  toBaseUnit,
  voltageLevel,
} from "../../../../src/panels/lovelace/common/format-lcd-value";

describe("toBaseUnit", () => {
  it("converts prefixed units", () => {
    expect(toBaseUnit(1.5, "kW")).toEqual({ value: 1500, unit: "W" });
    expect(toBaseUnit(250, "mA")).toEqual({ value: 0.25, unit: "A" });
    expect(toBaseUnit(230, "V")).toEqual({ value: 230, unit: "V" });
  });

  it("is undefined for other units and values", () => {
    expect(toBaseUnit(50, "%")).toBeUndefined();
    expect(toBaseUnit(NaN, "W")).toBeUndefined();
    expect(toBaseUnit(5, undefined)).toBeUndefined();
  });
});

describe("currentAboveMax", () => {
  it("compares with the max in amperes", () => {
    expect(currentAboveMax(16.1, "A", 16)).toBe(true);
    expect(currentAboveMax(16, "A", 16)).toBe(false);
    expect(currentAboveMax(-17, "A", 16)).toBe(true);
    expect(currentAboveMax(500, "mA", 0.4)).toBe(true);
    expect(currentAboveMax(300, "mA", 0.4)).toBe(false);
  });

  it("is false without a max or a current", () => {
    expect(currentAboveMax(100, "A", undefined)).toBe(false);
    expect(currentAboveMax(100, "W", 16)).toBe(false);
    expect(currentAboveMax(NaN, "A", 16)).toBe(false);
  });
});

describe("voltageLevel", () => {
  it("uses 210 V and 250 V by default", () => {
    expect(voltageLevel(230, "V")).toBeUndefined();
    expect(voltageLevel(210, "V")).toBeUndefined();
    expect(voltageLevel(250, "V")).toBeUndefined();
    expect(voltageLevel(209.9, "V")).toBe("low");
    expect(voltageLevel(250.1, "V")).toBe("high");
  });

  it("uses the configured limits", () => {
    expect(voltageLevel(115, "V", 110, 125)).toBeUndefined();
    expect(voltageLevel(105, "V", 110, 125)).toBe("low");
    expect(voltageLevel(130, "V", 110, 125)).toBe("high");
  });

  it("converts prefixed units", () => {
    expect(voltageLevel(0.26, "kV")).toBe("high");
    expect(voltageLevel(230_000, "mV")).toBeUndefined();
  });

  it("ignores values that are not voltages", () => {
    expect(voltageLevel(NaN, "V")).toBeUndefined();
    expect(voltageLevel(500, "W")).toBeUndefined();
    expect(voltageLevel(500, undefined)).toBeUndefined();
  });
});

const lcd = (value: number, unit: string | undefined, precision = 0) =>
  formatLcdValue(value, unit, 4, precision);

describe("formatLcdValue", () => {
  it("shows no decimals by default", () => {
    expect(lcd(797.86, "W")).toEqual({ digits: "798", unit: "W" });
    expect(lcd(232.19, "V")).toEqual({ digits: "232", unit: "V" });
    expect(lcd(12.34, "A")).toEqual({ digits: "12", unit: "A" });
    expect(lcd(1234, "W")).toEqual({ digits: "1234", unit: "W" });
  });

  it("shows two decimals for a single integer digit", () => {
    expect(lcd(3.07, "A")).toEqual({ digits: "3.07", unit: "A" });
    expect(lcd(3.444, "A", 1)).toEqual({ digits: "3.44", unit: "A" });
    expect(lcd(0.005, "A")).toEqual({ digits: "5.00", unit: "mA" });
  });

  it("shows the configured decimals", () => {
    expect(lcd(12.34, "A", 1)).toEqual({ digits: "12.3", unit: "A" });
    expect(lcd(12.34, "A", 2)).toEqual({ digits: "12.34", unit: "A" });
    expect(lcd(232.19, "V", 1)).toEqual({ digits: "232.2", unit: "V" });
  });

  it("shows fewer decimals when they do not fit", () => {
    expect(lcd(797.86, "W", 2)).toEqual({ digits: "797.9", unit: "W" });
    expect(lcd(1234, "W", 2)).toEqual({ digits: "1234", unit: "W" });
  });

  it("switches to a larger prefix when the value does not fit", () => {
    expect(lcd(12345, "W")).toEqual({ digits: "12", unit: "kW" });
    expect(lcd(12345, "W", 2)).toEqual({ digits: "12.35", unit: "kW" });
    expect(lcd(2_500_000, "W")).toEqual({ digits: "2500", unit: "kW" });
    expect(lcd(25_000_000, "W", 1)).toEqual({ digits: "25.0", unit: "MW" });
    expect(lcd(9999.7, "W")).toEqual({ digits: "10", unit: "kW" });
  });

  it("switches to a smaller prefix for values below one", () => {
    expect(lcd(0.0345, "A")).toEqual({ digits: "35", unit: "mA" });
    expect(lcd(0.0345, "A", 2)).toEqual({ digits: "34.50", unit: "mA" });
    expect(lcd(0.5, "V")).toEqual({ digits: "500", unit: "mV" });
  });

  it("carries rounding into a new digit", () => {
    expect(lcd(9.996, "A")).toEqual({ digits: "10", unit: "A" });
    expect(lcd(9.996, "A", 2)).toEqual({ digits: "10.00", unit: "A" });
    expect(lcd(999.97, "W", 1)).toEqual({ digits: "1000", unit: "W" });
  });

  it("converts prefixed units first", () => {
    expect(lcd(0.8, "kW")).toEqual({ digits: "800", unit: "W" });
    expect(lcd(15000, "kW")).toEqual({ digits: "15", unit: "MW" });
    expect(lcd(1500, "mA")).toEqual({ digits: "1.50", unit: "A" });
  });

  it("gives a minus sign a digit", () => {
    expect(lcd(-797.86, "W")).toEqual({ digits: "-798", unit: "W" });
    expect(lcd(-3.07, "A")).toEqual({ digits: "-3.07", unit: "A" });
    expect(lcd(-1500, "W")).toEqual({ digits: "-1.50", unit: "kW" });
  });

  it("shows zero without decimals", () => {
    expect(lcd(0, "W")).toEqual({ digits: "0", unit: "W" });
    expect(lcd(0, "W", 2)).toEqual({ digits: "0", unit: "W" });
    expect(lcd(0, "kW")).toEqual({ digits: "0", unit: "W" });
    expect(lcd(-0, "A")).toEqual({ digits: "0", unit: "A" });
    expect(lcd(0, "%")).toEqual({ digits: "0", unit: "%" });
  });

  it("does not add a prefix to other units", () => {
    expect(lcd(45.56, "%", 1)).toEqual({ digits: "45.6", unit: "%" });
    expect(lcd(5.5, "%")).toEqual({ digits: "5.50", unit: "%" });
    expect(lcd(123456, "%")).toEqual({ digits: "----", unit: "%" });
  });

  it("shows dashes for values that are not numbers", () => {
    expect(lcd(NaN, "W")).toEqual({ digits: "----", unit: "W" });
  });
});
