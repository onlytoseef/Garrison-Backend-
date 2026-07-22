import path from "path";
import puppeteer from "puppeteer";
import Student from "../models/studentModel.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePhone = (phone) => {
  if (!phone) return "";
  const digitsOnly = String(phone).replace(/\D/g, "");
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return `92${digitsOnly.slice(1)}`;
  }
  return digitsOnly;
};

const waitForMessageBox = async (page) => {
  const selectors = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][data-tab="1"]',
  ];

  for (const selector of selectors) {
    try {
      const handle = await page.waitForSelector(selector, { timeout: 15000 });
      if (handle) return handle;
    } catch {
      // Try next selector
    }
  }

  return null;
};

export const sendClassWhatsAppMessage = async (req, res) => {
  try {
    const { classId, message, delayMs = 3000 } = req.body;

    if (!classId || !message) {
      return res.status(400).json({ message: "Class ID and message are required" });
    }

    const students = await Student.find({ classId }).lean();
    if (!students.length) {
      return res.status(404).json({ message: "No students found for this class" });
    }

    const phoneNumbers = students
      .map((s) => normalizePhone(s.guardianPhone))
      .filter((p) => p);

    if (!phoneNumbers.length) {
      return res.status(400).json({ message: "No valid phone numbers found for this class" });
    }

    const sessionDir = path.join(process.cwd(), "whatsapp-session");
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir: sessionDir,
    });

    let sent = 0;
    const failed = [];

    for (const phone of phoneNumbers) {
      const page = await browser.newPage();
      try {
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });

        await delay(2000);
        const box = await waitForMessageBox(page);

        if (!box) {
          failed.push({ phone, error: "WhatsApp not authenticated or message box not found. Please login to WhatsApp Web first." });
          await delay(delayMs);
          continue;
        }

        await box.click();
        await page.keyboard.press("Enter");
        sent += 1;
      } catch (error) {
        failed.push({ phone, error: error.message });
      } finally {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch {
          // Ignore close errors from already-closed targets
        }
      }

      await delay(delayMs);
    }

    await browser.close();

    res.json({
      message: "Message send completed",
      total: phoneNumbers.length,
      sent,
      failed,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
