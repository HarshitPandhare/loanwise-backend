import { Router } from "express";

export const businessLoanRouter = Router();

interface ApplicantDetails {
  age: number;
  employmentType: "Salaried" | "Self-Employed";
  monthlyIncome: number;
  monthlyExpenses: number;
  existingEMIs: number;
  creditScore: number;
  employmentStabilityYears: number;
  residenceType: "Owned" | "Rented";
  cityType: "Metro" | "Non-Metro";
}

interface BusinessDetails {
  businessType: "Proprietorship" | "Partnership" | "Private Ltd";
  businessAgeYears: number;
  annualTurnover: number;
  netProfit: number;
}

interface LoanDetails {
  requestedLoanAmount: number;
  preferredTenureYears: number;
}

// EMI calculation function
function calculateEMI(principal: number, annualRate: number, tenureYears: number): number {
  const monthlyRate = annualRate / 12 / 100;
  const tenureMonths = tenureYears * 12;
  
  if (monthlyRate === 0) return principal / tenureMonths;
  
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / 
              (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  
  return Math.round(emi);
}

// Helper function to calculate loan amount from EMI
function calculateLoanFromEMI(emi: number, annualRate: number, tenureYears: number): number {
  const monthlyRate = annualRate / 12 / 100;
  const tenureMonths = tenureYears * 12;
  
  if (monthlyRate === 0) return emi * tenureMonths;
  
  const principal = emi * (Math.pow(1 + monthlyRate, tenureMonths) - 1) / 
                    (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));
  
  return Math.round(principal);
}

