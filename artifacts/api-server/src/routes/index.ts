import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "../modules/auth/auth.routes.js";
import creditsRouter from "../modules/credits/credits.routes.js";
import plansRouter from "../modules/plans/plans.routes.js";
import workspacesRouter from "../modules/workspaces/workspaces.routes.js";
import campaignsRouter from "../modules/campaigns/campaigns.routes.js";
import intakeRouter from "../modules/intake/intake.routes.js";
import agentsRouter from "../modules/agents/agents.routes.js";
import contentRouter from "../modules/content/content.routes.js";
import metricsRouter from "../modules/metrics/metrics.routes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/credits", creditsRouter);
router.use("/plans", plansRouter);
router.use("/workspaces", workspacesRouter);
router.use("/campaigns", campaignsRouter);
router.use("/intake", intakeRouter);
router.use("/campaigns", agentsRouter);
router.use("/campaigns", contentRouter);
router.use("/campaigns", metricsRouter);

export default router;
