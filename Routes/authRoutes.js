import express from "express";
import {
  loginUser,
  registerUser,
  updatePassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.post("/update-password", updatePassword);

export default router;
