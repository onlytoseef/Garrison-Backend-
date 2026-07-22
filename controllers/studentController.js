import fs from "fs";
import path from "path";
import os from "os";
import mongoose from "mongoose";
import QRCode from "qrcode";
import Student from "../models/studentModel.js";
import Class from "../models/classModel.js";

const generateStudentId = () =>
  Math.floor(10000 + Math.random() * 90000).toString();

export const addStudent = async (req, res) => {
  try {
    const { name, classId, guardianName, gender, guardianPhone, address } = req.body;

    // Validate classId as string
    const classExists = await Class.findById(classId);
    if (!classExists)
      return res.status(400).json({ message: "Invalid Class ID" });

    const lastStudent = await Student.findOne({ classId: classExists._id })
      .sort({ rollNumber: -1 })
      .limit(1);
    const nextRollNumber = lastStudent ? lastStudent.rollNumber + 1 : 1;

    const studentId = generateStudentId();

    // Use a writable directory for QR codes (for Vercel/serverless)
    const qrCodeDir = process.env.QR_CODE_DIR || os.tmpdir();
    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir, { recursive: true });
    }
    const qrCodePath = path.join(qrCodeDir, `${studentId}.png`);
    await QRCode.toFile(qrCodePath, studentId);

    // For serverless, return the QR code as a base64 string
    const qrCodeData = fs.readFileSync(qrCodePath);
    const qrCodeBase64 = `data:image/png;base64,${qrCodeData.toString('base64')}`;

    const newStudent = new Student({
      studentId,
      name,
      classId: classExists._id,
      guardianName,
      gender,
      guardianPhone,
      address,
      rollNumber: nextRollNumber,
      qrCode: qrCodeBase64, // Store base64 string or handle as needed
      photo: req.file ? `/uploads/students/${req.file.filename}` : "",
    });

    await newStudent.save();
    res.status(201).json({
      message: "Student added successfully",
      student: newStudent,
      qrCodeUrl: qrCodeBase64,
    });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({
      studentId: req.params.id,
    })
      .populate("classId", "grade section")
      .lean(); // Use lean() for better performance
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllStudents = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Default 50 students per page for performance
    const skip = (page - 1) * limit;
    
    // Search query
    const search = req.query.search || '';
    const searchQuery = search 
      ? { 
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { studentId: { $regex: search, $options: 'i' } },
            { guardianPhone: { $regex: search, $options: 'i' } }
          ]
        }
      : {};

    // Class filter
    if (req.query.classId) {
      searchQuery.classId = new mongoose.Types.ObjectId(req.query.classId);
    }

    // Use aggregation to include pending voucher counts
    const aggregationPipeline = [
      { $match: searchQuery },
      {
        $addFields: {
          pendingVouchers: {
            $size: {
              $filter: {
                input: { $ifNull: ["$feeHistory", []] },
                as: "fee",
                cond: { $eq: ["$$fee.isPaid", false] }
              }
            }
          },
          totalVouchers: { $size: { $ifNull: ["$feeHistory", []] } }
        }
      },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "classId"
        }
      },
      { $unwind: { path: "$classId", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          qrCode: 0,
          feeHistory: 0
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const [students, totalResult] = await Promise.all([
      Student.aggregate(aggregationPipeline),
      Student.countDocuments(searchQuery)
    ]);

    res.json({
      students,
      pagination: {
        total: totalResult,
        page,
        limit,
        pages: Math.ceil(totalResult / limit),
        hasMore: skip + students.length < totalResult
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { name, classId, guardianName, gender, guardianPhone, address } = req.body;

    const updateData = { name, classId, guardianName, gender, guardianPhone, address };
    // Only overwrite the photo when a new file was uploaded; otherwise keep the existing one.
    if (req.file) {
      updateData.photo = `/uploads/students/${req.file.filename}`;
    }

    const updatedStudent = await Student.findOneAndUpdate(
      { studentId: req.params.id },
      updateData,
      { new: true }
    );

    if (!updatedStudent)
      return res.status(404).json({ message: "Student not found" });
    res.json({
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({
      studentId: req.params.id,
    });
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTotalStudents = async (req, res) => {
  try {
    const total = await Student.countDocuments();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get QR Code for a specific student (lazy loading)
export const getStudentQRCode = async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.id })
      .select('studentId name qrCode')
      .lean();
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    if (!student.qrCode) {
      return res.status(404).json({ message: "QR code not found for this student" });
    }
    
    res.json({ 
      studentId: student.studentId,
      name: student.name,
      qrCode: student.qrCode 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate QR codes for existing students without QR codes
export const generateMissingQRCodes = async (req, res) => {
  try {
    // Find students without QR codes
    const studentsWithoutQR = await Student.find({
      $or: [
        { qrCode: { $exists: false } },
        { qrCode: "" },
        { qrCode: null }
      ]
    });

    if (studentsWithoutQR.length === 0) {
      return res.json({ message: "All students already have QR codes", count: 0 });
    }

    let updatedCount = 0;
    const qrCodeDir = process.env.QR_CODE_DIR || os.tmpdir();
    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir, { recursive: true });
    }

    for (const student of studentsWithoutQR) {
      try {
        const qrCodePath = path.join(qrCodeDir, `${student.studentId}.png`);
        await QRCode.toFile(qrCodePath, student.studentId);
        
        const qrCodeData = fs.readFileSync(qrCodePath);
        const qrCodeBase64 = `data:image/png;base64,${qrCodeData.toString('base64')}`;
        
        student.qrCode = qrCodeBase64;
        await student.save();
        updatedCount++;
      } catch (error) {
        console.error(`Failed to generate QR for student ${student.studentId}:`, error);
      }
    }

    res.json({ 
      message: `QR codes generated successfully for ${updatedCount} students`,
      count: updatedCount,
      total: studentsWithoutQR.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
