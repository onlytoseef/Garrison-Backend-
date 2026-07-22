import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./Routes/authRoutes.js";
import userRoutes from "./Routes/userRoutes.js";
import classRoutes from "./Routes/classRoutes.js";
import studentRoutes from "./Routes/studentRoutes.js";
import staffRoutes from "./Routes/staffRoutes.js";
import attendanceRoutes from "./Routes/attendanceRoutes.js";
import dashboardRoutes from "./Routes/dashboardRoutes.js";
import chatRoutes from "./Routes/chatRoute.js";
import studentFeeRoutes from "./Routes/studentFeeRoutes.js";
import whatsappRoutes from "./Routes/whatsappRoutes.js";
import examRoutes from "./Routes/examRoutes.js";
import resultRoutes from "./Routes/resultRoutes.js";
import path from "path";
import cors from "cors";
dotenv.config();

const port = process.env.PORT || 5000;
const app = express();
const __dirname = path.resolve();

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/qrcodes", express.static(path.join(__dirname, "public", "qrcodes")));

app.use(express.json());
app.use(cors({ origin: "*" }));

// MongoDB connection - supports both local and cloud
const MONGODB_URI = process.env.MONGODB_URI

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB Connected to Database"))
  .catch((err) => console.log(err));

app.use("/api/auth", authRoutes);
app.use("/api", classRoutes);
app.use("/api", studentRoutes);
app.use("/api", staffRoutes);
app.use("/api", attendanceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/", dashboardRoutes);
app.use("/api/student-fee", studentFeeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api", whatsappRoutes);
app.use("/api", examRoutes);
app.use("/api", resultRoutes);
app.get("/",(req,res)=>{res.send(
  "Hello from server" 
)})
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
