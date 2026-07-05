/**
 * Shared constants across the CMD Trade Intelligence platform.
 */

// ─── Supported Trading Pairs ───────────────────────────────────────────────

export const FOREX_MAJORS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF",
  "AUDUSD", "USDCAD", "NZDUSD",
] as const;

export const CRYPTO_MAJORS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT",
  "ADAUSDT", "DOTUSDT", "MATICUSDT",
] as const;

// ─── Timeframes ────────────────────────────────────────────────────────────

export const TIMEFRAMES = ["1M", "5M", "15M", "30M", "1H", "4H", "1D", "1W"] as const;

export const TIMEFRAME_LABELS: Record<string, string> = {
  "1M":  "1 Minute",
  "5M":  "5 Minutes",
  "15M": "15 Minutes",
  "30M": "30 Minutes",
  "1H":  "1 Hour",
  "4H":  "4 Hours",
  "1D":  "Daily",
  "1W":  "Weekly",
};

// ─── Risk Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_RISK_PARAMS = {
  maxDrawdownPct: 5.0,
  maxPositionSizePct: 2.0,
  riskPerTradePct: 1.0,
} as const;

// ─── Plan Limits ───────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    signalsPerDay: 3,
    marketsWatched: 5,
    historyDays: 7,
  },
  pro: {
    signalsPerDay: 50,
    marketsWatched: 50,
    historyDays: 90,
  },
  enterprise: {
    signalsPerDay: Infinity,
    marketsWatched: Infinity,
    historyDays: Infinity,
  },
} as const;

// ─── API ───────────────────────────────────────────────────────────────────

export const API_BASE_PATH = "/api";
export const API_VERSION = "0.1.0";
