/**
 * Analysis Routes
 *
 * GET /api/analysis/:symbol            — run analysis on the symbol (default timeframe: 1H)
 * GET /api/analysis/:symbol?timeframe= — use the given timeframe
 *
 * The engine fetches 200 candles so that EMA-200 has enough warmup data.
 */

import { Router, Request, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { marketDataService } from "../market-data/index.js";
import { runAnalysis, parseTimeframe } from "../analysis/engine.js";
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
    // Fetch 200 candles for adequate EMA-200 + warmup history.
    const [candles, price] = await Promise.all([
      marketDataService.getCandles(symbol, timeframe, 200),
      marketDataService.getPrice(symbol),
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
