import { Router, Response } from "express";
import { db } from "@workspace/db";
import { signalsTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { z } from "zod/v4";

const router = Router();

const querySchema = z.object({
  status: z.enum(["active", "closed", "pending"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/signals
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { status, limit } = parsed.data;

  const conditions: SQL[] = [];
  if (status) {
    conditions.push(eq(signalsTable.status, status));
  }

  const signals = await db
    .select()
    .from(signalsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .orderBy(signalsTable.createdAt);

  res.json(
    signals.map((s) => ({
      id: s.id,
      symbol: s.symbol,
      direction: s.direction,
      status: s.status,
      timeframe: s.timeframe,
      notes: s.notes,
      createdAt: s.createdAt,
    }))
  );
});

export default router;
