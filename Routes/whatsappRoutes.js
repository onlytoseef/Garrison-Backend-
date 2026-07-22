import express from "express";
import { sendClassWhatsAppMessage } from "../controllers/whatsappController.js";

const router = express.Router();

router.post("/whatsapp/class-message", sendClassWhatsAppMessage);

export default router;
