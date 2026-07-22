import express from "express";
import {
  bulkEnterMarks,
  getStudentResult,
  getClassResults,
  getStudentAllResults,
} from "../controllers/resultController.js";

const router = express.Router();

router.post("/result/bulk/:examId", bulkEnterMarks);
router.get("/result/class/:examId", getClassResults);
router.get("/result/student/:examId/:studentId", getStudentResult);
router.get("/result/student-history/:studentId", getStudentAllResults);

export default router;
