import { describe, it, expect } from "vitest";
import { getRelevantCurrencies, getAffectedSymbols } from "../currency-mapping.js";

describe("getRelevantCurrencies", () => {
  it("returns [base, quote] with weight 1 each for a standard fiat pair", () => {
    expect(getRelevantCurrencies("EURUSD")).toEqual([
      { currency: "EUR", weight: 1 },
      { currency: "USD", weight: 1 },
    ]);
  });

  it("handles USD as base currency", () => {
    expect(getRelevantCurrencies("USDJPY")).toEqual([
      { currency: "USD", weight: 1 },
      { currency: "JPY", weight: 1 },
    ]);
  });

  it("damps metals to USD with weight 0.7", () => {
    expect(getRelevantCurrencies("XAUUSD")).toEqual([{ currency: "USD", weight: 0.7 }]);
    expect(getRelevantCurrencies("XAGUSD")).toEqual([{ currency: "USD", weight: 0.7 }]);
  });

  it("damps USD-quoted crypto to weight 0.3", () => {
    expect(getRelevantCurrencies("BTCUSDT")).toEqual([{ currency: "USD", weight: 0.3 }]);
    expect(getRelevantCurrencies("ETHUSD")).toEqual([{ currency: "USD", weight: 0.3 }]);
  });

  it("returns an empty array for unrecognized symbols", () => {
    expect(getRelevantCurrencies("XYZABC")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(getRelevantCurrencies("eurusd")).toEqual([
      { currency: "EUR", weight: 1 },
      { currency: "USD", weight: 1 },
    ]);
  });
});

describe("getAffectedSymbols", () => {
  it("returns every major USD pair plus metals and BTC for USD", () => {
    const symbols = getAffectedSymbols("USD");
    expect(symbols).toContain("EURUSD");
    expect(symbols).toContain("USDJPY");
    expect(symbols).toContain("XAUUSD");
    expect(symbols).toContain("BTCUSDT");
  });

  it("returns the correct pair for a USD-quote currency", () => {
    expect(getAffectedSymbols("EUR")).toEqual(["EURUSD"]);
    expect(getAffectedSymbols("GBP")).toEqual(["GBPUSD"]);
  });

  it("returns the correct pair for a USD-base currency", () => {
    expect(getAffectedSymbols("JPY")).toEqual(["USDJPY"]);
    expect(getAffectedSymbols("CAD")).toEqual(["USDCAD"]);
  });

  it("returns an empty array for unknown currencies", () => {
    expect(getAffectedSymbols("XXX")).toEqual([]);
  });
});
