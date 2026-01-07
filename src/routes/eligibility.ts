import { Router } from "express";
import { LoanRule } from "../models/loanRule.model";

export const eligibilityRouter = Router();

eligibilityRouter.post("/check-eligibility", async (req, res) => {
  const { age, income, employment, creditScore, loanType, existingEMI = 0 } =
    req.body;

  // Fetch rules for selected loan category
  const rules = await LoanRule.find({ loanType });

  let eligibleBanks: any[] = [];

  rules.forEach((rule: any) => {
    const foir = existingEMI / income; // EMI burden ratio

    const isEligible =
      (!rule.minAge || age >= rule.minAge) &&
      (!rule.maxAge || age <= rule.maxAge) &&
      (!rule.minIncome || income >= rule.minIncome) &&
      (!rule.employment || rule.employment.includes(employment)) &&
      (!rule.minCreditScore || creditScore >= rule.minCreditScore) &&
      (!rule.maxFOIR || foir <= rule.maxFOIR);

    if (isEligible) {
      eligibleBanks.push({
        bank: rule.bank,
        loanType: rule.loanType,
        interestRate: rule.interestRate,
        maxAmount: rule.maxLoanAmount,
        tenure: rule.maxTenureMonths
      });
    }
  });

  res.json({
    eligibleBanks,
    eligibleCount: eligibleBanks.length
  });
});
