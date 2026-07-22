import express from "express";
import {
  addStaff,
  updateStaff,
  deleteStaff,
  getAllStaff,
  paySalary,
  getStaffById,
  getTotalStaffCount,
  getMonthlySalarySummary,
  getCurrentMonthSalarySummary,
} from "../controllers/staffController.js";

const router = express.Router();

router.get("/staff/current-month-salary", getCurrentMonthSalarySummary);
router.post("/staff", addStaff);
router.put("/staff/:id", updateStaff);
router.delete("/staff/:id", deleteStaff);
router.get("/staff", getAllStaff);
router.post("/staff/:id/pay-salary", paySalary);
router.get("/staff/:id", getStaffById);
router.get("/staff/total", getTotalStaffCount);
router.get("/staff-count", getTotalStaffCount);

export default router;
