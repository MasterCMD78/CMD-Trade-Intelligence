import { Router, Response } from "express";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";

const router = Router();

// GET /api/risk/summary
router.get("/summary", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  // Placeholder defaults — risk engine configuration comes in a future phase
  res.json({
    status: "Risk engine not configured",
    maxDrawdownPct: 5.0,
    maxPositionSizePct: 2.0,
    riskPerTradePct: 1.0,
  });
});

export default router;
