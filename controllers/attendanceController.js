import Attendance from "../models/attendanceModel.js";
import Student from "../models/studentModel.js";
import moment from "moment-timezone"; // Use moment-timezone

export const markAttendance = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findOne({ studentId }).populate(
      "classId",
      "grade section"
    );
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get current date and time in Pakistan time zone (UTC+5)
    const today = moment().tz("Asia/Karachi").format("YYYY-MM-DD");
    const formattedTime = moment().tz("Asia/Karachi").format("HH:mm:ss");

    const existingAttendance = await Attendance.findOne({
      studentId,
      date: today, // Check attendance for the current date in Pakistan time zone
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: "Attendance already marked today",
        attendance: existingAttendance,
      });
    }

    const newAttendance = new Attendance({
      studentId,
      studentName: student.name,
      className: `${student.classId.grade} - ${student.classId.section}`,
      date: today, // Save attendance for the current date in Pakistan time zone
      time: formattedTime,
      status: "Present",
    });

    await newAttendance.save();

    res.json({
      message: "Attendance marked successfully",
      attendance: newAttendance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAttendanceRecords = async (req, res) => {
  try {
    const { studentId, startDate, endDate, page = 1, limit = 10 } = req.query;
    if (!studentId)
      return res.status(400).json({ message: "Student ID is required" });

    const query = { studentId };
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate }; // Use strings directly

    const records = await Attendance.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const totalRecords = await Attendance.countDocuments(query);

    res.json({
      records,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: Number(page),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAttendanceByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { studentId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate }; // Use strings directly
    }

    console.log("Query:", query); // Debug

    const attendanceRecords = await Attendance.find(query).sort({ date: -1 });

    console.log("Records:", attendanceRecords); // Debug

    res.json(attendanceRecords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAttendanceSummary = async (req, res) => {
  try {
    // Get current date in Pakistan time zone (UTC+5)
    const currentDate = moment().tz("Asia/Karachi").format("YYYY-MM-DD");

    const totalStudents = await Student.countDocuments();

    const presentStudents = await Attendance.countDocuments({
      date: currentDate,
      status: "Present",
    });

    res.json({
      totalStudents,
      presentStudents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getScannedStudents = async (req, res) => {
  try {
    // Get current date in Pakistan time zone (UTC+5)
    const today = moment().tz("Asia/Karachi").format("YYYY-MM-DD");
    const scannedStudents = await Attendance.find({ date: today }).sort({
      time: -1,
    });

    res.json(scannedStudents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
