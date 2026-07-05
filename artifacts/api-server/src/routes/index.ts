import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import dashboardRouter from "./dashboard.js";
import marketsRouter from "./markets.js";
import signalsRouter from "./signals.js";
import riskRouter from "./risk.js";
import adminRouter from "./admin.js";
import analysisRouter from "./analysis.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/markets", marketsRouter);
router.use("/signals", signalsRouter);
router.use("/risk", riskRouter);
router.use("/analysis", analysisRouter);
router.use("/admin", adminRouter);

export default router;
