import express from "express";
import {
  addClass,
  getAllClasses,
  getClassById,
  deleteClass,
  promoteStudents,
} from "../controllers/classController.js";

const router = express.Router();

router.post("/add-class", addClass);

router.get("/classes", getAllClasses);

router.get("/class/:id", getClassById);

router.delete("/delete-class/:id", deleteClass);

router.post("/promote-students", promoteStudents);

export default router;
