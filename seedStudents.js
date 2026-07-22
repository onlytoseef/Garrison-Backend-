import mongoose from "mongoose";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import models
import Student from "./models/studentModel.js";
import Class from "./models/classModel.js";

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/alfalah-school", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// Random data generators
const firstNames = [
  "Muhammad", "Ahmed", "Ali", "Usman", "Hassan", "Hussain", "Hamza", "Bilal", "Abdullah", "Omar",
  "Fatima", "Ayesha", "Zainab", "Mariam", "Khadija", "Hafsa", "Aisha", "Ruqayyah", "Sara", "Zara",
  "Amna", "Hina", "Noor", "Laiba", "Maha", "Rabia", "Sana", "Aliza", "Hira", "Iqra",
  "Usama", "Faisal", "Kamran", "Tariq", "Asad", "Saad", "Shahid", "Waleed", "Zubair", "Farhan"
];

const lastNames = [
  "Khan", "Ahmed", "Ali", "Hussain", "Shah", "Malik", "Siddiqui", "Qureshi", "Sheikh", "Butt",
  "Rizvi", "Zaidi", "Raza", "Mirza", "Javed", "Nawaz", "Iqbal", "Haider", "Abbas", "Akbar",
  "Rashid", "Mahmood", "Karim", "Saleem", "Tariq", "Yousaf", "Aziz", "Hameed", "Jamil", "Latif"
];

const guardianNames = [
  "Mr. Abdul Rahman", "Mr. Khalid Mahmood", "Mr. Tariq Aziz", "Mr. Rashid Ali", "Mr. Imran Khan",
  "Mr. Asif Nawaz", "Mr. Zahid Iqbal", "Mr. Kamran Shah", "Mr. Farooq Ahmed", "Mr. Nadeem Malik",
  "Mr. Shahid Hussain", "Mr. Javed Qureshi", "Mr. Aamir Siddiqui", "Mr. Waqar Sheikh", "Mr. Salman Butt",
  "Mr. Faisal Raza", "Mr. Akram Mirza", "Mr. Naveed Haider", "Mr. Zubair Abbas", "Mr. Arshad Karim"
];

const addresses = [
  "House #12, Street 5, Model Town", "Flat 3B, Block C, Johar Town", "Plot 45, Sector 7, Bahria Town",
  "House 234, Garden Town", "Apartment 12, Gulberg III", "Villa 8, DHA Phase 5", "House 67, Cavalry Ground",
  "Flat 2A, Askari 11", "Plot 123, Wapda Town", "House 45, Cantt Area", "Block D, Iqbal Town",
  "Street 3, Faisal Town", "House 89, Samanabad", "Flat 5C, Gulshan-e-Ravi", "Plot 234, Punjab Society",
  "House 12, Muslim Town", "Block F, Green Town", "Street 7, Allama Iqbal Town", "House 56, Township",
  "Flat 4B, Valencia Town", "Plot 78, Lake City", "House 90, EME Society", "Block A, Tech Society"
];

const generatePhoneNumber = () => {
  const prefixes = ["0300", "0301", "0302", "0303", "0304", "0305", "0321", "0322", "0323", "0333", "0334", "0335"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(1000000 + Math.random() * 9000000);
  return `${prefix}${number}`;
};

const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

const getRandomGender = () => (Math.random() > 0.5 ? "Male" : "Female");

const getRandomAge = () => Math.floor(Math.random() * 12) + 5; // Age between 5-16

const getRandomRollNumber = () => Math.floor(Math.random() * 99) + 1;

// Generate QR Code as base64
const generateQRCode = async (studentId) => {
  try {
    const uploadsDir = path.join(__dirname, "uploads", "qrcodes");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const qrPath = path.join(uploadsDir, `${studentId}.png`);
    await QRCode.toFile(qrPath, studentId);

    const qrBuffer = fs.readFileSync(qrPath);
    const base64QR = `data:image/png;base64,${qrBuffer.toString("base64")}`;

    // Clean up file
    fs.unlinkSync(qrPath);

    return base64QR;
  } catch (error) {
    console.error("Error generating QR code:", error);
    return "";
  }
};

// Seed students
const seedStudents = async () => {
  try {
    console.log("🔄 Starting student seeding process...");

    // Get all classes
    const classes = await Class.find({});
    
    if (classes.length === 0) {
      console.log("⚠️ No classes found. Please create classes first!");
      return;
    }

    console.log(`📚 Found ${classes.length} classes`);

    // Check existing students count
    const existingCount = await Student.countDocuments();
    console.log(`📊 Current students in database: ${existingCount}`);

    const studentsToAdd = 1500;
    const students = [];

    console.log(`\n🚀 Generating ${studentsToAdd} random students...\n`);

    for (let i = 1; i <= studentsToAdd; i++) {
      const firstName = getRandomItem(firstNames);
      const lastName = getRandomItem(lastNames);
      const name = `${firstName} ${lastName}`;
      const gender = getRandomGender();
      const age = getRandomAge();
      const classData = getRandomItem(classes);
      const studentId = `ALF-${Date.now()}-${i}`;

      // Generate QR code
      const qrCode = await generateQRCode(studentId);

      const student = {
        name,
        studentId,
        classId: classData._id,
        age,
        gender,
        guardianName: getRandomItem(guardianNames),
        guardianPhone: generatePhoneNumber(),
        address: getRandomItem(addresses),
        rollNumber: getRandomRollNumber(),
        qrCode,
        monthlyFee: classData.monthlyFee || 1500,
        admissionFee: classData.admissionFee || 5000,
        status: "Active",
        admissionDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      };

      students.push(student);

      // Show progress every 100 students
      if (i % 100 === 0) {
        console.log(`✅ Generated ${i}/${studentsToAdd} students...`);
      }
    }

    // Insert all students
    console.log("\n💾 Inserting students into database...");
    await Student.insertMany(students);

    const finalCount = await Student.countDocuments();
    console.log(`\n✅ Successfully added ${studentsToAdd} students!`);
    console.log(`📊 Total students in database: ${finalCount}`);
    console.log("\n🎉 Seeding completed successfully!");

  } catch (error) {
    console.error("❌ Error seeding students:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
};

// Run the seeder
const run = async () => {
  await connectDB();
  await seedStudents();
};

run();
