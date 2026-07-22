import mongoose from "mongoose";
import Student from "../models/studentModel.js";
import moment from "moment";

export const generateFeeVoucher = async (req, res) => {
  try {
    const { studentId, feeType, amount, month, year, feeDetails } = req.body;

    // Basic validation
    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    if (!feeType || !["admission", "monthly", "annual"].includes(feeType)) {
      return res.status(400).json({
        message: "Valid fee type (admission/monthly/annual) is required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Handle Annual Fee (Paper Fund)
    if (feeType === "annual") {
      if (!year) {
        return res.status(400).json({
          message: "Year is required for paper fund",
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          message: "Valid amount is required for paper fund",
        });
      }

      // Check for existing paper fund for this year
      const existingFee = student.feeHistory.find(
        (fee) => fee.feeType === "annual" && fee.year === parseInt(year)
      );

      if (existingFee) {
        return res.status(400).json({
          message: `Paper fund already exists for year ${year}`,
        });
      }

      const voucherNumber = `VOUCHER-PAPERFUND-${Date.now()}-${student.studentId}`;

      const annualFee = {
        feeType: "annual",
        amount: parseFloat(amount),
        year: parseInt(year),
        voucherNumber,
        isPaid: false,
        createdAt: new Date(),
      };

      student.feeHistory.push(annualFee);
      await student.save();

      return res.status(201).json({
        message: "Paper fund voucher generated successfully",
        voucher: annualFee,
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          classId: student.classId,
        },
      });
    }

    // Handle Monthly Fee
    if (feeType === "monthly") {
      // Validate monthly fee requirements
      if (!month || !year) {
        return res.status(400).json({
          message: "Month and year are required for monthly fees",
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          message: "Valid amount is required for monthly fees",
        });
      }

      // Check for existing monthly fee
      const existingFee = student.feeHistory.find(
        (fee) =>
          fee.feeType === "monthly" && fee.month === month && fee.year === year
      );

      if (existingFee) {
        return res.status(400).json({
          message: "Monthly fee already exists for this month/year",
        });
      }

      const voucherNumber = `VOUCHER-MONTHLY-${Date.now()}-${
        student.studentId
      }`;

      const monthlyFee = {
        feeType: "monthly",
        amount: parseFloat(amount),
        month: parseInt(month),
        year: parseInt(year),
        voucherNumber,
        isPaid: false,
        createdAt: new Date(),
      };

      student.feeHistory.push(monthlyFee);
      await student.save();

      return res.status(201).json({
        message: "Monthly fee voucher generated successfully",
        voucher: monthlyFee,
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          classId: student.classId,
        },
      });
    }

    // Handle Admission Fee
    if (feeType === "admission") {
      // Validate admission fee requirements
      if (!feeDetails) {
        return res.status(400).json({
          message: "Admission fee details are required",
        });
      }

      // Check for existing admission fee
      const hasExistingAdmission = student.feeHistory.some(
        (fee) => fee.feeType === "admission"
      );

      if (hasExistingAdmission) {
        return res.status(400).json({
          message: "Admission fee already exists for this student",
        });
      }

      const voucherNumber = `VOUCHER-ADMISSION-${Date.now()}-${
        student.studentId
      }`;

      // Calculate total amount
      const admissionComponents = [
        feeDetails.admissionFee || 0,
        feeDetails.annualCharges || 0,
        feeDetails.securityCard || 0,
        feeDetails.paperFund || 0,
        feeDetails.otherDues || 0,
      ].reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

      const monthlyFeeAmount = parseFloat(feeDetails.monthlyFee) || 0;
      const totalAmount = admissionComponents + monthlyFeeAmount;

      // Create admission fee record
      const admissionFee = {
        feeType: "admission",
        amount: totalAmount,
        details: {
          admissionFee: parseFloat(feeDetails.admissionFee) || 0,
          annualCharges: parseFloat(feeDetails.annualCharges) || 0,
          securityCard: parseFloat(feeDetails.securityCard) || 0,
          paperFund: parseFloat(feeDetails.paperFund) || 0,
          otherDues: parseFloat(feeDetails.otherDues) || 0,
          monthlyFee: monthlyFeeAmount,
          ...(monthlyFeeAmount > 0 && {
            monthlyFeeMonth: parseInt(feeDetails.monthlyFeeMonth),
            monthlyFeeYear: parseInt(feeDetails.monthlyFeeYear),
          }),
        },
        voucherNumber,
        isPaid: false,
        includesMonthlyFee: monthlyFeeAmount > 0,
        createdAt: new Date(),
      };

      student.feeHistory.push(admissionFee);

      // Create monthly fee record if included
      if (monthlyFeeAmount > 0) {
        const monthlyVoucherNumber = `VOUCHER-MONTHLY-${Date.now()}-${
          student.studentId
        }`;

        student.feeHistory.push({
          feeType: "monthly",
          amount: monthlyFeeAmount,
          month: parseInt(feeDetails.monthlyFeeMonth),
          year: parseInt(feeDetails.monthlyFeeYear),
          voucherNumber: monthlyVoucherNumber,
          isPaid: false,
          linkedAdmissionVoucher: voucherNumber,
          createdAt: new Date(),
        });
      }

      await student.save();

      return res.status(201).json({
        message: "Admission fee voucher generated successfully",
        voucher: {
          ...admissionFee,
          isCombinedVoucher: monthlyFeeAmount > 0,
        },
        student: {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          classId: student.classId,
        },
      });
    }
  } catch (error) {
    console.error("Error in generateFeeVoucher:", error);
    res.status(500).json({
      message: "Server error while generating voucher",
      error: error.message,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  }
};

export const generateBulkAdmissionFees = async (req, res) => {
  try {
    const { classId, feeDetails } = req.body;

    if (!classId || !feeDetails?.admissionFee) {
      return res
        .status(400)
        .json({ message: "Class ID and admission fee are required" });
    }

    const {
      admissionFee,
      annualCharges = 0,
      securityCard = 0,
      paperFund = 0,
      monthlyFee = 0,
      monthlyFeeMonth,
      monthlyFeeYear,
      otherDues = 0,
    } = feeDetails;

    if (monthlyFee > 0 && (!monthlyFeeMonth || !monthlyFeeYear)) {
      return res.status(400).json({
        message: "Month and year are required when including monthly fee",
      });
    }

    const students = await Student.find({ classId }).lean();
    if (students.length === 0) {
      return res
        .status(404)
        .json({ message: "No students found in this class" });
    }

    const bulkOps = [];

    for (const student of students) {
      const hasAdmissionFee = student.feeHistory.some(
        (fee) => fee.feeType === "admission"
      );

      if (!hasAdmissionFee) {
        const voucherNumber = `VOUCHER-ADMISSION-${Date.now()}-${student.studentId}`;

        const totalAmount = [
          parseFloat(admissionFee) || 0,
          parseFloat(annualCharges) || 0,
          parseFloat(securityCard) || 0,
          parseFloat(paperFund) || 0,
          parseFloat(monthlyFee) || 0,
          parseFloat(otherDues) || 0,
        ].reduce((sum, val) => sum + val, 0);

        const newFee = {
          feeType: "admission",
          amount: totalAmount,
          details: {
            admissionFee: parseFloat(admissionFee) || 0,
            annualCharges: parseFloat(annualCharges) || 0,
            securityCard: parseFloat(securityCard) || 0,
            paperFund: parseFloat(paperFund) || 0,
            monthlyFee: parseFloat(monthlyFee) || 0,
            monthlyFeeMonth: monthlyFee > 0 ? monthlyFeeMonth : undefined,
            monthlyFeeYear: monthlyFee > 0 ? monthlyFeeYear : undefined,
            otherDues: parseFloat(otherDues) || 0,
          },
          voucherNumber,
          isPaid: false,
          paidAmount: 0,
          remainingAmount: totalAmount,
          includesMonthlyFee: monthlyFee > 0,
          createdAt: new Date(),
        };

        const feesToPush = [newFee];

        if (monthlyFee > 0) {
          const monthlyVoucherNumber = `VOUCHER-MONTHLY-${Date.now()}-${student.studentId}`;

          feesToPush.push({
            feeType: "monthly",
            amount: parseFloat(monthlyFee) || 0,
            month: monthlyFeeMonth,
            year: monthlyFeeYear,
            voucherNumber: monthlyVoucherNumber,
            isPaid: false,
            paidAmount: 0,
            remainingAmount: parseFloat(monthlyFee) || 0,
            linkedAdmissionVoucher: voucherNumber,
            createdAt: new Date(),
          });
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: student._id },
            update: {
              $push: {
                feeHistory: { $each: feesToPush },
              },
            },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await Student.bulkWrite(bulkOps, { ordered: false });
    }

    res.json({
      message: `Generated ${bulkOps.length} admission vouchers successfully`,
      count: bulkOps.length,
      totalStudents: students.length,
    });
  } catch (error) {
    console.error("Error in generateBulkAdmissionFees:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateFeeStatus = async (req, res) => {
  try {
    const { studentId, voucherNumber } = req.params;
    const { isPaid } = req.body;

    // Validation
    if (typeof isPaid !== "boolean") {
      return res.status(400).json({ message: "Invalid payment status" });
    }

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Find the main fee with this voucher number
    const fee = student.feeHistory.find(
      (f) => f.voucherNumber === voucherNumber
    );

    if (!fee) {
      return res.status(404).json({ message: "Fee voucher not found" });
    }

    const now = new Date();
    let updatedCount = 1;

    if (isPaid) {
      // Mark as PAID
      fee.isPaid = true;
      fee.paidAmount = fee.amount;
      fee.remainingAmount = 0;
      fee.paymentDate = now;

      // Bug #2 Fix: If this is an admission voucher with linked monthly fee, mark it paid too
      if (fee.feeType === "admission" && fee.includesMonthlyFee) {
        const linkedMonthly = student.feeHistory.find(
          (f) => f.linkedAdmissionVoucher === voucherNumber
        );
        if (linkedMonthly) {
          linkedMonthly.isPaid = true;
          linkedMonthly.paidAmount = linkedMonthly.amount;
          linkedMonthly.remainingAmount = 0;
          linkedMonthly.paymentDate = now;
          updatedCount++;
        }
      }
    } else {
      // Bug #1 Fix: Mark as UNPAID — reset all payment data
      fee.isPaid = false;
      fee.paidAmount = 0;
      fee.remainingAmount = fee.amount;
      fee.paymentDate = undefined;
      fee.partialPayments = [];

      // Also unmark linked monthly fee if this is an admission voucher
      if (fee.feeType === "admission" && fee.includesMonthlyFee) {
        const linkedMonthly = student.feeHistory.find(
          (f) => f.linkedAdmissionVoucher === voucherNumber
        );
        if (linkedMonthly) {
          linkedMonthly.isPaid = false;
          linkedMonthly.paidAmount = 0;
          linkedMonthly.remainingAmount = linkedMonthly.amount;
          linkedMonthly.paymentDate = undefined;
          linkedMonthly.partialPayments = [];
          updatedCount++;
        }
      }
    }

    await student.save();

    res.json({
      message: isPaid ? "Fee marked as paid" : "Fee marked as unpaid",
      updatedCount,
      student,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStudentFeeSummary = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    // Try finding by _id first, then by studentId
    let student;
    if (mongoose.Types.ObjectId.isValid(studentId)) {
      student = await Student.findById(studentId)
        .populate("classId", "grade section")
        .lean(); // Use lean() for better performance
    }

    if (!student) {
      student = await Student.findOne({ studentId })
        .populate("classId", "grade section")
        .lean(); // Use lean() for better performance
    }

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const admissionFees = student.feeHistory.filter(
      (fee) => fee.feeType === "admission"
    );
    const monthlyFees = student.feeHistory.filter(
      (fee) => fee.feeType === "monthly"
    );
    const annualFees = student.feeHistory.filter(
      (fee) => fee.feeType === "annual"
    );

    // Calculate totals including partial payments
    const totalAdmissionFees = admissionFees.reduce(
      (sum, fee) => sum + fee.amount,
      0
    );
    const paidAdmissionFees = admissionFees.reduce(
      (sum, fee) => sum + (fee.paidAmount || 0),
      0
    );

    const totalMonthlyFees = monthlyFees.reduce(
      (sum, fee) => sum + fee.amount,
      0
    );
    const paidMonthlyFees = monthlyFees.reduce(
      (sum, fee) => sum + (fee.paidAmount || 0),
      0
    );

    const totalAnnualFees = annualFees.reduce(
      (sum, fee) => sum + fee.amount,
      0
    );
    const paidAnnualFees = annualFees.reduce(
      (sum, fee) => sum + (fee.paidAmount || 0),
      0
    );

    // Return complete student data along with fee summary
    res.json({
      student: {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        classId: student.classId,
        rollNumber: student.rollNumber,
        photo: student.photo,
        guardianName: student.guardianName,
        gender: student.gender,
        address: student.address,
        guardianPhone: student.guardianPhone,
      },
      admissionFees: {
        total: totalAdmissionFees,
        paid: paidAdmissionFees,
        pending: totalAdmissionFees - paidAdmissionFees,
        details: admissionFees.map((fee) => ({
          _id: fee._id,
          feeType: fee.feeType,
          amount: fee.amount,
          voucherNumber: fee.voucherNumber,
          isPaid: fee.isPaid,
          paidAmount: fee.paidAmount || 0,
          remainingAmount: fee.amount - (fee.paidAmount || 0),
          paymentDate: fee.paymentDate,
          createdAt: fee.createdAt,
          admissionFee: fee.details?.admissionFee || 0,
          annualCharges: fee.details?.annualCharges || 0,
          securityCard: fee.details?.securityCard || 0,
          paperFund: fee.details?.paperFund || 0,
          monthlyFee: fee.details?.monthlyFee || 0,
          monthlyFeeMonth: fee.details?.monthlyFeeMonth,
          monthlyFeeYear: fee.details?.monthlyFeeYear,
          otherDues: fee.details?.otherDues || 0,
          includesMonthlyFee: fee.includesMonthlyFee,
          partialPayments: fee.partialPayments || [],
          paymentStatus: fee.isPaid
            ? "Fully Paid"
            : fee.paidAmount > 0
            ? "Partially Paid"
            : "Unpaid",
        })),
      },
      monthlyFees: {
        total: totalMonthlyFees,
        paid: paidMonthlyFees,
        pending: totalMonthlyFees - paidMonthlyFees,
        details: monthlyFees.map((fee) => ({
          _id: fee._id,
          feeType: fee.feeType,
          amount: fee.amount,
          month: fee.month,
          year: fee.year,
          voucherNumber: fee.voucherNumber,
          isPaid: fee.isPaid,
          paidAmount: fee.paidAmount || 0,
          remainingAmount: fee.amount - (fee.paidAmount || 0),
          paymentDate: fee.paymentDate,
          createdAt: fee.createdAt,
          linkedAdmissionVoucher: fee.linkedAdmissionVoucher,
          partialPayments: fee.partialPayments || [],
          paymentStatus: fee.isPaid
            ? "Fully Paid"
            : fee.paidAmount > 0
            ? "Partially Paid"
            : "Unpaid",
        })),
      },
      annualFees: {
        total: totalAnnualFees,
        paid: paidAnnualFees,
        pending: totalAnnualFees - paidAnnualFees,
        details: annualFees.map((fee) => ({
          _id: fee._id,
          feeType: fee.feeType,
          amount: fee.amount,
          year: fee.year,
          voucherNumber: fee.voucherNumber,
          isPaid: fee.isPaid,
          paidAmount: fee.paidAmount || 0,
          remainingAmount: fee.amount - (fee.paidAmount || 0),
          paymentDate: fee.paymentDate,
          createdAt: fee.createdAt,
          partialPayments: fee.partialPayments || [],
          paymentStatus: fee.isPaid
            ? "Fully Paid"
            : fee.paidAmount > 0
            ? "Partially Paid"
            : "Unpaid",
        })),
      },
      overall: {
        totalFees: totalAdmissionFees + totalMonthlyFees + totalAnnualFees,
        paidFees: paidAdmissionFees + paidMonthlyFees + paidAnnualFees,
        pendingFees:
          totalAdmissionFees +
          totalMonthlyFees +
          totalAnnualFees -
          (paidAdmissionFees + paidMonthlyFees + paidAnnualFees),
      },
    });
  } catch (error) {
    console.error("Error in getStudentFeeSummary:", error);
    res.status(500).json({
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const getMonthlyFeeSummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthInt = parseInt(month);
    const yearInt = parseInt(year);

    const result = await Student.aggregate([
      { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "feeHistory.feeType": "monthly",
          "feeHistory.month": monthInt,
          "feeHistory.year": yearInt,
        },
      },
      {
        $group: {
          _id: "$_id",
          studentPaid: {
            $sum: {
              $cond: [
                "$feeHistory.isPaid",
                "$feeHistory.amount",
                { $ifNull: ["$feeHistory.paidAmount", 0] },
              ],
            },
          },
          studentPending: {
            $sum: {
              $cond: [
                "$feeHistory.isPaid",
                0,
                {
                  $subtract: [
                    "$feeHistory.amount",
                    { $ifNull: ["$feeHistory.paidAmount", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          paidFees: { $sum: "$studentPaid" },
          pendingFees: { $sum: "$studentPending" },
          paidStudents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$studentPaid", 0] },
                    { $eq: ["$studentPending", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          pendingStudents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$studentPaid", 0] },
                    { $gt: ["$studentPending", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          partiallyPaidStudents: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$studentPaid", 0] },
                    { $gt: ["$studentPending", 0] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const data = result[0] || {};

    res.json({
      paidFees: data.paidFees || 0,
      pendingFees: data.pendingFees || 0,
      totalFees: (data.paidFees || 0) + (data.pendingFees || 0),
      paidStudents: data.paidStudents || 0,
      partiallyPaidStudents: data.partiallyPaidStudents || 0,
      pendingStudents: data.pendingStudents || 0,
      month: monthInt,
      year: yearInt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdmissionFeeSummary = async (req, res) => {
  try {
    const result = await Student.aggregate([
      { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
      { $match: { "feeHistory.feeType": "admission" } },
      {
        $addFields: {
          effectiveAmount: {
            $subtract: [
              "$feeHistory.amount",
              { $ifNull: ["$feeHistory.details.monthlyFee", 0] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          studentPaid: {
            $sum: {
              $cond: [
                "$feeHistory.isPaid",
                "$effectiveAmount",
                {
                  $cond: [
                    { $gt: ["$feeHistory.amount", 0] },
                    {
                      $multiply: [
                        { $ifNull: ["$feeHistory.paidAmount", 0] },
                        { $divide: ["$effectiveAmount", "$feeHistory.amount"] },
                      ],
                    },
                    0,
                  ],
                },
              ],
            },
          },
          studentPending: {
            $sum: {
              $cond: [
                "$feeHistory.isPaid",
                0,
                {
                  $subtract: [
                    "$effectiveAmount",
                    {
                      $cond: [
                        { $gt: ["$feeHistory.amount", 0] },
                        {
                          $multiply: [
                            { $ifNull: ["$feeHistory.paidAmount", 0] },
                            { $divide: ["$effectiveAmount", "$feeHistory.amount"] },
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
          },
          hasFullyPaid: { $max: { $cond: ["$feeHistory.isPaid", true, false] } },
          hasPartialPaid: {
            $max: {
              $cond: [
                {
                  $and: [
                    { $not: "$feeHistory.isPaid" },
                    { $gt: [{ $ifNull: ["$feeHistory.paidAmount", 0] }, 0] },
                  ],
                },
                true,
                false,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          paidFees: { $sum: "$studentPaid" },
          pendingFees: { $sum: "$studentPending" },
          paidStudents: { $sum: { $cond: ["$hasFullyPaid", 1, 0] } },
          partiallyPaidStudents: {
            $sum: {
              $cond: [
                { $and: [{ $not: "$hasFullyPaid" }, "$hasPartialPaid"] },
                1,
                0,
              ],
            },
          },
          pendingStudents: {
            $sum: {
              $cond: [
                { $and: [{ $not: "$hasFullyPaid" }, { $not: "$hasPartialPaid" }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const data = result[0] || {};

    res.json({
      paidFees: data.paidFees || 0,
      pendingFees: data.pendingFees || 0,
      totalFees: (data.paidFees || 0) + (data.pendingFees || 0),
      paidStudents: data.paidStudents || 0,
      partiallyPaidStudents: data.partiallyPaidStudents || 0,
      pendingStudents: data.pendingStudents || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateBulkMonthlyFees = async (req, res) => {
  try {
    const { classId, month, year, amount } = req.body;

    if (!classId || !month || !year || !amount) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const students = await Student.find({ classId }).lean();
    if (students.length === 0) {
      return res
        .status(404)
        .json({ message: "No students found in this class" });
    }

    const bulkOps = [];
    let skippedCount = 0;

    for (const student of students) {
      const existingFee = student.feeHistory.find(
        (fee) =>
          fee.feeType === "monthly" && fee.month === month && fee.year === year
      );

      if (!existingFee) {
        const voucherNumber = `VOUCHER-MONTHLY-${Date.now()}-${student.studentId}`;

        bulkOps.push({
          updateOne: {
            filter: { _id: student._id },
            update: {
              $push: {
                feeHistory: {
                  feeType: "monthly",
                  amount,
                  month,
                  year,
                  voucherNumber,
                  isPaid: false,
                  paidAmount: 0,
                  remainingAmount: amount,
                  createdAt: new Date(),
                },
              },
            },
          },
        });
      } else {
        skippedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await Student.bulkWrite(bulkOps, { ordered: false });
    }

    res.json({
      message: `Generated ${bulkOps.length} vouchers successfully`,
      count: bulkOps.length,
      totalStudents: students.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateBulkPaperFund = async (req, res) => {
  try {
    const { classId, year, amount } = req.body;

    if (!classId || !year || !amount) {
      return res.status(400).json({ message: "Class, year, and amount are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const students = await Student.find({ classId }).lean();
    if (students.length === 0) {
      return res.status(404).json({ message: "No students found in this class" });
    }

    const bulkOps = [];
    let skippedCount = 0;

    for (const student of students) {
      const existingFee = student.feeHistory.find(
        (fee) => fee.feeType === "annual" && fee.year === parseInt(year)
      );

      if (!existingFee) {
        const voucherNumber = `VOUCHER-PAPERFUND-${Date.now()}-${student.studentId}`;

        bulkOps.push({
          updateOne: {
            filter: { _id: student._id },
            update: {
              $push: {
                feeHistory: {
                  feeType: "annual",
                  amount: parseFloat(amount),
                  year: parseInt(year),
                  voucherNumber,
                  isPaid: false,
                  paidAmount: 0,
                  remainingAmount: parseFloat(amount),
                  createdAt: new Date(),
                },
              },
            },
          },
        });
      } else {
        skippedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await Student.bulkWrite(bulkOps, { ordered: false });
    }

    res.json({
      message: `Generated ${bulkOps.length} paper fund vouchers successfully${skippedCount > 0 ? ` (${skippedCount} already existed)` : ''}`,
      count: bulkOps.length,
      skipped: skippedCount,
      totalStudents: students.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getClassFeeSummary = async (req, res) => {
  try {
    const { classId, month, year } = req.query;

    if (!classId) {
      return res.status(400).json({ message: "Class ID is required" });
    }

    const students = await Student.find({ classId }).populate(
      "classId",
      "grade section"
    ).lean();

    let paidFees = 0;
    let pendingFees = 0;
    let paidStudents = 0;
    let pendingStudents = 0;
    let partiallyPaidStudents = 0;
    const vouchers = [];

    students.forEach((student) => {
      let hasFullPayment = false;
      let hasPartialPayment = false;

      student.feeHistory.forEach((fee) => {
        if (fee.feeType === "monthly") {
          if ((!month || fee.month == month) && (!year || fee.year == year)) {
            if (fee.isPaid) {
              paidFees += fee.amount;
              hasFullPayment = true;
            } else if (fee.paidAmount > 0) {
              paidFees += fee.paidAmount;
              pendingFees += fee.amount - fee.paidAmount;
              hasPartialPayment = true;
            } else {
              pendingFees += fee.amount;
            }
            vouchers.push({
              studentId: student.studentId,
              studentName: student.name,
              rollNumber: student.rollNumber,
              ...fee,
              paidAmount: fee.paidAmount || 0,
              remainingAmount: fee.amount - (fee.paidAmount || 0),
              paymentStatus: fee.isPaid
                ? "Fully Paid"
                : fee.paidAmount > 0
                ? "Partially Paid"
                : "Unpaid",
            });
          }
        }

        if (fee.feeType === "admission") {
          // Subtract monthly fee component to avoid double counting with linked monthly voucher
          const effectiveAmount = fee.amount - (fee.details?.monthlyFee || 0);
          const ratio = fee.amount > 0 ? effectiveAmount / fee.amount : 1;

          if (fee.isPaid) {
            paidFees += effectiveAmount;
            hasFullPayment = true;
          } else if (fee.paidAmount > 0) {
            const effectivePaid = fee.paidAmount * ratio;
            paidFees += effectivePaid;
            pendingFees += effectiveAmount - effectivePaid;
            hasPartialPayment = true;
          } else {
            pendingFees += effectiveAmount;
          }
          vouchers.push({
            studentId: student.studentId,
            studentName: student.name,
            rollNumber: student.rollNumber,
            ...fee,
            paidAmount: fee.paidAmount || 0,
            remainingAmount: fee.amount - (fee.paidAmount || 0),
            paymentStatus: fee.isPaid
              ? "Fully Paid"
              : fee.paidAmount > 0
              ? "Partially Paid"
              : "Unpaid",
          });
        }

        if (fee.feeType === "annual") {
          if (!year || fee.year == year) {
            if (fee.isPaid) {
              paidFees += fee.amount;
              hasFullPayment = true;
            } else if (fee.paidAmount > 0) {
              paidFees += fee.paidAmount;
              pendingFees += fee.amount - fee.paidAmount;
              hasPartialPayment = true;
            } else {
              pendingFees += fee.amount;
            }
            vouchers.push({
              studentId: student.studentId,
              studentName: student.name,
              rollNumber: student.rollNumber,
              ...fee,
              paidAmount: fee.paidAmount || 0,
              remainingAmount: fee.amount - (fee.paidAmount || 0),
              paymentStatus: fee.isPaid
                ? "Fully Paid"
                : fee.paidAmount > 0
                ? "Partially Paid"
                : "Unpaid",
            });
          }
        }
      });

      if (hasFullPayment) paidStudents++;
      else if (hasPartialPayment) partiallyPaidStudents++;
      else pendingStudents++;
    });

    res.json({
      classId,
      className: students[0]?.classId
        ? `${students[0].classId.grade} - ${students[0].classId.section}`
        : "Unknown Class",
      paidFees,
      pendingFees,
      totalFees: paidFees + pendingFees,
      paidStudents,
      partiallyPaidStudents,
      pendingStudents,
      totalStudents: students.length,
      vouchers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getClassStudentsUnpaidFees = async (req, res) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ message: "Class ID is required" });
    }

    const students = await Student.find({ classId })
      .populate("classId", "grade section")
      .lean();

    const studentsWithUnpaidFees = [];

    students.forEach((student) => {
      const unpaidFees = student.feeHistory.filter(
        (fee) => !fee.isPaid && (fee.amount - (fee.paidAmount || 0)) > 0
      );

      if (unpaidFees.length > 0) {
        studentsWithUnpaidFees.push({
          studentId: student.studentId,
          name: student.name,
          rollNumber: student.rollNumber,
          fatherName: student.fatherName,
          classId: student.classId,
          unpaidFees: unpaidFees.map((fee) => ({
            _id: fee._id,
            feeType: fee.feeType,
            amount: fee.amount,
            paidAmount: fee.paidAmount || 0,
            month: fee.month,
            year: fee.year,
            voucherNumber: fee.voucherNumber,
            details: fee.details,
          })),
        });
      }
    });

    res.json({
      classId,
      className: students[0]?.classId
        ? `${students[0].classId.grade} - ${students[0].classId.section}`
        : "Unknown Class",
      totalStudents: students.length,
      studentsWithUnpaidFees: studentsWithUnpaidFees.length,
      students: studentsWithUnpaidFees,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editAdmissionFeeVoucher = async (req, res) => {
  try {
    const { studentId, voucherNumber } = req.params;
    const { feeDetails } = req.body;

    // Validation checks
    if (!studentId || !voucherNumber) {
      return res
        .status(400)
        .json({ message: "Student ID and voucher number are required" });
    }

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Find the admission fee voucher
    const admissionFeeIndex = student.feeHistory.findIndex(
      (fee) =>
        fee.voucherNumber === voucherNumber && fee.feeType === "admission"
    );

    if (admissionFeeIndex === -1) {
      return res
        .status(404)
        .json({ message: "Admission fee voucher not found" });
    }

    const admissionFee = student.feeHistory[admissionFeeIndex];

    // Prevent editing a voucher that already has money against it. A fully-paid
    // OR partially-paid voucher cannot be safely re-amounted, because changing
    // `amount` without resetting the recorded payments corrupts the balance
    // (e.g. amount edited below paidAmount => negative remaining + false isPaid).
    if (admissionFee.isPaid || (admissionFee.paidAmount || 0) > 0) {
      return res.status(400).json({
        message: "Cannot edit a voucher that already has payments recorded",
      });
    }

    // Calculate new amounts (coerce to numbers — form values arrive as strings,
    // and `+` on strings concatenates instead of adding, corrupting the total).
    const admissionComponents = [
      feeDetails.admissionFee,
      feeDetails.annualCharges,
      feeDetails.securityCard,
      feeDetails.paperFund,
      feeDetails.otherDues,
    ].reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

    const monthlyFee = parseFloat(feeDetails.monthlyFee) || 0;
    const totalAmount = admissionComponents + monthlyFee;

    // Update admission fee details
    student.feeHistory[admissionFeeIndex].amount = totalAmount;
    student.feeHistory[admissionFeeIndex].details = {
      admissionFee: parseFloat(feeDetails.admissionFee) || 0,
      annualCharges: parseFloat(feeDetails.annualCharges) || 0,
      securityCard: parseFloat(feeDetails.securityCard) || 0,
      paperFund: parseFloat(feeDetails.paperFund) || 0,
      otherDues: parseFloat(feeDetails.otherDues) || 0,
      monthlyFee: monthlyFee,
      monthlyFeeMonth: feeDetails.monthlyFeeMonth,
      monthlyFeeYear: feeDetails.monthlyFeeYear,
    };
    student.feeHistory[admissionFeeIndex].includesMonthlyFee = monthlyFee > 0;

    // Find and update or create linked monthly fee
    if (monthlyFee > 0) {
      const monthlyFeeIndex = student.feeHistory.findIndex(
        (fee) => fee.linkedAdmissionVoucher === voucherNumber
      );

      if (monthlyFeeIndex !== -1) {
        // Update existing monthly fee
        student.feeHistory[monthlyFeeIndex].amount = monthlyFee;
        student.feeHistory[monthlyFeeIndex].month = feeDetails.monthlyFeeMonth;
        student.feeHistory[monthlyFeeIndex].year = feeDetails.monthlyFeeYear;
      } else {
        // Create new monthly fee record
        const monthlyFeeRecord = {
          feeType: "monthly",
          amount: monthlyFee,
          month: feeDetails.monthlyFeeMonth,
          year: feeDetails.monthlyFeeYear,
          voucherNumber: `VOUCHER-MONTHLY-${Date.now()}-${student.studentId}`,
          isPaid: false,
          linkedAdmissionVoucher: voucherNumber,
        };
        student.feeHistory.push(monthlyFeeRecord);
      }
    } else {
      // Remove monthly fee if it exists but shouldn't anymore
      const monthlyFeeIndex = student.feeHistory.findIndex(
        (fee) => fee.linkedAdmissionVoucher === voucherNumber
      );
      if (monthlyFeeIndex !== -1) {
        student.feeHistory.splice(monthlyFeeIndex, 1);
      }
    }

    await student.save();

    res.json({
      message: "Admission fee voucher updated successfully",
      voucher: student.feeHistory[admissionFeeIndex],
      student,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editMonthlyFeeVoucher = async (req, res) => {
  try {
    const { studentId, voucherNumber } = req.params;
    const { amount, month, year } = req.body;

    // Validation checks
    if (!studentId || !voucherNumber) {
      return res
        .status(400)
        .json({ message: "Student ID and voucher number are required" });
    }

    if (!amount || !month || !year) {
      return res
        .status(400)
        .json({ message: "Amount, month and year are required" });
    }

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Find the monthly fee voucher
    const monthlyFeeIndex = student.feeHistory.findIndex(
      (fee) => fee.voucherNumber === voucherNumber && fee.feeType === "monthly"
    );

    if (monthlyFeeIndex === -1) {
      return res.status(404).json({ message: "Monthly fee voucher not found" });
    }

    const monthlyFee = student.feeHistory[monthlyFeeIndex];

    // Prevent editing a voucher that already has money against it (see
    // editAdmissionFeeVoucher — re-amounting a paid/partially-paid voucher
    // corrupts the balance).
    if (monthlyFee.isPaid || (monthlyFee.paidAmount || 0) > 0) {
      return res.status(400).json({
        message: "Cannot edit a voucher that already has payments recorded",
      });
    }

    // Check if another voucher already exists for this month/year
    const existingVoucher = student.feeHistory.find(
      (fee) =>
        fee.feeType === "monthly" &&
        fee.month === month &&
        fee.year === year &&
        fee.voucherNumber !== voucherNumber
    );

    if (existingVoucher) {
      return res.status(400).json({
        message: "A monthly fee voucher already exists for this month and year",
      });
    }

    // Update the monthly fee voucher (coerce amount to a number)
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Valid amount is required" });
    }
    student.feeHistory[monthlyFeeIndex].amount = parsedAmount;
    student.feeHistory[monthlyFeeIndex].month = month;
    student.feeHistory[monthlyFeeIndex].year = year;

    await student.save();

    res.json({
      message: "Monthly fee voucher updated successfully",
      voucher: student.feeHistory[monthlyFeeIndex],
      student,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteFeeVoucher = async (req, res) => {
  try {
    const { studentId, voucherNumber } = req.params;

    // Validation checks
    if (!studentId || !voucherNumber) {
      return res
        .status(400)
        .json({ message: "Student ID and voucher number are required" });
    }

    const student = await Student.findOne({ studentId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Find all fees with this voucher number (could be multiple if it's an admission with monthly)
    const feesToDelete = student.feeHistory.filter(
      (fee) =>
        fee.voucherNumber === voucherNumber ||
        fee.linkedAdmissionVoucher === voucherNumber
    );

    if (feesToDelete.length === 0) {
      return res.status(404).json({ message: "Fee voucher not found" });
    }

    // Check if any of the fees are already paid
    const paidFees = feesToDelete.filter((fee) => fee.isPaid);
    if (paidFees.length > 0) {
      return res.status(400).json({
        message: "Cannot delete paid vouchers",
        paidVouchers: paidFees.map((f) => ({
          type: f.feeType,
          amount: f.amount,
          paymentDate: f.paymentDate,
        })),
      });
    }

    // Remove the fees
    student.feeHistory = student.feeHistory.filter(
      (fee) =>
        !(
          fee.voucherNumber === voucherNumber ||
          fee.linkedAdmissionVoucher === voucherNumber
        )
    );

    await student.save();

    res.json({
      message: "Fee voucher(s) deleted successfully",
      deletedCount: feesToDelete.length,
      student,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// new changes
export const recordPartialPayment = async (req, res) => {
  try {
    const { studentId, voucherNumber } = req.params;
    const { amount, receivedBy, paymentMethod, referenceNumber, remarks, date } =
      req.body;

    // Validation
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Valid payment amount is required" });
    }

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Find the main voucher
    const fee = student.feeHistory.find(
      (f) => f.voucherNumber === voucherNumber
    );
    if (!fee) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    // Initialize payment tracking (use ?? so a legitimate 0 balance is preserved,
    // otherwise a fully-paid voucher's remaining of 0 falsely resets to full amount)
    fee.paidAmount = fee.paidAmount || 0;
    fee.remainingAmount = fee.amount - fee.paidAmount;
    fee.partialPayments = fee.partialPayments || [];

    if (fee.remainingAmount <= 0) {
      return res
        .status(400)
        .json({ message: "This voucher is already fully paid" });
    }

    if (paymentAmount > fee.remainingAmount) {
      return res.status(400).json({
        message: `Amount exceeds remaining balance of Rs. ${fee.remainingAmount}`,
      });
    }

    // Record the payment
    const paymentData = {
      amount: paymentAmount,
      receivedBy: receivedBy || "Cashier",
      paymentMethod: paymentMethod || "Cash",
      referenceNumber,
      remarks,
      date: date ? new Date(date) : new Date(),
    };

    // Add to partial payments
    fee.partialPayments.push(paymentData);

    // Update paid amount immediately
    fee.paidAmount += paymentData.amount;
    fee.remainingAmount = fee.amount - fee.paidAmount;

    // For admission vouchers that include monthly fee
    if (
      fee.feeType === "admission" &&
      fee.includesMonthlyFee &&
      fee.details?.monthlyFee
    ) {
      const monthlyFee = student.feeHistory.find(
        (f) => f.linkedAdmissionVoucher === voucherNumber
      );

      if (monthlyFee) {
        const totalAmount = fee.amount;
        const monthlyAmount = fee.details.monthlyFee;
        const paymentRatio = paymentData.amount / totalAmount;
        const monthlyPayment = paymentRatio * monthlyAmount;

        // Update monthly fee payment immediately
        monthlyFee.paidAmount = (monthlyFee.paidAmount || 0) + monthlyPayment;
        monthlyFee.remainingAmount = monthlyFee.amount - monthlyFee.paidAmount;

        if (monthlyFee.paidAmount >= monthlyFee.amount) {
          monthlyFee.isPaid = true;
          monthlyFee.paymentDate = new Date();
        }
      }
    }

    // Mark as paid if fully paid
    if (fee.paidAmount >= fee.amount) {
      fee.isPaid = true;
      fee.paymentDate = new Date();
    }

    await student.save();

    // Get updated fee information including any linked monthly fee
    const updatedFee = student.feeHistory.find(
      (f) => f.voucherNumber === voucherNumber
    );
    let linkedMonthlyFee = null;

    if (updatedFee.feeType === "admission" && updatedFee.includesMonthlyFee) {
      linkedMonthlyFee = student.feeHistory.find(
        (f) => f.linkedAdmissionVoucher === voucherNumber
      );
    }

    res.json({
      success: true, // Explicit success flag
      message: "Partial payment recorded successfully",
      payment: paymentData,
      voucher: {
        ...updatedFee.toObject(),
        paidAmount: updatedFee.paidAmount,
        remainingAmount: updatedFee.remainingAmount,
        isPaid: updatedFee.isPaid,
      },
      linkedMonthlyFee: linkedMonthlyFee
        ? {
            ...linkedMonthlyFee.toObject(),
            paidAmount: linkedMonthlyFee.paidAmount,
            remainingAmount: linkedMonthlyFee.remainingAmount,
            isPaid: linkedMonthlyFee.isPaid,
          }
        : null,
      student: {
        name: student.name,
        studentId: student.studentId,
        classId: student.classId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getVoucherDetails = async (req, res) => {
  try {
    const { studentId, voucherNumber } = req.params;

    const student = await Student.findOne({ studentId }).populate(
      "classId",
      "grade section"
    ).lean();

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const voucher = student.feeHistory.find(
      (f) => f.voucherNumber === voucherNumber
    );
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    res.json({
      student: {
        name: student.name,
        studentId: student.studentId,
        class: student.classId
          ? `${student.classId.grade} - ${student.classId.section}`
          : "N/A",
        rollNumber: student.rollNumber,
      },
      voucher,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// In your studentFeeController.js
export const getDailyFeeSummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    // Validate month and year
    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthInt = parseInt(month);
    const yearInt = parseInt(year);

    // Initialize daily data structure
    const daysInMonth = moment(`${year}-${month}`, "YYYY-MM").daysInMonth();
    const dailySummary = Array(daysInMonth)
      .fill()
      .map((_, i) => ({
        day: i + 1,
        date: moment(`${year}-${month}-${i + 1}`).format("YYYY-MM-DD"),
        paid: 0,
        pending: 0,
        partial: 0,
      }));

    // Aggregation: total due for the month
    const totalDueAgg = await Student.aggregate([
      { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "feeHistory.feeType": "monthly",
          "feeHistory.month": monthInt,
          "feeHistory.year": yearInt,
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$feeHistory.amount" },
        },
      },
    ]);
    const totalDue = totalDueAgg[0]?.totalDue || 0;

    // Aggregation: partial payments by day
    const partialAgg = await Student.aggregate([
      { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "feeHistory.feeType": "monthly",
          "feeHistory.month": monthInt,
          "feeHistory.year": yearInt,
        },
      },
      { $unwind: { path: "$feeHistory.partialPayments", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: { $dayOfMonth: { date: "$feeHistory.partialPayments.date", timezone: "Asia/Karachi" } },
          partial: { $sum: "$feeHistory.partialPayments.amount" },
        },
      },
    ]);

    // Aggregation: final payments (fully paid, minus partials already counted)
    const finalAgg = await Student.aggregate([
      { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "feeHistory.feeType": "monthly",
          "feeHistory.month": monthInt,
          "feeHistory.year": yearInt,
          "feeHistory.isPaid": true,
          "feeHistory.paymentDate": { $exists: true },
        },
      },
      {
        $addFields: {
          partialTotal: {
            $reduce: {
              input: { $ifNull: ["$feeHistory.partialPayments", []] },
              initialValue: 0,
              in: { $add: ["$$value", "$$this.amount"] },
            },
          },
        },
      },
      {
        $addFields: {
          remainingPaid: { $subtract: ["$feeHistory.amount", "$partialTotal"] },
        },
      },
      { $match: { remainingPaid: { $gt: 0 } } },
      {
        $group: {
          _id: { $dayOfMonth: { date: "$feeHistory.paymentDate", timezone: "Asia/Karachi" } },
          paid: { $sum: "$remainingPaid" },
        },
      },
    ]);

    // Map results to daily summary
    for (const row of partialAgg) {
      const idx = row._id - 1;
      if (idx >= 0 && idx < daysInMonth) {
        dailySummary[idx].partial += row.partial;
        dailySummary[idx].paid += row.partial;
      }
    }

    for (const row of finalAgg) {
      const idx = row._id - 1;
      if (idx >= 0 && idx < daysInMonth) {
        dailySummary[idx].paid += row.paid;
      }
    }

    // Compute running pending balance per day
    let runningPaid = 0;
    dailySummary.forEach((day) => {
      runningPaid += day.paid;
      day.pending = Math.max(totalDue - runningPaid, 0);
    });

    const totalPending = Math.max(totalDue - runningPaid, 0);

    res.json({
      success: true,
      month,
      year,
      dailySummary,
      totalPending,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
