import mongoose from "mongoose";

const classSchema = new mongoose.Schema({
  grade: { type: String, required: true },
  section: { type: String, required: true },
  roomNumber: { type: String, required: true },
  inCharge: { type: String, required: true },
  studentCount: { type: Number, default: 0 },
});

// Add indexes for performance optimization
classSchema.index({ grade: 1, section: 1 }, { unique: true }); // Unique class lookup
classSchema.index({ grade: 1 }); // Filter by grade
classSchema.index({ inCharge: 1 }); // Filter by teacher

export default mongoose.model("Class", classSchema);
