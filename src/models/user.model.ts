import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true
  },
  firstName: String,
  lastName: String,
  fullName: String,

  // Financial Profile Fields
  age: { type: Number },
  phone: { type: String },
  address: { type: String },
  employmentStatus: { type: String, enum: ['Salaried', 'Self-Employed', 'Unemployed', 'Student', 'Retired', ''] },
  monthlyIncome: { type: Number },
  incomeSource: { type: String },
  existingEMI: { type: Number, default: 0 },
  creditScore: { type: Number },

  // Profile Completion Status
  isComplete: {
    type: Boolean,
    default: false
  },

  // Additional user data
  loanHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanApplication'
  }],
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);