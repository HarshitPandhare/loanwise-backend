import { Router } from "express";

export const educationLoanRouter = Router();

interface StudentDetails {
  age: number;
  nationality: "Indian" | "Other";
  maritalStatus: "Single" | "Married";
  courseType: "UG" | "PG" | "PhD" | "Diploma";
  courseName: string;
  courseDurationYears: number;
  modeOfStudy: "Full-time" | "Part-time";
  institutionType: "Govt" | "Private" | "Abroad";
  academicScorePercent: number;
  entranceExamQualified: boolean;
  currentBacklogs: number;
}

interface LoanDetails {
  requestedLoanAmount: number;
  courseFeeTotal: number;
  livingExpenseMonthly: number;
  studyLocation: "India" | "Abroad";
  preferredTenureYears: number;
  moratoriumRequired: boolean;
}

interface CoApplicantDetails {
  relation: "Father" | "Mother" | "Guardian";
  age: number;
  employmentType: "Salaried" | "Self-Employed";
  monthlyIncome: number;
  monthlyExpenses: number;
  existingEMIs: number;
  creditScore: number;
  employmentStabilityYears: number;
  residenceType: "Owned" | "Rented";
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

educationLoanRouter.post("/check-education-eligibility", async (req, res) => {
  try {
    const { studentDetails, loanDetails, coApplicantDetails }: {
      studentDetails: StudentDetails;
      loanDetails: LoanDetails;
      coApplicantDetails: CoApplicantDetails;
    } = req.body;

    // Basic Eligibility Rules (Hard Rejection)
    const rejectionReasons: string[] = [];

    if (studentDetails.age < 18 || studentDetails.age > 35) {
      rejectionReasons.push("Student age not eligible (must be 18-35 years)");
    }

    if (studentDetails.modeOfStudy !== "Full-time") {
      rejectionReasons.push("Only full-time courses allowed");
    }

    if (studentDetails.academicScorePercent < 50) {
      rejectionReasons.push("Minimum academic score not met (50% required)");
    }

    if (studentDetails.currentBacklogs > 2) {
      rejectionReasons.push("Too many academic backlogs (maximum 2 allowed)");
    }

    if (coApplicantDetails.monthlyIncome <= 0) {
      rejectionReasons.push("Co-applicant income required");
    }

    if (coApplicantDetails.creditScore < 600) {
      rejectionReasons.push("Low credit score (minimum 600 required)");
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
    
    if (studentDetails.institutionType === "Govt" && loanDetails.studyLocation === "India") {
      maxLoanLimit = 1000000; // 10 Lakhs
    } else if (studentDetails.institutionType === "Private" && loanDetails.studyLocation === "India") {
      maxLoanLimit = 750000; // 7.5 Lakhs
    } else if (loanDetails.studyLocation === "Abroad") {
      maxLoanLimit = 2000000; // 20 Lakhs
    } else {
      maxLoanLimit = 750000; // Default
    }

    let approvedLoanAmount = Math.min(loanDetails.requestedLoanAmount, maxLoanLimit);

    // Risk Scoring System (Out of 100)
    let riskScore = 0;

    // Academic Performance (30 points)
    if (studentDetails.academicScorePercent >= 80) {
      riskScore += 30;
    } else if (studentDetails.academicScorePercent >= 65) {
      riskScore += 22;
    } else {
      riskScore += 15;
    }

    // Co-Applicant Income (25 points)
    if (coApplicantDetails.monthlyIncome >= 60000) {
      riskScore += 25;
    } else if (coApplicantDetails.monthlyIncome >= 40000) {
      riskScore += 18;
    } else {
      riskScore += 10;
    }

    // Credit Score (25 points)
    if (coApplicantDetails.creditScore >= 750) {
      riskScore += 25;
    } else if (coApplicantDetails.creditScore >= 700) {
      riskScore += 18;
    } else {
      riskScore += 10;
    }

    // Institution Quality (10 points)
    if (studentDetails.institutionType === "Govt") {
      riskScore += 10;
    } else if (studentDetails.institutionType === "Private") {
      riskScore += 7;
    } else {
      riskScore += 5;
    }

    // Employment Stability (10 points)
    if (coApplicantDetails.employmentStabilityYears >= 5) {
      riskScore += 10;
    } else if (coApplicantDetails.employmentStabilityYears >= 2) {
      riskScore += 6;
    } else {
      riskScore += 3;
    }

    // Eligibility Decision
    let eligibilityStatus: string;
    if (riskScore >= 70) {
      eligibilityStatus = "Eligible";
    } else if (riskScore >= 55) {
      eligibilityStatus = "Conditionally Eligible";
    } else {
      eligibilityStatus = "Not Eligible";
    }

    // Interest Rate Assignment
    const baseInterestRate = 9.5;
    let interestRate: number;

    if (riskScore >= 80) {
      interestRate = baseInterestRate - 0.5;
    } else if (riskScore >= 65) {
      interestRate = baseInterestRate;
    } else if (riskScore >= 55) {
      interestRate = baseInterestRate + 0.75;
    } else {
      return res.json({
        eligibilityStatus: "Not Eligible",
        riskScore,
        approvedLoanAmount: 0,
        interestRate: 0,
        recommendedTenureYears: 0,
        estimatedMonthlyEMI: 0,
        totalPayableAmount: 0,
        remarks: "High risk applicant - does not meet minimum risk criteria"
      });
    }

    // Tenure Recommendation
    let recommendedTenureYears: number;
    if (coApplicantDetails.monthlyIncome < 40000) {
      recommendedTenureYears = 15;
    } else if (coApplicantDetails.monthlyIncome <= 70000) {
      recommendedTenureYears = 10;
    } else {
      recommendedTenureYears = 8;
    }

    // Use preferred tenure if within recommended range
    const finalTenure = Math.min(Math.max(loanDetails.preferredTenureYears, 5), recommendedTenureYears);

    // EMI Burden & Repayment Capacity Check
    const disposableIncome = coApplicantDetails.monthlyIncome - coApplicantDetails.existingEMIs - coApplicantDetails.monthlyExpenses;
    const allowedEMI = 0.45 * coApplicantDetails.monthlyIncome;
    
    let estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, finalTenure);
    
    // Adjust loan amount if EMI is too high
    if (estimatedMonthlyEMI > allowedEMI) {
      // Reduce loan amount to fit EMI capacity
      const maxAffordableLoan = calculateLoanFromEMI(allowedEMI, interestRate, finalTenure);
      approvedLoanAmount = Math.min(approvedLoanAmount, maxAffordableLoan);
      estimatedMonthlyEMI = calculateEMI(approvedLoanAmount, interestRate, finalTenure);
      
      if (approvedLoanAmount < loanDetails.requestedLoanAmount * 0.5) {
        eligibilityStatus = "Conditionally Eligible";
      }
    }

    const totalPayableAmount = estimatedMonthlyEMI * finalTenure * 12;

    // Generate remarks
    let remarks: string;
    if (eligibilityStatus === "Eligible") {
      remarks = "Eligible based on academic performance and co-applicant income";
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
      recommendedTenureYears: finalTenure,
      estimatedMonthlyEMI: Math.round(estimatedMonthlyEMI),
      totalPayableAmount: Math.round(totalPayableAmount),
      remarks
    });

  } catch (error) {
    console.error("Education loan eligibility check error:", error);
    res.status(500).json({ error: "Failed to check education loan eligibility" });
  }
});

// Helper function to calculate loan amount from EMI
function calculateLoanFromEMI(emi: number, annualRate: number, tenureYears: number): number {
  const monthlyRate = annualRate / 12 / 100;
  const tenureMonths = tenureYears * 12;
  
  if (monthlyRate === 0) return emi * tenureMonths;
  
  const principal = emi * (Math.pow(1 + monthlyRate, tenureMonths) - 1) / 
                    (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));
  
  return Math.round(principal);
}