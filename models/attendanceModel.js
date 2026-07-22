import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  className: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ["Present", "Absent"], default: "Absent" },
});

// Add indexes for performance optimization
attendanceSchema.index({ studentId: 1, date: 1 }); // Unique attendance per student per day
attendanceSchema.index({ date: 1 }); // Filter by date
attendanceSchema.index({ className: 1, date: 1 }); // Class attendance by date
attendanceSchema.index({ status: 1 }); // Filter by present/absent

export default mongoose.model("Attendance", attendanceSchema);
