import { describe, it, expect } from "vitest";
import { parseEventValue } from "../event-value.js";

describe("parseEventValue", () => {
  it("parses plain numbers", () => {
    expect(parseEventValue("3.2")).toBeCloseTo(3.2);
  });

  it("parses percentages", () => {
    expect(parseEventValue("3.2%")).toBeCloseTo(3.2);
  });

  it("parses K/M/B suffixes", () => {
    expect(parseEventValue("180K")).toBeCloseTo(180_000);
    expect(parseEventValue("2.5M")).toBeCloseTo(2_500_000);
    expect(parseEventValue("1.1B")).toBeCloseTo(1_100_000_000);
  });

  it("handles negative values", () => {
    expect(parseEventValue("-0.4%")).toBeCloseTo(-0.4);
  });

  it("returns null for null input", () => {
    expect(parseEventValue(null)).toBeNull();
  });

  it("returns null for unparsable input", () => {
    expect(parseEventValue("n/a")).toBeNull();
    expect(parseEventValue("")).toBeNull();
  });
});
