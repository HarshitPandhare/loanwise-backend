import { Router } from "express";
import { LoanRule } from "../models/loanRule.model";

export const seedRouter = Router();

seedRouter.post("/seed", async (_req, res) => {
  console.log("Seed route hit");

  await LoanRule.deleteMany();

await LoanRule.insertMany([
  // PERSONAL LOANS
  {
    bank: "HDFC",
    loanType: "personal",
    minAge: 21,
    minIncome: 25000,
    employment: ["salaried"],
    minCreditScore: 700,
    maxFOIR: 0.5,
    interestRate: 10.75,
    maxTenureMonths: 60,
    maxLoanAmount: 500000
  },
  {
    bank: "SBI",
    loanType: "personal",
    minAge: 21,
    minIncome: 20000,
    employment: ["salaried", "self-employed"],
    minCreditScore: 680,
    maxFOIR: 0.55,
    interestRate: 9.9,
    maxTenureMonths: 72,
    maxLoanAmount: 600000
  },

  // EDUCATION LOANS
  {
    bank: "Axis",
    loanType: "education",
    minAge: 18,
    employment: ["student"],
    minIncome: 0,
    minCreditScore: 0,
    interestRate: 8.2,
    maxTenureMonths: 120,
    maxLoanAmount: 750000
  }
]);


  res.json({ success: true });
});
