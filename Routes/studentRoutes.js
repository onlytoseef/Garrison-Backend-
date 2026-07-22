import express from "express";
import {
  addStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getTotalStudents,
  getStudentQRCode,
  generateMissingQRCodes,
} from "../controllers/studentController.js";
import { upload } from "../middleware/multer.js";

const router = express.Router();

// Student CRUD Routes
router.post("/add-student", upload.single("photo"), addStudent);
router.get("/students", getAllStudents);
router.get("/student/:id", getStudentById);
router.get("/student/:id/qrcode", getStudentQRCode); // Lazy load QR code
router.put("/student/:id", upload.single("photo"), updateStudent);
router.delete("/student/:id", deleteStudent);
router.get("/total-students", getTotalStudents);
router.post("/generate-qr-codes", generateMissingQRCodes);

export default router;
