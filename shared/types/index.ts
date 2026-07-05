/**
 * Shared TypeScript types used across the CMD Trade Intelligence platform.
 * These types are the source of truth for cross-module contracts.
 */

// ─── Authentication ────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type UserPlan = "free" | "pro" | "enterprise";

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
}

// ─── Market Data ───────────────────────────────────────────────────────────

export type AssetClass = "forex" | "crypto" | "indices" | "commodities";
export type Timeframe = "1M" | "5M" | "15M" | "30M" | "1H" | "4H" | "1D" | "1W";
export type SignalDirection = "buy" | "sell" | "neutral";
export type SignalStatus = "pending" | "active" | "closed";

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

// ─── Signals ───────────────────────────────────────────────────────────────

export interface TradeSignal {
  id: number;
  symbol: string;
  direction: SignalDirection;
  status: SignalStatus;
  timeframe: Timeframe;
  notes: string | null;
  createdAt: Date;
}

// ─── Risk ──────────────────────────────────────────────────────────────────

export interface RiskParameters {
  maxDrawdownPct: number;
  maxPositionSizePct: number;
  riskPerTradePct: number;
}

// ─── API Responses ─────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  statusCode?: number;
}
