import { describe, expect, it } from "vitest";
import { formatLcdValue } from "../../../../src/panels/lovelace/common/format-lcd-value";

describe("formatLcdValue", () => {
  it("fills the four digits with decimals", () => {
    expect(formatLcdValue(797.86, "W")).toEqual({ digits: "797.9", unit: "W" });
    expect(formatLcdValue(232.19, "V")).toEqual({ digits: "232.2", unit: "V" });
    expect(formatLcdValue(3.44, "A")).toEqual({ digits: "3.440", unit: "A" });
    expect(formatLcdValue(999.97, "W")).toEqual({ digits: "1000", unit: "W" });
  });

  it("prefers the larger prefix", () => {
    expect(formatLcdValue(1234, "W")).toEqual({ digits: "1.234", unit: "kW" });
  });

  it("switches to a larger prefix when the value does not fit", () => {
    expect(formatLcdValue(12345, "W")).toEqual({ digits: "12.35", unit: "kW" });
    expect(formatLcdValue(2_500_000, "W")).toEqual({
      digits: "2.500",
      unit: "MW",
    });
    expect(formatLcdValue(9999.7, "W")).toEqual({
      digits: "10.00",
      unit: "kW",
    });
  });

  it("switches to a smaller prefix for values below one", () => {
    expect(formatLcdValue(0.0345, "A")).toEqual({
      digits: "34.50",
      unit: "mA",
    });
    expect(formatLcdValue(0.5, "V")).toEqual({ digits: "500.0", unit: "mV" });
  });

  it("converts prefixed units first", () => {
    expect(formatLcdValue(0.8, "kW")).toEqual({ digits: "800.0", unit: "W" });
    expect(formatLcdValue(15000, "kW")).toEqual({
      digits: "15.00",
      unit: "MW",
    });
    expect(formatLcdValue(1500, "mA")).toEqual({ digits: "1.500", unit: "A" });
  });

  it("gives a minus sign a digit", () => {
    expect(formatLcdValue(-797.86, "W")).toEqual({
      digits: "-798",
      unit: "W",
    });
    expect(formatLcdValue(-1500, "W")).toEqual({
      digits: "-1.50",
      unit: "kW",
    });
  });

  it("shows zero", () => {
    expect(formatLcdValue(0, "W")).toEqual({ digits: "0.000", unit: "W" });
  });

  it("does not add a prefix to other units", () => {
    expect(formatLcdValue(45.5, "%")).toEqual({ digits: "45.50", unit: "%" });
    expect(formatLcdValue(123456, "%")).toEqual({ digits: "----", unit: "%" });
  });

  it("shows dashes for values that are not numbers", () => {
    expect(formatLcdValue(NaN, "W")).toEqual({ digits: "----", unit: "W" });
  });
});
