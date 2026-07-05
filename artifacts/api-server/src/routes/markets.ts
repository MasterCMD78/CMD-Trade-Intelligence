import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { marketDataService, Timeframe } from "../market-data/index.js";
import { z } from "zod/v4";

const router = Router();

const assetClassSchema = z.enum(["forex", "crypto", "indices", "commodities"]);
const timeframeSchema  = z.enum(["1M","5M","15M","30M","1H","4H","1D","1W"]);

/** Safely extract a single string value from Express query (handles string | string[] | ParsedQs). */
function queryString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0] as string;
  return undefined;
}

// ─── GET /api/markets/timeframes ─────────────────────────────────────────────
// MUST be registered before /:symbol to prevent "timeframes" matching as a symbol.
router.get("/timeframes", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ timeframes: marketDataService.getTimeframes() });
});

// ─── GET /api/markets ────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const assetClass = queryString(req.query["assetClass"]);
  const activeStr  = queryString(req.query["active"]);

  if (assetClass && !assetClassSchema.safeParse(assetClass).success) {
    res.status(400).json({ error: "Invalid assetClass. Must be: forex, crypto, indices, or commodities" });
    return;
  }

  // Reject values that are neither "true" nor "false" — don't silently degrade.
  if (activeStr !== undefined && activeStr !== "true" && activeStr !== "false") {
    res.status(400).json({ error: "Invalid active value. Must be 'true' or 'false'" });
    return;
  }

  const active = activeStr === "true" ? true : activeStr === "false" ? false : undefined;

  try {
    const symbols = await marketDataService.getSymbols({ assetClass, active });
    res.json(symbols);
  } catch {
    res.status(500).json({ error: "Failed to fetch symbols" });
  }
});

// ─── GET /api/markets/:symbol ────────────────────────────────────────────────
router.get("/:symbol", requireAuth, async (req: Request, res: Response) => {
  const symbol = req.params["symbol"] as string;

  try {
    const [symbolInfo, quote] = await Promise.all([
      marketDataService.getSymbol(symbol),
      marketDataService.getPrice(symbol),
    ]);

    res.json({
      // Core MarketQuote fields (match OpenAPI schema)
      symbol:       quote.symbol,
      bid:          quote.bid,
      ask:          quote.ask,
      mid:          quote.mid,
      spread:       quote.spread,
      change24h:    quote.change24h,
      changePct24h: quote.changePct24h,
      high24h:      quote.high24h,
      low24h:       quote.low24h,
      volume24h:    quote.volume24h,
      timestamp:    quote.timestamp.toISOString(),
      source:       quote.source,
      // Extended symbol metadata (also in OpenAPI schema)
      assetClass:   symbolInfo.assetClass,
      displayName:  symbolInfo.displayName,
      precision:    symbolInfo.precision,
      tradingHours: symbolInfo.tradingHours,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("not found")) {
      res.status(404).json({ error: `Symbol not found: ${symbol}` });
    } else {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  }
});

// ─── GET /api/markets/:symbol/candles/:timeframe ──────────────────────────────
router.get("/:symbol/candles/:timeframe", requireAuth, async (req: Request, res: Response) => {
  const symbol    = req.params["symbol"]    as string;
  const timeframe = req.params["timeframe"] as string;

  const tfParsed = timeframeSchema.safeParse(timeframe);
  if (!tfParsed.success) {
    res.status(400).json({ error: "Invalid timeframe. Must be one of: 1M, 5M, 15M, 30M, 1H, 4H, 1D, 1W" });
    return;
  }

  const tf = Object.values(Timeframe).find((v) => v === tfParsed.data) as Timeframe;

  try {
    const candles = await marketDataService.getCandles(symbol, tf, 100);
    res.json(
      candles.map((c) => ({
        symbol:    c.symbol,
        timeframe: c.timeframe,
        open:      c.open,
        high:      c.high,
        low:       c.low,
        close:     c.close,
        volume:    c.volume,
        timestamp: c.timestamp.toISOString(),
        closed:    c.closed,
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("not found")) {
      res.status(404).json({ error: `Symbol not found: ${symbol}` });
    } else {
      res.status(500).json({ error: "Failed to fetch candles" });
    }
  }
});

export default router;
