import mongoose from "mongoose";

// Grade bands (highest first). Kept here so grading is defined in one place.
const GRADE_BANDS = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B" },
  { min: 60, grade: "C" },
  { min: 50, grade: "D" },
  { min: 33, grade: "E" },
  { min: 0, grade: "F" },
];

export const gradeFor = (percentage) => {
  const band = GRADE_BANDS.find((b) => percentage >= b.min);
  return band ? band.grade : "F";
};

const markSchema = new mongoose.Schema(
  {
    subjectName: { type: String, required: true },
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, default: 33 },
    obtainedMarks: { type: Number, default: 0 },
    grade: { type: String, default: "" },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    marks: [markSchema],
    totalMarks: { type: Number, default: 0 }, // sum of subject totals
    obtainedMarks: { type: Number, default: 0 }, // sum of obtained
    percentage: { type: Number, default: 0 },
    grade: { type: String, default: "" },
    isPass: { type: Boolean, default: false },
    position: { type: Number, default: 0 }, // class rank; set by controller
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

// One result per student per exam.
resultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
resultSchema.index({ classId: 1 });

// Auto-recompute totals, per-subject grade, overall percentage/grade, pass/fail.
resultSchema.pre("save", function (next) {
  let total = 0;
  let obtained = 0;
  let allSubjectsPass = true;

  (this.marks || []).forEach((m) => {
    total += m.totalMarks || 0;
    obtained += m.obtainedMarks || 0;
    const subjPct = m.totalMarks > 0 ? (m.obtainedMarks / m.totalMarks) * 100 : 0;
    m.grade = gradeFor(subjPct);
    if ((m.obtainedMarks || 0) < (m.passingMarks || 0)) {
      allSubjectsPass = false;
    }
  });

  this.totalMarks = total;
  this.obtainedMarks = obtained;
  this.percentage = total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0;
  this.grade = gradeFor(this.percentage);
  // Pass overall only if every subject clears its own passing mark.
  this.isPass = allSubjectsPass && this.marks.length > 0;

  next();
});

export default mongoose.model("Result", resultSchema);
