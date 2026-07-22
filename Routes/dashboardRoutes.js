import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();
router.get("/dashboard-summary", getDashboardSummary);

export default router;
