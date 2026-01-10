import { Router } from "express";

export const homeLoanRouter = Router();

interface ApplicantDetails {
  age: number;
  monthlyIncome: number;
  employmentType: "Salaried" | "Self-Employed";
  employmentStabilityYears: number;
  creditScore: number;
  existingEMIs: number;
  monthlyExpenses: number;
  residenceType: "Owned" | "Rented";
}

interface PropertyDetails {
  propertyType: "Under Construction" | "Ready to Move" | "Resale";
  propertyLocation: "Metro" | "Tier-1" | "Tier-2" | "Tier-3";
  propertyCost: number;
  propertyArea: number; // in sqft
  propertyAge?: number; // for resale properties
}

interface LoanDetails {
  requestedLoanAmount: number;
  downPayment: number;
  preferredTenureYears: number;
  coApplicantRequired: boolean;
}

interface CoApplicantDetails {
  relation: "Spouse" | "Parent" | "Sibling";
  age: number;
  monthlyIncome: number;
  employmentType: "Salaried" | "Self-Employed";
  creditScore: number;
  existingEMIs: number;
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

homeLoanRouter.post("/check-home-loan-eligibility", async (req, res) => {
  try {
    const { applicantDetails, propertyDetails, loanDetails, coApplicantDetails }: {
      applicantDetails: ApplicantDetails;
      propertyDetails: PropertyDetails;
      loanDetails: LoanDetails;
      coApplicantDetails?: CoApplicantDetails;
    } = req.body;

    // Basic Eligibility Rules (Hard Rejection)
    const rejectionReasons: string[] = [];

    // Age validation
    if (applicantDetails.age < 21 || applicantDetails.age > 65) {
      rejectionReasons.push("Applicant age not eligible (must be 21-65 years)");
    }

    // Minimum income requirement
    if (applicantDetails.monthlyIncome < 25000) {
      rejectionReasons.push("Minimum monthly income of ₹25,000 required");
    }

    // Credit score validation
    if (applicantDetails.creditScore < 650) {
      rejectionReasons.push("Minimum credit score of 650 required");
    }

    // Employment stability
    if (applicantDetails.employmentStabilityYears < 1) {
      rejectionReasons.push("Minimum 1 year of employment stability required");
    }

    // Property cost validation
    if (propertyDetails.propertyCost <= 0) {
      rejectionReasons.push("Invalid property cost");
    }

    // Down payment validation (minimum 10% for home loans)
    const minDownPayment = propertyDetails.propertyCost * 0.10;
    if (loanDetails.downPayment < minDownPayment) {
      rejectionReasons.push(`Minimum down payment of ${(minDownPayment / 100000).toFixed(1)} Lakhs required (10% of property cost)`);
    }

    // Loan amount validation
    const maxLoanAmount = propertyDetails.propertyCost - loanDetails.downPayment;
    if (loanDetails.requestedLoanAmount > maxLoanAmount) {
      rejectionReasons.push("Requested loan amount exceeds maximum eligible amount");
    }

    // Co-applicant validation if required
    if (loanDetails.coApplicantRequired && coApplicantDetails) {
      if (coApplicantDetails.age < 18 || coApplicantDetails.age > 70) {
        rejectionReasons.push("Co-applicant age not eligible (must be 18-70 years)");
      }
      if (coApplicantDetails.creditScore < 600) {
        rejectionReasons.push("Co-applicant minimum credit score of 600 required");
      }
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
        loanToValueRatio: 0,
        remarks: rejectionReasons.join("; ")
      });
    }

    // Maximum Loan Amount Calculation (LTV - Loan to Value)
    let maxLTV: number;
    
    if (propertyDetails.propertyType === "Under Construction") {
      maxLTV = 0.80; // 80% LTV
    } else if (propertyDetails.propertyType === "Ready to Move") {
      maxLTV = 0.85; // 85% LTV
    } else if (propertyDetails.propertyType === "Resale") {
      if (propertyDetails.propertyAge && propertyDetails.propertyAge <= 5) {
        maxLTV = 0.80; // 80% LTV for properties less than 5 years
      } else if (propertyDetails.propertyAge && propertyDetails.propertyAge <= 15) {
        maxLTV = 0.70; // 70% LTV for properties 5-15 years
      } else {
        maxLTV = 0.60; // 60% LTV for properties above 15 years
      }
    } else {
      maxLTV = 0.80; // Default
    }

    const maxLoanAmountByLTV = propertyDetails.propertyCost * maxLTV;
    let approvedLoanAmount = Math.min(loanDetails.requestedLoanAmount, maxLoanAmountByLTV);

    // Risk Scoring System (Out of 100)
    let riskScore = 0;

    // Income Stability (25 points)
    if (applicantDetails.monthlyIncome >= 100000) {
      riskScore += 25;
    } else if (applicantDetails.monthlyIncome >= 50000) {
      riskScore += 20;
    } else if (applicantDetails.monthlyIncome >= 30000) {
      riskScore += 15;
    } else {
      riskScore += 10;
    }

    // Employment Stability (20 points)
    if (applicantDetails.employmentStabilityYears >= 5) {
      riskScore += 20;
    } else if (applicantDetails.employmentStabilityYears >= 3) {
      riskScore += 15;
    } else if (applicantDetails.employmentStabilityYears >= 1) {
      riskScore += 10;
    } else {
      riskScore += 5;
    }

    // Credit Score (25 points)
    if (applicantDetails.creditScore >= 750) {
      riskScore += 25;
    } else if (applicantDetails.creditScore >= 700) {
      riskScore += 20;
    } else if (applicantDetails.creditScore >= 650) {
      riskScore += 15;
    } else {
      riskScore += 10;
    }

    // Property Location (10 points)
    if (propertyDetails.propertyLocation === "Metro") {
      riskScore += 10;
    } else if (propertyDetails.propertyLocation === "Tier-1") {
      riskScore += 8;
    } else if (propertyDetails.propertyLocation === "Tier-2") {
      riskScore += 6;
    } else {
      riskScore += 4;
    }

    // Property Type (10 points)
    if (propertyDetails.propertyType === "Ready to Move") {
      riskScore += 10;
    } else if (propertyDetails.propertyType === "Under Construction") {
      riskScore += 8;
    } else {
      riskScore += 6;
    }

    // Down Payment Ratio (10 points)
    const downPaymentRatio = loanDetails.downPayment / propertyDetails.propertyCost;
    if (downPaymentRatio >= 0.20) {
      riskScore += 10;
    } else if (downPaymentRatio >= 0.15) {
      riskScore += 8;
    } else if (downPaymentRatio >= 0.10) {
      riskScore += 6;
    } else {
      riskScore += 4;
    }

    // Co-applicant Bonus (if applicable)
    if (coApplicantDetails && loanDetails.coApplicantRequired) {
      const combinedIncome = applicantDetails.monthlyIncome + coApplicantDetails.monthlyIncome;
      if (combinedIncome >= 150000) {
        riskScore += 5;
      } else if (combinedIncome >= 100000) {
        riskScore += 3;
      }
      
      if (coApplicantDetails.creditScore >= 750) {
        riskScore += 5;
      }
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

    // Interest Rate Assignment (Base rate varies by property type and location)
    let baseInterestRate: number;
    
    if (propertyDetails.propertyLocation === "Metro") {
      baseInterestRate = 8.5;
    } else if (propertyDetails.propertyLocation === "Tier-1") {
      baseInterestRate = 9.0;
    } else {
      baseInterestRate = 9.5;
    }

    let interestRate: number;

    if (riskScore >= 80) {
      interestRate = baseInterestRate - 0.5; // Best rate
    } else if (riskScore >= 70) {
      interestRate = baseInterestRate; // Standard rate
    } else if (riskScore >= 60) {
      interestRate = baseInterestRate + 0.5; // Higher rate
    } else {
      return res.json({
        eligibilityStatus: "Not Eligible",
        riskScore,
        approvedLoanAmount: 0,
        interestRate: 0,
        recommendedTenureYears: 0,
        estimatedMonthlyEMI: 0,
        totalPayableAmount: 0,
        loanToValueRatio: 0,
        remarks: "High risk applicant - does not meet minimum risk criteria"
      });
    }

    // Tenure Recommendation (Home loans typically 5-30 years)
    let recommendedTenureYears: number;
    const totalIncome = coApplicantDetails && loanDetails.coApplicantRequired 
      ? applicantDetails.monthlyIncome + coApplicantDetails.monthlyIncome 
      : applicantDetails.monthlyIncome;
    
    if (totalIncome < 50000) {
      recommendedTenureYears = 25; // Longer tenure for lower income
    } else if (totalIncome <= 100000) {
      recommendedTenureYears = 20;
    } else {
      recommendedTenureYears = 15; // Shorter tenure for higher income
    }

    // Use preferred tenure if within valid range (5-30 years)
    const finalTenure = Math.min(Math.max(loanDetails.preferredTenureYears, 5), Math.min(recommendedTenureYears, 30));

    // EMI Burden & Repayment Capacity Check
    const totalExistingEMIs = applicantDetails.existingEMIs + 
      (coApplicantDetails && loanDetails.coApplicantRequired ? coApplicantDetails.existingEMIs : 0);
    
    const totalMonthlyExpenses = applicantDetails.monthlyExpenses + 
      (coApplicantDetails && loanDetails.coApplicantRequired ? (coApplicantDetails.monthlyIncome * 0.3) : 0);
    
    const disposableIncome = totalIncome - totalExistingEMIs - totalMonthlyExpenses;
    const allowedEMI = 0.40 * totalIncome; // 40% FOIR for home loans
    
    let estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, finalTenure);
    
    // Adjust loan amount if EMI is too high
    if (estimatedMonthlyEMI > allowedEMI) {
      const maxAffordableLoan = calculateLoanFromEMI(allowedEMI, interestRate, finalTenure);
      approvedLoanAmount = Math.min(approvedLoanAmount, maxAffordableLoan);
      estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, finalTenure);
      
      if (approvedLoanAmount < loanDetails.requestedLoanAmount * 0.6) {
        eligibilityStatus = "Conditionally Eligible";
      }
    }

    const totalPayableAmount = estimatedMonthlyEMI * finalTenure * 12;
    const loanToValueRatio = (approvedLoanAmount / propertyDetails.propertyCost) * 100;

    // Generate remarks
    let remarks: string;
    if (eligibilityStatus === "Eligible") {
      remarks = "Eligible based on income stability, credit score, and property details";
    } else if (eligibilityStatus === "Conditionally Eligible") {
      remarks = "Eligible with reduced loan amount or adjusted terms due to risk factors";
    } else {
      remarks = "Application does not meet risk criteria";
    }

    res.json({
      eligibilityStatus,
      riskScore,
      approvedLoanAmount: Math.round(approvedLoanAmount),
      interestRate: Number(interestRate.toFixed(2)),
      recommendedTenureYears: finalTenure,
      estimatedMonthlyEMI: Math.round(estimatedMonthlyEMI),
      totalPayableAmount: Math.round(totalPayableAmount),
      loanToValueRatio: Number(loanToValueRatio.toFixed(2)),
      maxLoanAmountByLTV: Math.round(maxLoanAmountByLTV),
      remarks
    });

  } catch (error) {
    console.error("Home loan eligibility check error:", error);
    res.status(500).json({ error: "Failed to check home loan eligibility" });
  }
});

