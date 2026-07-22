import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    receivedBy: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Cheque", "Online Payment", "Other"],
      default: "Cash",
    },
    referenceNumber: { type: String },
    remarks: { type: String },
  },
  { _id: false }
);

const feeSchema = new mongoose.Schema(
  {
    feeType: {
      type: String,
      enum: ["admission", "monthly", "annual"],
      required: true,
    },
    amount: { type: Number, required: true },
    details: {
      admissionFee: { type: Number, default: 0 },
      annualCharges: { type: Number, default: 0 },
      securityCard: { type: Number, default: 0 },
      paperFund: { type: Number, default: 0 },
      monthlyFee: { type: Number, default: 0 },
      monthlyFeeMonth: { type: Number },
      monthlyFeeYear: { type: Number },
      otherDues: { type: Number, default: 0 },
    },
    month: { type: Number, min: 1, max: 12 },
    year: { type: Number },
    isPaid: { type: Boolean, default: false },
    paymentDate: { type: Date },
    voucherNumber: { type: String, required: true },
    linkedAdmissionVoucher: { type: String },
    partialPayments: [paymentSchema],
    paidAmount: { type: Number, default: 0 },
    remainingAmount: {
      type: Number,
      default: function () {
        return this.amount;
      },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    guardianName: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    photo: { type: String, default: "" },
    guardianPhone: { type: String, required: true },
    address: { type: String, required: true },
    rollNumber: { type: Number, default: 1 },
    qrCode: { type: String, default: "" },
    feeHistory: [feeSchema],
  },
  { timestamps: true }
);

// Add a pre-save hook to update remaining amount
studentSchema.pre("save", function (next) {
  if (this.feeHistory && this.feeHistory.length > 0) {
    this.feeHistory.forEach((fee) => {
      fee.remainingAmount = fee.amount - fee.paidAmount;
      fee.isPaid = fee.remainingAmount <= 0;
      if (fee.isPaid && !fee.paymentDate) {
        fee.paymentDate = new Date();
      }
    });
  }
  next();
});

studentSchema.methods.recordPartialPayment = async function (
  voucherNumber,
  paymentData
) {
  const fee = this.feeHistory.find((f) => f.voucherNumber === voucherNumber);
  if (!fee) {
    throw new Error("Voucher not found");
  }

  if (fee.remainingAmount <= 0) {
    throw new Error("This voucher is already fully paid");
  }

  if (paymentData.amount > fee.remainingAmount) {
    throw new Error(
      `Payment amount exceeds remaining balance of ${fee.remainingAmount}`
    );
  }

  fee.partialPayments.push(paymentData);
  fee.paidAmount += paymentData.amount;
  fee.remainingAmount = fee.amount - fee.paidAmount;

  if (fee.remainingAmount <= 0) {
    fee.isPaid = true;
    fee.paymentDate = new Date();
  }

  await this.save();
  return this;
};

// Add indexes for performance optimization
studentSchema.index({ studentId: 1 }); // Unique student ID lookup
studentSchema.index({ classId: 1 }); // Class-based filtering
studentSchema.index({ name: 'text' }); // Text search on name
studentSchema.index({ guardianPhone: 1 }); // Search by phone
studentSchema.index({ createdAt: -1 }); // Sort by newest first
studentSchema.index({ classId: 1, name: 1 }); // Compound index for class + name queries

// Indexes for fee history queries
studentSchema.index({ 'feeHistory.voucherNumber': 1 }); // Find by voucher number
studentSchema.index({ 'feeHistory.isPaid': 1 }); // Filter paid/unpaid
studentSchema.index({ 'feeHistory.year': 1, 'feeHistory.month': 1 }); // Monthly fee queries
studentSchema.index({ 'feeHistory.feeType': 1 }); // Filter by fee type

export default mongoose.model("Student", studentSchema);
