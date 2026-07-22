import express from "express";
import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  publishExam,
  deleteExam,
} from "../controllers/examController.js";

const router = express.Router();

router.post("/exam", createExam);
router.get("/exams", getExams);
router.get("/exam/:id", getExamById);
router.put("/exam/:id", updateExam);
router.put("/exam/:id/publish", publishExam);
router.delete("/exam/:id", deleteExam);

export default router;
