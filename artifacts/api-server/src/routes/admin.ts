import { Router, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, signalsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../middlewares/auth.js";
import { z } from "zod/v4";

const router = Router();

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/admin/users
router.get("/users", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const [users, [{ total }]] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        plan: usersTable.plan,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .limit(limit)
      .offset(offset)
      .orderBy(usersTable.createdAt),
    db.select({ total: count() }).from(usersTable),
  ]);

  res.json({ users, total: Number(total), page, limit });
});

// GET /api/admin/stats
router.get("/stats", requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  const [
    [{ totalUsers }],
    [{ totalSignals }],
    freePlan,
    proPlan,
    enterprisePlan,
  ] = await Promise.all([
    db.select({ totalUsers: count() }).from(usersTable),
    db.select({ totalSignals: count() }).from(signalsTable),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "free")),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "pro")),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.plan, "enterprise")),
  ]);

  res.json({
    totalUsers: Number(totalUsers),
    activeUsers: Number(totalUsers), // Refine when activity tracking is added
    totalSignals: Number(totalSignals),
    planBreakdown: {
      free: Number(freePlan[0]?.count ?? 0),
      pro: Number(proPlan[0]?.count ?? 0),
      enterprise: Number(enterprisePlan[0]?.count ?? 0),
    },
  });
});

export default router;
