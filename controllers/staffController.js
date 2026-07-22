import moment from "moment";
import Staff from "../models/staffModel.js";

export const addStaff = async (req, res) => {
  try {
    const { name, phone, address, education, role, salary } = req.body;
    const newStaff = new Staff({
      name,
      phone,
      address,
      education,
      role,
      salary,
    });
    await newStaff.save();
    res
      .status(201)
      .json({ message: "Staff added successfully", staff: newStaff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedStaff = await Staff.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updatedStaff)
      return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff updated successfully", staff: updatedStaff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedStaff = await Staff.findByIdAndDelete(id);
    if (!deletedStaff)
      return res.status(404).json({ message: "Staff not found" });
    res.json({ message: "Staff deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find().lean(); // Use lean() for better performance
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const paySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { month, year, amount } = req.body;

    // Validate input
    if (!month || !year || !amount) {
      return res.status(400).json({
        success: false,
        message: "Month, year and amount are required fields",
      });
    }

    if (isNaN(month) || isNaN(year) || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: "Month, year and amount must be valid numbers",
      });
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    // Find staff member
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    if (paymentAmount > staff.salary) {
      return res.status(400).json({
        success: false,
        message: `Amount cannot exceed the base salary of Rs. ${staff.salary}`,
      });
    }

    // Check for duplicate salary payment
    const existingPayment = staff.salaryHistory.find(
      (payment) =>
        payment.month === parseInt(month) && payment.year === parseInt(year)
    );

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Salary for this month/year already processed",
        payment: existingPayment,
      });
    }

    // Create new salary payment
    const newPayment = {
      month: parseInt(month),
      year: parseInt(year),
      amount: paymentAmount,
      isPaid: true,
      paymentDate: new Date(),
    };

    staff.salaryHistory.push(newPayment);
    await staff.save();

    // Return success response
    res.status(200).json({
      success: true,
      message: "Salary paid successfully",
      staffId: staff._id,
      staffName: staff.name,
      payment: newPayment,
      totalPayments: staff.salaryHistory.length,
    });
  } catch (error) {
    console.error("Salary payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process salary payment",
      error: error.message,
    });
  }
};

export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findById(id);
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getTotalStaffCount = async (req, res) => {
  try {
    const count = await Staff.countDocuments({});
    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMonthlySalarySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const currentMonth = month || moment().month() + 1;
    const currentYear = year || moment().year();

    const staffMembers = await Staff.find();

    let totalSalaryPaid = 0;
    let totalSalaryPending = 0;
    let paidStaffCount = 0;
    let pendingStaffCount = 0;

    staffMembers.forEach((staff) => {
      const paidThisMonth = staff.salaryHistory
        .filter(
          (record) =>
            record.month == currentMonth &&
            record.year == currentYear &&
            record.isPaid
        )
        .reduce((sum, record) => sum + (record.amount || 0), 0);

      totalSalaryPaid += paidThisMonth;
      totalSalaryPending += Math.max(staff.salary - paidThisMonth, 0);

      if (paidThisMonth >= staff.salary) {
        paidStaffCount++;
      } else {
        pendingStaffCount++;
      }
    });

    res.json({
      paidSalary: totalSalaryPaid,
      pendingSalary: totalSalaryPending,
      paidStaffCount,
      pendingStaffCount,
      month: parseInt(currentMonth),
      year: parseInt(currentYear),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCurrentMonthSalarySummary = async (req, res) => {
  try {
    const currentMonth = moment().month() + 1; // JavaScript months are 0-11
    const currentYear = moment().year();

    const staffMembers = await Staff.find();

    let totalPaid = 0;
    let totalPending = 0;
    let paidStaffCount = 0;
    let pendingStaffCount = 0;

    staffMembers.forEach((staff) => {
      const paidThisMonth = staff.salaryHistory
        .filter(
          (record) =>
            record.month === currentMonth &&
            record.year === currentYear &&
            record.isPaid
        )
        .reduce((sum, record) => sum + (record.amount || 0), 0);

      totalPaid += paidThisMonth;
      totalPending += Math.max(staff.salary - paidThisMonth, 0);

      if (paidThisMonth >= staff.salary) {
        paidStaffCount++;
      } else {
        pendingStaffCount++;
      }
    });

    res.json({
      success: true,
      currentMonth,
      currentYear,
      totalPaid,
      totalPending,
      paidStaffCount,
      pendingStaffCount,
      monthName: moment().format("MMMM"),
    });
  } catch (error) {
    console.error("Salary summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get current month salary summary",
      error: error.message,
    });
  }
};
