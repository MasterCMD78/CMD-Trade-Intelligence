/**
 * Analysis Routes
 *
 * GET /api/analysis/:symbol            — run analysis on the symbol (default timeframe: 1H)
 * GET /api/analysis/:symbol?timeframe= — use the given timeframe
 *
 * The engine fetches 200 candles for the primary TF so EMA-200 has enough
 * warmup data, and also fetches candles for all 8 timeframes concurrently
 * for the Multi-Timeframe engine (Phase 3H). Individual TF fetch failures
 * are silently skipped rather than failing the entire request.
 */

import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { marketDataService, Timeframe } from "../market-data/index.js";
import { runAnalysis, parseTimeframe } from "../analysis/engine.js";
import { newsService } from "../analysis/news/index.js";
import type { MTFKey } from "../analysis/multi-timeframe/types.js";
import type { MarketCandle } from "../market-data/types.js";
import { z } from "zod/v4";

const router = Router();

const timeframeSchema = z.enum(["1M", "5M", "15M", "30M", "1H", "4H", "1D", "1W"]);

// Same shape as the WS channel symbol validation: uppercase alphanumeric, 3-12 chars.
const symbolSchema = z.string().regex(/^[A-Z0-9]{3,12}$/);

function queryString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0] as string;
  return undefined;
}

/**
 * Multi-TF candle configuration (Phase 3H).
 * Maps each MTFKey to its Timeframe enum value and candle limit. Higher
 * timeframes fetch fewer candles; lower timeframes fetch more for enough
 * swing-point history.
 */
const MTF_CONFIG: Array<{ key: MTFKey; timeframe: Timeframe; limit: number }> = [
  { key: "weekly", timeframe: Timeframe.W1,  limit: 100 },
  { key: "daily",  timeframe: Timeframe.D1,  limit: 200 },
  { key: "h4",     timeframe: Timeframe.H4,  limit: 200 },
  { key: "h1",     timeframe: Timeframe.H1,  limit: 200 },
  { key: "m30",    timeframe: Timeframe.M30, limit: 200 },
  { key: "m15",    timeframe: Timeframe.M15, limit: 200 },
  { key: "m5",     timeframe: Timeframe.M5,  limit: 200 },
  { key: "m1",     timeframe: Timeframe.M1,  limit: 100 },
];

/**
 * Fetch candles for all 8 timeframes concurrently.
 * Per-TF errors are silently swallowed — the MTF engine gracefully skips
 * timeframes without data.
 */
async function fetchAllTimeframeCandles(
  symbol: string,
): Promise<Partial<Record<MTFKey, MarketCandle[]>>> {
  const results = await Promise.allSettled(
    MTF_CONFIG.map(({ key, timeframe, limit }) =>
      marketDataService.getCandles(symbol, timeframe, limit).then((candles) => ({ key, candles })),
    ),
  );

  const out: Partial<Record<MTFKey, MarketCandle[]>> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      out[r.value.key] = r.value.candles;
    }
  }
  return out;
}

// GET /api/analysis/:symbol
router.get("/:symbol", requireAuth, async (req: AuthenticatedRequest & Request, res: Response) => {
  const symbol = (req.params["symbol"] as string).toUpperCase();
  const tfRaw  = queryString(req.query["timeframe"]) ?? "1H";

  const symbolParsed = symbolSchema.safeParse(symbol);
  if (!symbolParsed.success) {
    res.status(400).json({ error: "Invalid symbol. Must be 3-12 uppercase alphanumeric characters." });
    return;
  }

  const tfParsed = timeframeSchema.safeParse(tfRaw);
  if (!tfParsed.success) {
    res.status(400).json({ error: "Invalid timeframe. Must be one of: 1M, 5M, 15M, 30M, 1H, 4H, 1D, 1W" });
    return;
  }

  const timeframe = parseTimeframe(tfParsed.data);

  try {
    const now = new Date();
    // Fetch primary TF candles, current price, all MTF candles, and relevant
    // news events (Phase 5) concurrently. A news-fetch failure is non-fatal —
    // analysis still runs with an empty event set (neutral news read).
    const [candles, price, allTimeframeCandles, newsEvents] = await Promise.all([
      marketDataService.getCandles(symbol, timeframe, 200),
      marketDataService.getPrice(symbol),
      fetchAllTimeframeCandles(symbol),
      newsService.getRelevantEvents(symbol, now).catch(() => []),
    ]);

    if (candles.length < 30) {
      res.status(422).json({ error: "Not enough candle data to run analysis (need at least 30 candles)." });
      return;
    }

    const result = runAnalysis({
      symbol,
      timeframe: tfParsed.data,
      candles,
      currentBid: price.bid,
      currentAsk: price.ask,
      allTimeframeCandles,
      newsEvents,
      now,
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.toLowerCase().includes("not found")) {
      res.status(404).json({ error: `Symbol not found: ${symbol}` });
    } else {
      res.status(500).json({ error: "Analysis failed", detail: msg });
    }
  }
});

export default router;
