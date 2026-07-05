/**
 * Timeframe definitions for CMD Trade Intelligence.
 * Mirrors artifacts/api-server/src/market-data/types.ts
 */

export type Timeframe = "1M" | "5M" | "15M" | "30M" | "1H" | "4H" | "1D" | "1W";

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1M":  "1 Minute",
  "5M":  "5 Minutes",
  "15M": "15 Minutes",
  "30M": "30 Minutes",
  "1H":  "1 Hour",
  "4H":  "4 Hours",
  "1D":  "Daily",
  "1W":  "Weekly",
};

export const ALL_TIMEFRAMES: Timeframe[] = ["1M","5M","15M","30M","1H","4H","1D","1W"];

/** Returns the number of minutes in a given timeframe. */
export function timeframeToMinutes(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    "1M": 1, "5M": 5, "15M": 15, "30M": 30,
    "1H": 60, "4H": 240, "1D": 1440, "1W": 10080,
  };
  return map[tf];
}
