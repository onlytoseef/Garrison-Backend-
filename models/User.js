import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" },
});

// Add indexes for performance optimization
userSchema.index({ email: 1 }, { unique: true }); // Email lookup (login)
userSchema.index({ role: 1 }); // Filter by role

export default mongoose.model("User", userSchema);
