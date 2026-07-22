import mongoose from "mongoose";
import dotenv from "dotenv";
import Class from "./models/classModel.js";
import Student from "./models/studentModel.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/alfalahschool";

// Random data arrays
const firstNames = [
  "Ahmed", "Muhammad", "Ali", "Hassan", "Usman", "Bilal", "Hamza", "Zain",
  "Abdullah", "Ibrahim", "Ayesha", "Fatima", "Zainab", "Maryam", "Khadija",
  "Hira", "Sana", "Amina", "Rabia", "Noor", "Talha", "Saad", "Omar",
  "Yasir", "Farhan", "Asad", "Kashif", "Waqar", "Junaid", "Rizwan",
  "Anam", "Bushra", "Iqra", "Samia", "Uzma", "Nafisa", "Tahira", "Sadia",
  "Zara", "Mahnoor", "Arslan", "Danish", "Faisal", "Kamran", "Nadeem",
  "Shoaib", "Tariq", "Waheed", "Zahid", "Imran"
];

const lastNames = [
  "Khan", "Ahmed", "Ali", "Hussain", "Rana", "Sheikh", "Malik", "Butt",
  "Qureshi", "Siddiqui", "Iqbal", "Raza", "Nawaz", "Gill", "Chaudhry",
  "Aslam", "Javed", "Akram", "Bashir", "Riaz"
];

const guardianFirstNames = [
  "Muhammad", "Abdul", "Haji", "Ghulam", "Syed", "Mian", "Chaudhry",
  "Sheikh", "Malik", "Rana", "Sardar", "Hafiz", "Qari", "Maulana", "Mirza"
];

const addresses = [
  "House 12, Street 5, Mohalla Islamabad",
  "Near Jama Masjid, Gali 3, Lahore",
  "House 45, Block B, Model Town",
  "Flat 2, Al-Noor Plaza, GT Road",
  "House 78, Street 9, Satellite Town",
  "Near Govt School, Main Bazar, Rawalpindi",
  "House 23, Gali 7, Mohalla Noor",
  "Plot 56, Phase 2, Green Valley",
  "House 89, Street 12, Civil Lines",
  "Near Railway Station, Main Road",
  "House 34, Block C, Gulshan Colony",
  "Flat 5, Madina Market, College Road",
  "House 67, Gali 4, Mohalla Farooq",
  "Plot 11, Industrial Area, Faisalabad",
  "House 90, Street 1, Cantt Area"
];

const teacherNames = [
  "Mr. Asif Mehmood", "Ms. Saima Bibi", "Mr. Tariq Hussain",
  "Ms. Nazia Parveen", "Mr. Khalid Mahmood"
];

// 2 classes to create
const classesData = [
  { grade: "1", section: "A", roomNumber: "101", inCharge: teacherNames[0] },
  { grade: "2", section: "A", roomNumber: "102", inCharge: teacherNames[1] },
];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  return "03" + Math.floor(Math.random() * 10) + Math.floor(10000000 + Math.random() * 90000000);
}

function generateStudentId() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await Class.deleteMany({});
    await Student.deleteMany({});
    console.log("Cleared existing classes and students");

    // Create 2 classes
    const createdClasses = await Class.insertMany(classesData);
    console.log(`Created ${createdClasses.length} classes`);

    // Create 10 students (5 per class)
    const students = [];
    const usedIds = new Set();

    for (let i = 0; i < 10; i++) {
      const classIndex = Math.floor(i / 5); // 5 students per class
      const classObj = createdClasses[classIndex];
      const rollNumber = (i % 5) + 1;

      let studentId;
      do {
        studentId = generateStudentId();
      } while (usedIds.has(studentId));
      usedIds.add(studentId);

      const firstName = firstNames[i]; // Use unique first names
      const lastName = random(lastNames);
      const guardianFirst = random(guardianFirstNames);
      const gender = i < 5 ? "Male" : "Female"; // 5 male, 5 female

      students.push({
        studentId,
        name: `${firstName} ${lastName}`,
        classId: classObj._id,
        guardianName: `${guardianFirst} ${lastName}`,
        gender,
        guardianPhone: randomPhone(),
        address: random(addresses),
        rollNumber,
        qrCode: "", // Empty - can generate later via API
      });
    }

    await Student.insertMany(students);
    console.log(`Created ${students.length} students`);

    // Print summary
    console.log("\n--- Seed Summary ---");
    for (const cls of createdClasses) {
      const count = students.filter(s => s.classId.toString() === cls._id.toString()).length;
      console.log(`Class ${cls.grade}-${cls.section} (Room ${cls.roomNumber}): ${count} students`);
    }
    console.log("--------------------\n");
    console.log("Seeding complete!");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
