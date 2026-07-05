import { Router, Response } from "express";
import { db } from "@workspace/db";
import { signalsTable, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { marketDataService } from "../market-data/index.js";

const router = Router();

// GET /api/dashboard/summary
router.get("/summary", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  const [[signalCount], symbols] = await Promise.all([
    db.select({ count: count() }).from(signalsTable),
    marketDataService.getSymbols({ active: true }),
  ]);

  res.json({
    totalSignals:  signalCount?.count ?? 0,
    activeMarkets: symbols.length,
    accountStatus: "active",
    planName:      user?.plan ?? "free",
    marketStatus:  `${marketDataService.providerName} — ${symbols.length} symbols available`,
  });
});

export default router;
