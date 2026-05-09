import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "../modules/auth/auth.routes.js";
import creditsRouter from "../modules/credits/credits.routes.js";
import plansRouter from "../modules/plans/plans.routes.js";
import workspacesRouter from "../modules/workspaces/workspaces.routes.js";
import campaignsRouter from "../modules/campaigns/campaigns.routes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/credits", creditsRouter);
router.use("/plans", plansRouter);
router.use("/workspaces", workspacesRouter);
router.use("/campaigns", campaignsRouter);

export default router;
