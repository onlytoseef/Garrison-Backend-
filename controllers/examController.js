import Exam from "../models/examModel.js";
import Result from "../models/resultModel.js";
import Class from "../models/classModel.js";

// Create a new exam for a class with its subjects.
export const createExam = async (req, res) => {
  try {
    const { name, academicYear, classId, examType, subjects } = req.body;

    if (!name || !academicYear || !classId) {
      return res
        .status(400)
        .json({ message: "Name, academic year and class are required" });
    }
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: "At least one subject is required" });
    }

    const classExists = await Class.findById(classId);
    if (!classExists) return res.status(400).json({ message: "Invalid Class ID" });

    const normalizedSubjects = subjects.map((s) => ({
      subjectName: s.subjectName,
      totalMarks: parseFloat(s.totalMarks) || 100,
      passingMarks: parseFloat(s.passingMarks) || 33,
      date: s.date || undefined,
    }));

    const exam = new Exam({
      name,
      academicYear: parseInt(academicYear),
      classId,
      examType: examType || "midterm",
      subjects: normalizedSubjects,
    });

    await exam.save();
    res.status(201).json({ message: "Exam created successfully", exam });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// List exams, optional filters by class / academicYear.
export const getExams = async (req, res) => {
  try {
    const { classId, academicYear } = req.query;
    const filter = {};
    if (classId) filter.classId = classId;
    if (academicYear) filter.academicYear = parseInt(academicYear);

    const exams = await Exam.find(filter)
      .populate("classId", "grade section")
      .sort({ createdAt: -1 })
      .lean();

    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate("classId", "grade section")
      .lean();
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update exam meta / subjects. Blocked once published to protect entered marks.
export const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    if (exam.status === "published") {
      return res
        .status(400)
        .json({ message: "Cannot edit a published exam. Unpublish first." });
    }

    const { name, academicYear, examType, subjects, status } = req.body;
    if (name !== undefined) exam.name = name;
    if (academicYear !== undefined) exam.academicYear = parseInt(academicYear);
    if (examType !== undefined) exam.examType = examType;
    if (status !== undefined) exam.status = status;
    if (Array.isArray(subjects) && subjects.length > 0) {
      exam.subjects = subjects.map((s) => ({
        subjectName: s.subjectName,
        totalMarks: parseFloat(s.totalMarks) || 100,
        passingMarks: parseFloat(s.passingMarks) || 33,
        date: s.date || undefined,
      }));
    }

    await exam.save();
    res.json({ message: "Exam updated successfully", exam });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Toggle publish state. Recomputes positions when publishing.
export const publishExam = async (req, res) => {
  try {
    const { publish } = req.body; // true => publish, false => unpublish
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    exam.status = publish ? "published" : "scheduled";
    await exam.save();

    res.json({
      message: publish ? "Results published" : "Results unpublished",
      exam,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete exam and its results together.
export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    await Result.deleteMany({ examId: req.params.id });
    res.json({ message: "Exam and its results deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
