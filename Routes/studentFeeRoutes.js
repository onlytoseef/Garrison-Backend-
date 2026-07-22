import express from "express";
import {
  generateFeeVoucher,
  updateFeeStatus,
  getStudentFeeSummary,
  getMonthlyFeeSummary,
  getAdmissionFeeSummary,
  generateBulkMonthlyFees,
  generateBulkAdmissionFees,
  generateBulkPaperFund,
  getClassFeeSummary,
  getClassStudentsUnpaidFees,
  editAdmissionFeeVoucher,
  editMonthlyFeeVoucher,
  deleteFeeVoucher,
  recordPartialPayment,
  getVoucherDetails,
  getDailyFeeSummary,
} from "../controllers/studentFeeController.js";

const router = express.Router();

router.post("/generate-voucher", generateFeeVoucher);
router.put("/update-status/:studentId/:voucherNumber", updateFeeStatus);
router.get("/summary/:studentId", getStudentFeeSummary);
router.get("/monthly-summary", getMonthlyFeeSummary);
router.get("/admission-summary", getAdmissionFeeSummary);
router.post("/generate-bulk-monthly", generateBulkMonthlyFees);
router.post("/generate-bulk-admission", generateBulkAdmissionFees);
router.post("/generate-bulk-paperfund", generateBulkPaperFund);
router.get("/class-summary", getClassFeeSummary);
router.get("/class-students-unpaid", getClassStudentsUnpaidFees);
router.put(
  "/edit-admission/:studentId/:voucherNumber",
  editAdmissionFeeVoucher
);
router.put("/edit-monthly/:studentId/:voucherNumber", editMonthlyFeeVoucher);
router.delete("/delete-voucher/:studentId/:voucherNumber", deleteFeeVoucher);
router.post("/partial-payment/:studentId/:voucherNumber", recordPartialPayment);

router.get("/daily-summary", getDailyFeeSummary);

router.get("/voucher-details/:studentId/:voucherNumber", getVoucherDetails);

export default router;
