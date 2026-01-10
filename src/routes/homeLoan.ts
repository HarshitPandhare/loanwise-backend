import { Router } from "express";

export const homeLoanRouter = Router();

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

interface PropertyDetails {
  propertyValue: number;
  propertyType: "Ready" | "Under-Construction";
  cityType: "Metro" | "Non-Metro";
}

interface LoanDetails {
  requestedLoanAmount: number;
  preferredTenureYears: number;
}

interface CoApplicantDetails {
  monthlyIncome: number;
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

homeLoanRouter.post("/check-home-eligibility", async (req, res) => {
  try {
    const { applicantDetails, propertyDetails, loanDetails, coApplicantDetails }: {
      applicantDetails: ApplicantDetails;
      propertyDetails: PropertyDetails;
      loanDetails: LoanDetails;
      coApplicantDetails: CoApplicantDetails;
    } = req.body;

    // Basic Eligibility Rules (Hard Rejection)
    const rejectionReasons: string[] = [];

    if (applicantDetails.age < 21 || applicantDetails.age > 65) {
      rejectionReasons.push("Age not eligible (must be 21-65 years)");
    }

    if (applicantDetails.creditScore < 650) {
      rejectionReasons.push("Low credit score (minimum 650 required)");
    }

    if (applicantDetails.employmentStabilityYears < 2) {
      rejectionReasons.push("Minimum employment stability not met (2 years required)");
    }

    if (propertyDetails.propertyValue <= 0) {
      rejectionReasons.push("Invalid property value");
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

    // LTV (Loan to Value) Rule
    let maxLTV: number;
    if (propertyDetails.propertyValue <= 3000000) {
      maxLTV = 0.90; // 90% for properties up to 30 lakhs
    } else {
      maxLTV = 0.80; // 80% for properties above 30 lakhs
    }

    const maxLoanAllowed = propertyDetails.propertyValue * maxLTV;
    let approvedLoanAmount = Math.min(loanDetails.requestedLoanAmount, maxLoanAllowed);

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

    // Combined Income (25 points)
    const totalIncome = applicantDetails.monthlyIncome + (coApplicantDetails.monthlyIncome || 0);
    if (totalIncome >= 150000) {
      riskScore += 25;
    } else if (totalIncome >= 100000) {
      riskScore += 20;
    } else if (totalIncome >= 60000) {
      riskScore += 15;
    } else {
      riskScore += 8;
    }

    // Employment Stability (20 points)
    if (applicantDetails.employmentStabilityYears >= 5) {
      riskScore += 20;
    } else if (applicantDetails.employmentStabilityYears >= 3) {
      riskScore += 15;
    } else {
      riskScore += 8;
    }

    // Property & Location (15 points)
    if (propertyDetails.propertyType === "Ready") {
      riskScore += 8;
    } else {
      riskScore += 5;
    }
    
    if (propertyDetails.cityType === "Metro") {
      riskScore += 7;
    } else {
      riskScore += 4;
    }

    // Residence Type (10 points)
    if (applicantDetails.residenceType === "Owned") {
      riskScore += 10;
    } else {
      riskScore += 5;
    }

    // Eligibility Decision
    let eligibilityStatus: string;
    if (riskScore >= 80) {
      eligibilityStatus = "Eligible";
    } else if (riskScore >= 65) {
      eligibilityStatus = "Conditionally Eligible";
    } else {
      eligibilityStatus = "Not Eligible";
    }

    // Interest Rate Assignment
    const baseInterestRate = 8.75;
    let interestRate: number;

    if (applicantDetails.creditScore >= 750) {
      interestRate = baseInterestRate - 0.25;
    } else if (applicantDetails.creditScore >= 700) {
      interestRate = baseInterestRate;
    } else {
      interestRate = baseInterestRate + 0.25;
    }

    if (applicantDetails.employmentType === "Self-Employed") {
      interestRate += 0.5;
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

    // Tenure Recommendation (10-30 years for home loans)
    let recommendedTenureYears = Math.min(Math.max(loanDetails.preferredTenureYears, 10), 30);

    // EMI Burden & Repayment Capacity Check
    const totalEMIs = applicantDetails.existingEMIs;
    const allowedEMI = 0.45 * totalIncome; // 45% of combined income
    
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
      
      if (approvedLoanAmount < loanDetails.requestedLoanAmount * 0.7) {
        eligibilityStatus = "Conditionally Eligible";
      }
    }

    const totalPayableAmount = estimatedMonthlyEMI * recommendedTenureYears * 12;

    // Generate remarks
    let remarks: string;
    if (eligibilityStatus === "Eligible") {
      remarks = "Eligible based on income, credit score, and property value";
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
    console.error("Home loan eligibility check error:", error);
    res.status(500).json({ error: "Failed to check home loan eligibility" });
  }
});