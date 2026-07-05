import { Router, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth.js";
import { z } from "zod/v4";

const router = Router();

const userUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
});

const settingsUpdateSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  notifications: z.boolean().optional(),
  defaultCurrency: z.string().optional(),
  defaultTimeframe: z.string().optional(),
});

// GET /api/users/me
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    plan: user.plan,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
});

// PATCH /api/users/me
router.patch("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user!.userId))
    .returning();

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    plan: user.plan,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
});

// GET /api/users/me/settings
router.get("/me/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  let [settings] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.user!.userId))
    .limit(1);

  if (!settings) {
    // Auto-create settings if they don't exist
    [settings] = await db.insert(userSettingsTable).values({ userId: req.user!.userId }).returning();
  }

  res.json({
    userId: settings.userId,
    theme: settings.theme,
    notifications: settings.notifications,
    defaultCurrency: settings.defaultCurrency,
    defaultTimeframe: settings.defaultTimeframe,
  });
});

// PATCH /api/users/me/settings
router.patch("/me/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const existing = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.user!.userId))
    .limit(1);

  let settings;
  if (existing.length === 0) {
    [settings] = await db
      .insert(userSettingsTable)
      .values({ userId: req.user!.userId, ...parsed.data })
      .returning();
  } else {
    [settings] = await db
      .update(userSettingsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userSettingsTable.userId, req.user!.userId))
      .returning();
  }

  res.json({
    userId: settings.userId,
    theme: settings.theme,
    notifications: settings.notifications,
    defaultCurrency: settings.defaultCurrency,
    defaultTimeframe: settings.defaultTimeframe,
  });
});

export default router;
