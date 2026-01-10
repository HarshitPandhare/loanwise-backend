import { Router } from "express";

export const personalLoanRouter = Router();

// Test endpoint
personalLoanRouter.get("/test-personal", (req, res) => {
  res.json({ 
    message: "Personal loan API is working!", 
    timestamp: new Date().toISOString() 
  });
});

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
  maritalStatus: "Single" | "Married" | "Divorced";
  dependents: number;
  qualification: "Graduate" | "Post Graduate" | "Professional" | "Others";
  companyType: "Private" | "Government" | "MNC" | "PSU";
  workExperience: number;
  bankRelationship: "Existing Customer" | "New Customer";
}

interface LoanDetails {
  requestedLoanAmount: number;
  preferredTenureYears: number;
  purpose: string;
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

personalLoanRouter.post("/check-personal-eligibility", async (req, res) => {
  try {
    const { applicantDetails, loanDetails }: {
      applicantDetails: ApplicantDetails;
      loanDetails: LoanDetails;
    } = req.body;

    // Basic Eligibility Rules (Hard Rejection)
    const rejectionReasons: string[] = [];

    if (applicantDetails.age < 21 || applicantDetails.age > 60) {
      rejectionReasons.push("Age not eligible (must be 21-60 years)");
    }

    if (applicantDetails.monthlyIncome < 25000) {
      rejectionReasons.push("Minimum monthly income not met (₹25,000 required)");
    }

    if (applicantDetails.creditScore < 650) {
      rejectionReasons.push("Low credit score (minimum 650 required)");
    }

    if (applicantDetails.employmentStabilityYears < 1) {
      rejectionReasons.push("Minimum employment stability not met (1 year required)");
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

    // Maximum Loan Amount Rule
    let maxLoanLimit: number;
    
    if (applicantDetails.monthlyIncome >= 100000) {
      maxLoanLimit = 4000000; // 40 Lakhs
    } else if (applicantDetails.monthlyIncome >= 60000) {
      maxLoanLimit = 2500000; // 25 Lakhs
    } else {
      maxLoanLimit = 1000000; // 10 Lakhs
    }

    let approvedLoanAmount = Math.min(loanDetails.requestedLoanAmount, maxLoanLimit);

    // Risk Scoring System (Out of 100)
    let riskScore = 0;

    // Credit Score (30 points)
    if (applicantDetails.creditScore >= 750) {
      riskScore += 30;
    } else if (applicantDetails.creditScore >= 700) {
      riskScore += 22;
    } else {
      riskScore += 15;
    }

    // Income Level (25 points)
    if (applicantDetails.monthlyIncome >= 100000) {
      riskScore += 25;
    } else if (applicantDetails.monthlyIncome >= 60000) {
      riskScore += 18;
    } else {
      riskScore += 10;
    }

    // Employment Stability (20 points)
    if (applicantDetails.employmentStabilityYears >= 5) {
      riskScore += 20;
    } else if (applicantDetails.employmentStabilityYears >= 3) {
      riskScore += 15;
    } else {
      riskScore += 8;
    }

    // Employment Type (15 points)
    if (applicantDetails.employmentType === "Salaried") {
      if (applicantDetails.companyType === "Government" || applicantDetails.companyType === "PSU") {
        riskScore += 15;
      } else if (applicantDetails.companyType === "MNC") {
        riskScore += 12;
      } else {
        riskScore += 10;
      }
    } else {
      riskScore += 8;
    }

    // Residence Type (10 points)
    if (applicantDetails.residenceType === "Owned") {
      riskScore += 10;
    } else {
      riskScore += 5;
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
    const baseInterestRate = 11.5;
    let interestRate: number;

    if (applicantDetails.creditScore >= 750) {
      interestRate = baseInterestRate - 1.0;
    } else if (applicantDetails.creditScore >= 700) {
      interestRate = baseInterestRate - 0.5;
    } else {
      interestRate = baseInterestRate;
    }

    if (applicantDetails.employmentType === "Self-Employed") {
      interestRate += 1.0;
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

    // Tenure Recommendation (3-5 years for personal loans)
    let recommendedTenureYears = Math.min(Math.max(loanDetails.preferredTenureYears, 1), 5);

    // EMI Burden & Repayment Capacity Check
    const totalEMIs = applicantDetails.existingEMIs;
    const allowedEMI = 0.50 * applicantDetails.monthlyIncome; // 50% for personal loans
    
    let estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, recommendedTenureYears);
    
    // Check if total EMI burden exceeds limit
    if (totalEMIs + estimatedMonthlyEMI > allowedEMI) {
      // Reduce loan amount to fit EMI capacity
      const maxAffordableEMI = allowedEMI - totalEMIs;
      if (maxAffordableEMI <= 0) {
        return res.json({
          eligibilityStatus: "Not Eligible",
          riskScore,
          approvedLoanAmount: 0,
          interestRate: 0,
          recommendedTenureYears: 0,
          estimatedMonthlyEMI: 0,
          totalPayableAmount: 0,
          remarks: "Existing EMI burden too high - no additional loan capacity"
        });
      }
      
      const maxAffordableLoan = calculateLoanFromEMI(maxAffordableEMI, interestRate, recommendedTenureYears);
      approvedLoanAmount = Math.min(approvedLoanAmount, maxAffordableLoan);
      estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, recommendedTenureYears);
      
      if (approvedLoanAmount < loanDetails.requestedLoanAmount * 0.5) {
        eligibilityStatus = "Conditionally Eligible";
      }
    }

    const totalPayableAmount = estimatedMonthlyEMI * recommendedTenureYears * 12;

    // Generate remarks
    let remarks: string;
    if (eligibilityStatus === "Eligible") {
      remarks = "Eligible based on income, credit score, and employment stability";
    } else if (eligibilityStatus === "Conditionally Eligible") {
      remarks = "Eligible with reduced loan amount due to EMI burden or risk factors";
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
    console.error("Personal loan eligibility check error:", error);
    res.status(500).json({ error: "Failed to check personal loan eligibility" });
  }
});