businessLoanRouter.post("/check-business-eligibility", async (req, res) => {
  try {
    const { applicantDetails, businessDetails, loanDetails }: {
      applicantDetails: ApplicantDetails;
      businessDetails: BusinessDetails;
      loanDetails: LoanDetails;
    } = req.body;

    // Basic Eligibility Rules (Hard Rejection)
    const rejectionReasons: string[] = [];

    if (applicantDetails.age < 25 || applicantDetails.age > 65) {
      rejectionReasons.push("Age not eligible (must be 25-65 years)");
    }

    if (businessDetails.businessAgeYears < 2) {
      rejectionReasons.push("Business age not eligible (minimum 2 years required)");
    }

    if (applicantDetails.creditScore < 650) {
      rejectionReasons.push("Low credit score (minimum 650 required)");
    }

    if (businessDetails.annualTurnover <= 0 || businessDetails.netProfit <= 0) {
      rejectionReasons.push("Invalid business financials");
    }

    if (rejectionReasons.length > 0) {
      return res.json({
        eligibilityStatus: "Not Eligible",
        riskScore: 0,
        approvedLoanAmount: 0,
        interestRate: 0,
        recommendedTenureYears: 0,
        estimatedMonthlyEMI: 0,
        totalPayableAmount: 0,
        remarks: rejectionReasons.join("; ")
      });
    }

    // Maximum Loan Amount Rule (25% of annual turnover)
    const maxLoanByTurnover = businessDetails.annualTurnover * 0.25;
    let approvedLoanAmount = Math.min(loanDetails.requestedLoanAmount, maxLoanByTurnover);

    // Risk Scoring System (Out of 100)
    let riskScore = 0;

    // Credit Score (25 points)
    if (applicantDetails.creditScore >= 750) {
      riskScore += 25;
    } else if (applicantDetails.creditScore >= 700) {
      riskScore += 18;
    } else {
      riskScore += 12;
    }

    // Business Age & Stability (25 points)
    if (businessDetails.businessAgeYears >= 10) {
      riskScore += 25;
    } else if (businessDetails.businessAgeYears >= 5) {
      riskScore += 20;
    } else if (businessDetails.businessAgeYears >= 3) {
      riskScore += 15;
    } else {
      riskScore += 8;
    }

    // Profitability Ratio (20 points)
    const profitMargin = businessDetails.netProfit / businessDetails.annualTurnover;
    if (profitMargin >= 0.25) {
      riskScore += 20;
    } else if (profitMargin >= 0.15) {
      riskScore += 15;
    } else if (profitMargin >= 0.10) {
      riskScore += 10;
    } else {
      riskScore += 5;
    }

    // Business Type (15 points)
    if (businessDetails.businessType === "Private Ltd") {
      riskScore += 15;
    } else if (businessDetails.businessType === "Partnership") {
      riskScore += 12;
    } else {
      riskScore += 8;
    }

    // Turnover Level (15 points)
    if (businessDetails.annualTurnover >= 10000000) {
      riskScore += 15;
    } else if (businessDetails.annualTurnover >= 5000000) {
      riskScore += 12;
    } else if (businessDetails.annualTurnover >= 2000000) {
      riskScore += 8;
    } else {
      riskScore += 4;
    }

    // Eligibility Decision
    let eligibilityStatus: string;
    if (riskScore >= 75) {
      eligibilityStatus = "Eligible";
    } else if (riskScore >= 60) {
      eligibilityStatus = "Conditionally Eligible";
    } else {
      eligibilityStatus = "Not Eligible";
    }

    // Interest Rate Assignment
    const baseInterestRate = 13.0;
    let interestRate = baseInterestRate;

    if (applicantDetails.creditScore >= 750) {
      interestRate -= 1.0;
    } else if (applicantDetails.creditScore >= 700) {
      interestRate -= 0.5;
    }

    if (businessDetails.businessAgeYears > 5) {
      interestRate -= 0.5;
    }

    if (businessDetails.businessType === "Private Ltd") {
      interestRate -= 0.25;
    }

    if (eligibilityStatus === "Not Eligible") {
      return res.json({
        eligibilityStatus: "Not Eligible",
        riskScore,
        approvedLoanAmount: 0,
        interestRate: 0,
        recommendedTenureYears: 0,
        estimatedMonthlyEMI: 0,
        totalPayableAmount: 0,
        remarks: "Application does not meet minimum risk criteria"
      });
    }

    // Tenure Recommendation (3-10 years for business loans)
    let recommendedTenureYears = Math.min(Math.max(loanDetails.preferredTenureYears, 1), 10);

    // EMI Burden & Repayment Capacity Check (60% of net profit)
    const monthlyNetProfit = businessDetails.netProfit / 12;
    const allowedEMI = 0.60 * monthlyNetProfit;
    
    let estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, recommendedTenureYears);
    
    // Check if EMI exceeds profit capacity
    if (estimatedMonthlyEMI > allowedEMI) {
      // Reduce loan amount to fit profit capacity
      if (allowedEMI <= 0) {
        return res.json({
          eligibilityStatus: "Not Eligible",
          riskScore,
          approvedLoanAmount: 0,
          interestRate: 0,
          recommendedTenureYears: 0,
          estimatedMonthlyEMI: 0,
          totalPayableAmount: 0,
          remarks: "Insufficient business profit to service loan EMI"
        });
      }
      
      const maxAffordableLoan = calculateLoanFromEMI(allowedEMI, interestRate, recommendedTenureYears);
      approvedLoanAmount = Math.min(approvedLoanAmount, maxAffordableLoan);
      estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, recommendedTenureYears);
      
      if (approvedLoanAmount < loanDetails.requestedLoanAmount * 0.6) {
        eligibilityStatus = "Conditionally Eligible";
      }
    }

    const totalPayableAmount = estimatedMonthlyEMI * recommendedTenureYears * 12;

    // Generate remarks
    let remarks: string;
    if (eligibilityStatus === "Eligible") {
      remarks = `Eligible based on business performance and ${businessDetails.businessAgeYears} years of business experience`;
    } else if (eligibilityStatus === "Conditionally Eligible") {
      remarks = "Eligible with reduced loan amount due to profit capacity or risk factors";
    } else {
      remarks = "Application does not meet risk criteria";
    }

    res.json({
      eligibilityStatus,
      riskScore,
      approvedLoanAmount: Math.round(approvedLoanAmount),
      interestRate: Number(interestRate.toFixed(2)),
      recommendedTenureYears,
      estimatedMonthlyEMI: Math.round(estimatedMonthlyEMI),
      totalPayableAmount: Math.round(totalPayableAmount),
      remarks
    });

  } catch (error) {
    console.error("Business loan eligibility check error:", error);
    res.status(500).json({ error: "Failed to check business loan eligibility" });
  }
});