import { describe, expect, it } from "vitest";
import { formatLcdValue } from "../../../../src/panels/lovelace/common/format-lcd-value";

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

  it("shows zero with two decimals", () => {
    expect(lcd(0, "W")).toEqual({ digits: "0.00", unit: "W" });
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
