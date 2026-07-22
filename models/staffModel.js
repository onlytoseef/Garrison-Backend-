import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    education: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "admin",
        "principal",
        "teacher",
        "security guard",
        "peon",
        "others",
      ],
      required: true,
    },
    salary: { type: Number, required: true },
    salaryHistory: [
      {
        month: { type: Number, required: true },
        year: { type: Number, required: true },
        amount: { type: Number, required: true },
        isPaid: { type: Boolean, default: false },
        paymentDate: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

// Add indexes for performance optimization
staffSchema.index({ name: 'text' }); // Text search on name
staffSchema.index({ phone: 1 }); // Search by phone number
staffSchema.index({ role: 1 }); // Filter by role
staffSchema.index({ createdAt: -1 }); // Sort by newest first
staffSchema.index({ 'salaryHistory.isPaid': 1 }); // Filter paid/unpaid salaries
staffSchema.index({ 'salaryHistory.year': 1, 'salaryHistory.month': 1 }); // Monthly salary queries

export default mongoose.model("Staff", staffSchema);
