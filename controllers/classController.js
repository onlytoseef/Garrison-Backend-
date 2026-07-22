import Class from "../models/classModel.js";
import Student from "../models/studentModel.js";

// Add Class
export const addClass = async (req, res) => {
  try {
    const { grade, section, roomNumber, inCharge } = req.body;

    const newClass = new Class({
      grade,
      section,
      roomNumber,
      inCharge,
    });

    await newClass.save();
    res.status(201).json({ message: "Class added successfully", newClass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get All Classes
export const getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find().lean(); // Use lean() for better performance
    
    // Get student count for each class
    const classesWithStudentCount = await Promise.all(
      classes.map(async (classItem) => {
        const studentCount = await Student.countDocuments({ classId: classItem._id });
        return {
          ...classItem,
          studentCount,
        };
      })
    );
    
    res.json(classesWithStudentCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Class by ID with Student Details
export const getClassById = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id).lean(); // Use lean()
    if (!classData) return res.status(404).json({ message: "Class not found" });

    // Fetch students with all required fields for printing
    const students = await Student.find({ classId: req.params.id })
      .select("studentId name rollNumber gender guardianName guardianPhone")
      .lean(); // Use lean() for faster queries

    res.json({
      ...classData,
      studentCount: students.length,
      students,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Class
export const deleteClass = async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    if (!classData) return res.status(404).json({ message: "Class not found" });

    res.json({ message: "Class deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Promote Students from one class to another
export const promoteStudents = async (req, res) => {
  try {
    const { sourceClassId, destinationClassId, keepRollNumbers, excludeStudents = [] } = req.body;

    if (!sourceClassId || !destinationClassId) {
      return res.status(400).json({ message: "Source and destination class IDs are required" });
    }

    if (sourceClassId === destinationClassId) {
      return res.status(400).json({ message: "Source and destination class cannot be the same" });
    }

    // Verify both classes exist
    const [sourceClass, destClass] = await Promise.all([
      Class.findById(sourceClassId).lean(),
      Class.findById(destinationClassId).lean(),
    ]);

    if (!sourceClass) return res.status(404).json({ message: "Source class not found" });
    if (!destClass) return res.status(404).json({ message: "Destination class not found" });

    // Build filter: all students in source class except excluded ones
    const filter = { classId: sourceClassId };
    if (excludeStudents.length > 0) {
      filter._id = { $nin: excludeStudents };
    }

    const students = await Student.find(filter).select("_id name rollNumber studentId").lean();

    if (students.length === 0) {
      return res.status(400).json({ message: "No students to promote" });
    }

    // Update classId for all eligible students (keep roll numbers by default)
    const updateData = { classId: destinationClassId };

    const result = await Student.updateMany(
      { _id: { $in: students.map(s => s._id) } },
      { $set: updateData }
    );

    res.json({
      message: `Successfully promoted ${result.modifiedCount} students from ${sourceClass.grade}-${sourceClass.section} to ${destClass.grade}-${destClass.section}`,
      promotedCount: result.modifiedCount,
      totalEligible: students.length,
      excludedCount: excludeStudents.length,
      sourceClass: `${sourceClass.grade} - ${sourceClass.section}`,
      destinationClass: `${destClass.grade} - ${destClass.section}`,
    });
  } catch (err) {
    console.error("Error promoting students:", err);
    res.status(500).json({ error: err.message });
  }
};
