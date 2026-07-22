import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyBNEglAo82ua9AxXuz8HATwAqlxvtG3t8w");

const generateResponse = async (req, res) => {
  try {
    const { message } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const result = await model.generateContent(message);
    const response = await result.response;

    res.json({ reply: response.text() });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "Failed to process request",
      details: error.message,
    });
  }
};

export default generateResponse;
