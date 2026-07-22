import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import mongoose from "mongoose";
import Student from "./models/studentModel.js"; 
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/alfalah-school", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Ensure the qrcodes directory exists
const qrCodeDir = path.join(process.cwd(), "public", "qrcodes");
if (!fs.existsSync(qrCodeDir)) {
  fs.mkdirSync(qrCodeDir, { recursive: true });
  console.log("Created qrcodes directory");
}

const regenerateQRCodes = async () => {
  try {
    // Fetch all students
    const students = await Student.find();

    if (students.length === 0) {
      console.log("No students found in the database");
      return;
    }

    console.log(`Found ${students.length} students`);

    // Iterate through students and regenerate QR codes
    for (const student of students) {
      const qrCodePath = path.join(qrCodeDir, `${student.studentId}.png`);
      const qrCodeRelativePath = `/qrcodes/${student.studentId}.png`;

      // Generate QR code if it doesn't exist
      if (!fs.existsSync(qrCodePath)) {
        await QRCode.toFile(qrCodePath, student.studentId);
        console.log(`Generated QR code for student ${student.studentId} at ${qrCodePath}`);
      } else {
        console.log(`QR code already exists for student ${student.studentId}`);
      }

      // Update student's qrCode field if it's missing or incorrect
      if (!student.qrCode || student.qrCode !== qrCodeRelativePath) {
        student.qrCode = qrCodeRelativePath;
        await student.save();
        console.log(`Updated qrCode field for student ${student.studentId}`);
      }
    }

    console.log("QR code regeneration completed successfully");
  } catch (err) {
    console.error("Error regenerating QR codes:", err.message);
  } finally {
    mongoose.connection.close();
  }
};

// Run the script
regenerateQRCodes();