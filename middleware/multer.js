import multer from "multer";
import fs from "fs";

const uploadDir = "uploads/students";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Derive extension from mimetype so camera blobs (generic originalname) get a
    // proper name, and add a random suffix to avoid same-millisecond collisions.
    const ext = (file.mimetype && file.mimetype.split("/")[1]) || "jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`);
  },
});

// Only accept images, cap size at 5 MB.
const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

