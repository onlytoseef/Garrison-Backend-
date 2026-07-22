import Result from "../models/resultModel.js";
import Exam from "../models/examModel.js";
import Student from "../models/studentModel.js";

// Recompute class positions for an exam: rank by obtainedMarks desc (ties share rank).
async function recalculatePositions(examId) {
  const results = await Result.find({ examId }).sort({ obtainedMarks: -1 });
  let position = 0;
  let lastScore = null;
  let seen = 0;
  for (const r of results) {
    seen += 1;
    if (r.obtainedMarks !== lastScore) {
      position = seen; // standard competition ranking (1,2,2,4)
      lastScore = r.obtainedMarks;
    }
    r.position = position;
    await r.save();
  }
}

// Enter/update marks for many students at once for one exam.
// Body: { entries: [{ studentId, marks: [{ subjectName, obtainedMarks }], remarks }] }
export const bulkEnterMarks = async (req, res) => {
  try {
    const { examId } = req.params;
    const { entries } = req.body;

    const exam = await Exam.findById(examId).lean();
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "No marks provided" });
    }

    // Map subject definitions from the exam for totals/passing marks.
    const subjectDef = {};
    exam.subjects.forEach((s) => {
      subjectDef[s.subjectName] = {
        totalMarks: s.totalMarks,
        passingMarks: s.passingMarks,
      };
    });

    for (const entry of entries) {
      if (!entry.studentId) continue;

      const marks = (entry.marks || [])
        .filter((m) => subjectDef[m.subjectName])
        .map((m) => {
          const def = subjectDef[m.subjectName];
          let obtained = parseFloat(m.obtainedMarks);
          if (isNaN(obtained) || obtained < 0) obtained = 0;
          if (obtained > def.totalMarks) obtained = def.totalMarks; // cap
          return {
            subjectName: m.subjectName,
            totalMarks: def.totalMarks,
            passingMarks: def.passingMarks,
            obtainedMarks: obtained,
          };
        });

      // Upsert by (examId, studentId). Use save() so pre-save hook runs.
      let result = await Result.findOne({ examId, studentId: entry.studentId });
      if (!result) {
        result = new Result({
          examId,
          studentId: entry.studentId,
          classId: exam.classId,
          marks,
          remarks: entry.remarks || "",
        });
      } else {
        result.marks = marks;
        if (entry.remarks !== undefined) result.remarks = entry.remarks;
      }
      await result.save();
    }

    await recalculatePositions(examId);

    res.json({ message: "Marks saved successfully", count: entries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// One student's result for one exam (report card data).
export const getStudentResult = async (req, res) => {
  try {
    const { examId, studentId } = req.params;
    const exam = await Exam.findById(examId)
      .populate("classId", "grade section")
      .lean();
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const result = await Result.findOne({ examId, studentId })
      .populate("studentId", "name studentId rollNumber guardianName photo")
      .lean();
    if (!result)
      return res.status(404).json({ message: "Result not found for this student" });

    res.json({ exam, result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Whole class result sheet for one exam + summary stats (merit list, pass/fail).
export const getClassResults = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId)
      .populate("classId", "grade section")
      .lean();
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    const results = await Result.find({ examId })
      .populate("studentId", "name studentId rollNumber")
      .sort({ position: 1, obtainedMarks: -1 })
      .lean();

    const passCount = results.filter((r) => r.isPass).length;
    const summary = {
      totalStudents: results.length,
      passCount,
      failCount: results.length - passCount,
      classAverage:
        results.length > 0
          ? Math.round(
              (results.reduce((s, r) => s + (r.percentage || 0), 0) /
                results.length) *
                100
            ) / 100
          : 0,
      highest: results.length > 0 ? results[0] : null,
    };

    res.json({ exam, results, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// All results across exams for one student (progress history).
export const getStudentAllResults = async (req, res) => {
  try {
    const { studentId } = req.params;
    const results = await Result.find({ studentId })
      .populate("examId", "name academicYear examType")
      .sort({ createdAt: -1 })
      .lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
