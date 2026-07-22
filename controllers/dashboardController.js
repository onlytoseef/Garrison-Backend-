import moment from "moment";
import Student from "../models/studentModel.js";
import Staff from "../models/staffModel.js";
import Attendance from "../models/attendanceModel.js";

export const getDashboardSummary = async (req, res) => {
  try {
    const currentDate = moment();
    const currentMonth = currentDate.month() + 1;
    const currentYear = currentDate.year();
    const today = currentDate.format("YYYY-MM-DD");

    // Get date range from query parameters, default to last 7 days
    let startDate = req.query.startDate
      ? moment(req.query.startDate).format("YYYY-MM-DD")
      : moment().subtract(6, "days").format("YYYY-MM-DD");
    let endDate = req.query.endDate
      ? moment(req.query.endDate).format("YYYY-MM-DD")
      : today;

    // Validate date range
    if (moment(endDate).isBefore(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    // Parallel data fetching
    const [
      totalStudents,
      presentStudents,
      totalStaff,
      monthlyFeeCurrentMonth,
      admissionFeeSummary,
      paperFundData,
      salarySummary,
      dailyFeeSummary,
      monthlyFeeYearSummary,
    ] = await Promise.all([
      // Basic counts
      Student.countDocuments(),
      Attendance.countDocuments({ date: today, status: "Present" }),
      Staff.countDocuments({}),

      // Current month fee data
      getMonthlyFeeData(currentMonth, currentYear),

      // Admission fee data
      getAdmissionFeeData(),

      // Paper fund data
      getPaperFundData(currentYear),

      // Salary data
      getSalarySummary(currentMonth, currentYear),

      // Daily fee data
      getDailyFeeData(currentYear, startDate, endDate, today),

      // Yearly monthly fee data
      getMonthlyFeeDataForYear(currentYear),
    ]);

    // Calculate rates
    const totalCollectionRate = calculateCollectionRate(
      monthlyFeeCurrentMonth.paidFees + admissionFeeSummary.paidFees + paperFundData.paidFees,
      monthlyFeeCurrentMonth.pendingFees + admissionFeeSummary.pendingFees + paperFundData.pendingFees
    );

    const staffSalaryCollectionRate = calculateCollectionRate(
      salarySummary.totalPaid,
      salarySummary.totalPending
    );

    // Response structure
    res.json({
      // Basic counts
      totalStudents,
      presentStudents,
      totalStaff,

      // Current month fee data
      monthlyFee: {
        paid: monthlyFeeCurrentMonth.paidFees,
        pending: monthlyFeeCurrentMonth.pendingFees,
        paidStudents: monthlyFeeCurrentMonth.paidStudents,
        pendingStudents: monthlyFeeCurrentMonth.pendingStudents,
        partiallyPaidStudents: monthlyFeeCurrentMonth.partiallyPaidStudents,
      },

      // Yearly monthly fee data
      monthlyFeeYearSummary,

      // Admission fee data
      admissionFee: {
        paid: admissionFeeSummary.paidFees,
        pending: admissionFeeSummary.pendingFees,
        paidStudents: admissionFeeSummary.paidStudents,
        pendingStudents: admissionFeeSummary.pendingStudents,
      },

      // Paper fund data
      paperFund: {
        paid: paperFundData.paidFees,
        pending: paperFundData.pendingFees,
        paidStudents: paperFundData.paidStudents,
        pendingStudents: paperFundData.pendingStudents,
      },

      // Salary data
      staffSalary: {
        paid: salarySummary.totalPaid,
        pending: salarySummary.totalPending,
        paidStaffCount: salarySummary.paidStaffCount,
        pendingStaffCount: salarySummary.pendingStaffCount,
      },

      // Daily data
      dailyFeeSummary,

      rates: {
        totalCollectionRate,
        staffSalaryCollectionRate,
      },

      meta: {
        currentMonth,
        currentYear,
        today,
        startDate,
        endDate,
        lastUpdated: new Date(),
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get dashboard summary",
      error: error.message,
    });
  }
};

// Optimized with MongoDB Aggregation Pipeline - Single query for all 12 months
async function getMonthlyFeeDataForYear(year) {
  const aggregationResult = await Student.aggregate([
    { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
    { 
      $match: { 
        "feeHistory.feeType": "monthly",
        "feeHistory.year": year 
      } 
    },
    {
      $group: {
        _id: {
          month: "$feeHistory.month",
          studentId: "$_id"
        },
        paidAmount: {
          $sum: {
            $cond: [
              "$feeHistory.isPaid",
              "$feeHistory.amount",
              { $ifNull: ["$feeHistory.paidAmount", 0] }
            ]
          }
        },
        pendingAmount: {
          $sum: {
            $cond: [
              "$feeHistory.isPaid",
              0,
              { $subtract: ["$feeHistory.amount", { $ifNull: ["$feeHistory.paidAmount", 0] }] }
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: "$_id.month",
        paidFees: { $sum: "$paidAmount" },
        pendingFees: { $sum: "$pendingAmount" },
        paidStudents: {
          $sum: { $cond: [{ $and: [{ $gt: ["$paidAmount", 0] }, { $eq: ["$pendingAmount", 0] }] }, 1, 0] }
        },
        pendingStudents: {
          $sum: { $cond: [{ $and: [{ $eq: ["$paidAmount", 0] }, { $gt: ["$pendingAmount", 0] }] }, 1, 0] }
        },
        partiallyPaidStudents: {
          $sum: { $cond: [{ $and: [{ $gt: ["$paidAmount", 0] }, { $gt: ["$pendingAmount", 0] }] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Build complete 12-month array with defaults for missing months
  const monthlyData = [];
  for (let month = 1; month <= 12; month++) {
    const found = aggregationResult.find(r => r._id === month);
    monthlyData.push({
      month,
      paidFees: found?.paidFees || 0,
      pendingFees: found?.pendingFees || 0,
      paidStudents: found?.paidStudents || 0,
      pendingStudents: found?.pendingStudents || 0,
      partiallyPaidStudents: found?.partiallyPaidStudents || 0,
      monthName: moment().month(month - 1).format("MMM"),
    });
  }
  return monthlyData;
}

// Optimized with MongoDB Aggregation Pipeline
async function getMonthlyFeeData(month, year) {
  const result = await Student.aggregate([
    { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
    { 
      $match: { 
        "feeHistory.feeType": "monthly",
        "feeHistory.month": month,
        "feeHistory.year": year 
      } 
    },
    {
      $group: {
        _id: "$_id",
        paidAmount: {
          $sum: {
            $cond: [
              "$feeHistory.isPaid",
              "$feeHistory.amount",
              { $ifNull: ["$feeHistory.paidAmount", 0] }
            ]
          }
        },
        pendingAmount: {
          $sum: {
            $cond: [
              "$feeHistory.isPaid",
              0,
              { $subtract: ["$feeHistory.amount", { $ifNull: ["$feeHistory.paidAmount", 0] }] }
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        paidFees: { $sum: "$paidAmount" },
        pendingFees: { $sum: "$pendingAmount" },
        paidStudents: {
          $sum: { $cond: [{ $and: [{ $gt: ["$paidAmount", 0] }, { $eq: ["$pendingAmount", 0] }] }, 1, 0] }
        },
        pendingStudents: {
          $sum: { $cond: [{ $and: [{ $eq: ["$paidAmount", 0] }, { $gt: ["$pendingAmount", 0] }] }, 1, 0] }
        },
        partiallyPaidStudents: {
          $sum: { $cond: [{ $and: [{ $gt: ["$paidAmount", 0] }, { $gt: ["$pendingAmount", 0] }] }, 1, 0] }
        }
      }
    }
  ]);

  const data = result[0] || {};
  return {
    paidFees: data.paidFees || 0,
    pendingFees: data.pendingFees || 0,
    paidStudents: data.paidStudents || 0,
    pendingStudents: data.pendingStudents || 0,
    partiallyPaidStudents: data.partiallyPaidStudents || 0,
  };
}

// Optimized with MongoDB Aggregation Pipeline
// Fixed: Subtracts monthly fee component from admission to avoid double counting
async function getAdmissionFeeData() {
  const result = await Student.aggregate([
    { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
    { $match: { "feeHistory.feeType": "admission" } },
    {
      $addFields: {
        // Effective amount excludes monthly fee component (counted separately in monthly vouchers)
        effectiveAmount: {
          $subtract: [
            "$feeHistory.amount",
            { $ifNull: ["$feeHistory.details.monthlyFee", 0] }
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        paidFees: {
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
                      { $divide: ["$effectiveAmount", "$feeHistory.amount"] }
                    ]
                  },
                  0
                ]
              }
            ]
          }
        },
        pendingFees: {
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
                          { $divide: ["$effectiveAmount", "$feeHistory.amount"] }
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            ]
          }
        },
        paidStudents: {
          $sum: { $cond: ["$feeHistory.isPaid", 1, 0] }
        },
        pendingStudents: {
          $sum: { $cond: ["$feeHistory.isPaid", 0, 1] }
        }
      }
    }
  ]);

  const data = result[0] || {};
  return { 
    paidFees: data.paidFees || 0, 
    pendingFees: data.pendingFees || 0, 
    paidStudents: data.paidStudents || 0, 
    pendingStudents: data.pendingStudents || 0 
  };
}

// Paper Fund (Annual Fee) data aggregation
async function getPaperFundData(year) {
  const result = await Student.aggregate([
    { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
    { $match: { "feeHistory.feeType": "annual", "feeHistory.year": year } },
    {
      $group: {
        _id: null,
        paidFees: {
          $sum: {
            $cond: [
              "$feeHistory.isPaid",
              "$feeHistory.amount",
              { $ifNull: ["$feeHistory.paidAmount", 0] }
            ]
          }
        },
        pendingFees: {
          $sum: {
            $cond: [
              "$feeHistory.isPaid",
              0,
              { $subtract: ["$feeHistory.amount", { $ifNull: ["$feeHistory.paidAmount", 0] }] }
            ]
          }
        },
        paidStudents: {
          $sum: { $cond: ["$feeHistory.isPaid", 1, 0] }
        },
        pendingStudents: {
          $sum: { $cond: ["$feeHistory.isPaid", 0, 1] }
        }
      }
    }
  ]);

  const data = result[0] || {};
  return {
    paidFees: data.paidFees || 0,
    pendingFees: data.pendingFees || 0,
    paidStudents: data.paidStudents || 0,
    pendingStudents: data.pendingStudents || 0
  };
}

async function getSalarySummary(month, year) {
  const staffMembers = await Staff.find().lean();
  let totalPaid = 0;
  let totalPending = 0;
  let paidStaffCount = 0;
  let pendingStaffCount = 0;

  staffMembers.forEach((staff) => {
    const salaryRecord = staff.salaryHistory.find(
      (record) =>
        record.month === month && record.year === year && record.isPaid
    );

    if (salaryRecord) {
      totalPaid += salaryRecord.amount;
      paidStaffCount++;
    } else {
      totalPending += staff.salary;
      pendingStaffCount++;
    }
  });

  return { totalPaid, totalPending, paidStaffCount, pendingStaffCount };
}

async function getDailyFeeData(year, startDate, endDate, today) {
  // Use Pakistan (Asia/Karachi, UTC+5) local-day boundaries so payments made
  // after midnight local time are not dropped or filed under the wrong day.
  const TZ = "Asia/Karachi";
  const startDateObj = new Date(startDate + "T00:00:00.000+05:00");
  const endDateObj = new Date(endDate + "T23:59:59.999+05:00");

  // Aggregation for partial payments by date AND feeType
  const partialPaymentsAgg = await Student.aggregate([
    { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
    { $unwind: { path: "$feeHistory.partialPayments", preserveNullAndEmptyArrays: false } },
    {
      $match: {
        "feeHistory.partialPayments.date": { $gte: startDateObj, $lte: endDateObj }
      }
    },
    {
      $addFields: {
        effectiveAmount: {
          $cond: [
            { $eq: ["$feeHistory.feeType", "admission"] },
            { $subtract: ["$feeHistory.amount", { $ifNull: ["$feeHistory.details.monthlyFee", 0] }] },
            "$feeHistory.amount"
          ]
        }
      }
    },
    {
      $addFields: {
        effectivePartial: {
          $cond: [
            {
              $and: [
                { $eq: ["$feeHistory.feeType", "admission"] },
                { $gt: ["$feeHistory.amount", 0] }
              ]
            },
            {
              $multiply: [
                "$feeHistory.partialPayments.amount",
                { $divide: ["$effectiveAmount", "$feeHistory.amount"] }
              ]
            },
            "$feeHistory.partialPayments.amount"
          ]
        }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$feeHistory.partialPayments.date", timezone: TZ } },
          feeType: "$feeHistory.feeType"
        },
        amount: { $sum: "$effectivePartial" }
      }
    }
  ]);

  // Aggregation for final payments (fully paid fees) — subtract partials already counted
  const finalPaymentsAgg = await Student.aggregate([
    { $unwind: { path: "$feeHistory", preserveNullAndEmptyArrays: false } },
    {
      $match: {
        "feeHistory.isPaid": true,
        "feeHistory.paymentDate": { $gte: startDateObj, $lte: endDateObj }
      }
    },
    {
      $addFields: {
        partialTotal: {
          $reduce: {
            input: { $ifNull: ["$feeHistory.partialPayments", []] },
            initialValue: 0,
            in: { $add: ["$$value", "$$this.amount"] }
          }
        }
      }
    },
    {
      $addFields: {
        effectiveAmount: {
          $cond: [
            { $eq: ["$feeHistory.feeType", "admission"] },
            { $subtract: ["$feeHistory.amount", { $ifNull: ["$feeHistory.details.monthlyFee", 0] }] },
            "$feeHistory.amount"
          ]
        }
      }
    },
    {
      $addFields: {
        effectivePartialTotal: {
          $cond: [
            {
              $and: [
                { $eq: ["$feeHistory.feeType", "admission"] },
                { $gt: ["$feeHistory.amount", 0] }
              ]
            },
            { $multiply: ["$partialTotal", { $divide: ["$effectiveAmount", "$feeHistory.amount"] }] },
            "$partialTotal"
          ]
        }
      }
    },
    {
      $addFields: {
        finalPayment: { $subtract: ["$effectiveAmount", "$effectivePartialTotal"] }
      }
    },
    { $match: { finalPayment: { $gt: 0 } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$feeHistory.paymentDate", timezone: TZ } },
          feeType: "$feeHistory.feeType"
        },
        total: { $sum: "$finalPayment" }
      }
    }
  ]);

  // Build daily summary from date range
  const dailySummary = [];
  let currentDate = moment(startDate);
  while (currentDate.isSameOrBefore(endDate)) {
    const dateStr = currentDate.format("YYYY-MM-DD");
    dailySummary.push({
      date: dateStr,
      monthlyFee: 0,
      admissionFee: 0,
      paperFund: 0,
      partialPayments: 0,
      total: 0,
    });
    currentDate.add(1, "day");
  }

  // Map aggregation results to daily summary
  const dayMap = new Map(dailySummary.map(d => [d.date, d]));

  // Map partial payments: paper fund → paperFund column, rest → partialPayments column
  for (const row of partialPaymentsAgg) {
    const entry = dayMap.get(row._id.date);
    if (entry) {
      if (row._id.feeType === "annual") {
        entry.paperFund += row.amount;
      } else {
        entry.partialPayments += row.amount;
      }
      entry.total += row.amount;
    }
  }

  for (const row of finalPaymentsAgg) {
    const entry = dayMap.get(row._id.date);
    if (entry) {
      if (row._id.feeType === "monthly") entry.monthlyFee += row.total;
      else if (row._id.feeType === "admission") entry.admissionFee += row.total;
      else if (row._id.feeType === "annual") entry.paperFund += row.total;
      entry.total += row.total;
    }
  }

  return dailySummary;
}

function calculateCollectionRate(paid, pending) {
  const total = paid + pending;
  return total > 0 ? Math.round((paid / total) * 100) : 0;
}