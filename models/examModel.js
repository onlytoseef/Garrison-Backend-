import mongoose from "mongoose";

// A single subject inside an exam (per-class). totalMarks/passingMarks are the
// definition; obtained marks live per-student in the Result model.
const examSubjectSchema = new mongoose.Schema(
  {
    subjectName: { type: String, required: true },
    totalMarks: { type: Number, required: true, default: 100 },
    passingMarks: { type: Number, required: true, default: 33 },
    date: { type: Date },
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Midterm", "Final Term"
    academicYear: { type: Number, required: true },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    examType: {
      type: String,
      enum: ["midterm", "final", "monthly-test", "other"],
      default: "midterm",
    },
    subjects: {
      type: [examSubjectSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one subject is required",
      },
    },
    // published => report cards / results are visible to view/print.
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "published"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

examSchema.index({ classId: 1, academicYear: 1 });
examSchema.index({ status: 1 });

export default mongoose.model("Exam", examSchema);
