import express from "express";
import {
  markAttendance,
  getAttendanceRecords,
  getAttendanceByStudentId,
  getAttendanceSummary,
  getScannedStudents,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.post("/mark", markAttendance);
router.get("/records", getAttendanceRecords);
router.get("/attendance/student/:studentId", getAttendanceByStudentId);

router.get("/summary", getAttendanceSummary);
router.get("/attendance/scanned-students", getScannedStudents);

export default router;
