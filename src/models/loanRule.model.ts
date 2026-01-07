import mongoose from "mongoose";

const loanRuleSchema = new mongoose.Schema({
  bank: { type: String, required: true },

  // personal | home | education | vehicle | business
  loanType: { type: String, required: true },

  minAge: Number,
  maxAge: Number,
  minIncome: Number,

  employment: [String], // salaried | self-employed | student

  minCreditScore: Number,
  maxFOIR: Number, // (existing EMI / income)

  interestRate: Number,
  maxTenureMonths: Number,
  maxLoanAmount: Number
});

export const LoanRule = mongoose.model("LoanRule", loanRuleSchema);
