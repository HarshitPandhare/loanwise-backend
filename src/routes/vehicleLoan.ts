import { Router } from "express";

export const vehicleLoanRouter = Router();

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

interface VehicleDetails {
  vehicleType: "Two-Wheeler" | "Four-Wheeler";
  vehicleCost: number;
  newOrUsed: "New" | "Used";
}

interface LoanDetails {
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

vehicleLoanRouter.post("/check-vehicle-eligibility", async (req, res) => {
  try {
    const { applicantDetails, vehicleDetails, loanDetails }: {
      applicantDetails: ApplicantDetails;
      vehicleDetails: VehicleDetails;
      loanDetails: LoanDetails;
    } = req.body;

    // Basic Eligibility Rules (Hard Rejection)
    const rejectionReasons: string[] = [];

    if (applicantDetails.age < 21 || applicantDetails.age > 65) {
      rejectionReasons.push("Age not eligible (must be 21-65 years)");
    }

    if (applicantDetails.creditScore < 650) {
      rejectionReasons.push("Low credit score (minimum 650 required)");
    }

    if (applicantDetails.employmentStabilityYears < 1) {
      rejectionReasons.push("Minimum employment stability not met (1 year required)");
    }

    if (vehicleDetails.vehicleCost <= 0) {
      rejectionReasons.push("Invalid vehicle cost");
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

    // LTV Rule
    let maxLTV: number;
    if (vehicleDetails.newOrUsed === "New") {
      maxLTV = 0.90; // 90% for new vehicles
    } else {
      maxLTV = 0.70; // 70% for used vehicles
    }

    let approvedLoanAmount = vehicleDetails.vehicleCost * maxLTV;

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
    if (applicantDetails.monthlyIncome >= 80000) {
      riskScore += 25;
    } else if (applicantDetails.monthlyIncome >= 50000) {
      riskScore += 18;
    } else if (applicantDetails.monthlyIncome >= 30000) {
      riskScore += 12;
    } else {
      riskScore += 6;
    }

    // Employment Stability (20 points)
    if (applicantDetails.employmentStabilityYears >= 5) {
      riskScore += 20;
    } else if (applicantDetails.employmentStabilityYears >= 3) {
      riskScore += 15;
    } else {
      riskScore += 8;
    }

    // Vehicle Type & Condition (15 points)
    if (vehicleDetails.newOrUsed === "New") {
      riskScore += 10;
    } else {
      riskScore += 6;
    }
    
    if (vehicleDetails.vehicleType === "Four-Wheeler") {
      riskScore += 5;
    } else {
      riskScore += 3;
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
    const baseInterestRate = 9.25;
    let interestRate: number;

    if (vehicleDetails.newOrUsed === "Used") {
      interestRate = baseInterestRate + 1.5;
    } else {
      interestRate = baseInterestRate;
    }

    if (applicantDetails.creditScore >= 750) {
      interestRate -= 0.5;
    } else if (applicantDetails.creditScore < 700) {
      interestRate += 0.5;
    }

    if (applicantDetails.employmentType === "Self-Employed") {
      interestRate += 0.75;
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

    // Tenure Recommendation (3-7 years for vehicle loans)
    let recommendedTenureYears = Math.min(Math.max(loanDetails.preferredTenureYears, 1), 7);
    
    // Adjust tenure based on vehicle type
    if (vehicleDetails.vehicleType === "Two-Wheeler") {
      recommendedTenureYears = Math.min(recommendedTenureYears, 5);
    }

    // EMI Burden & Repayment Capacity Check
    const totalEMIs = applicantDetails.existingEMIs;
    const allowedEMI = 0.50 * applicantDetails.monthlyIncome; // 50% for vehicle loans
    
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
      
      if (approvedLoanAmount < vehicleDetails.vehicleCost * 0.5) {
        eligibilityStatus = "Conditionally Eligible";
      }
    }

    const totalPayableAmount = estimatedMonthlyEMI * recommendedTenureYears * 12;

    // Generate remarks
    let remarks: string;
    if (eligibilityStatus === "Eligible") {
      remarks = `Eligible for ${vehicleDetails.vehicleType.toLowerCase()} loan based on income and credit profile`;
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
    console.error("Vehicle loan eligibility check error:", error);
    res.status(500).json({ error: "Failed to check vehicle loan eligibility" });
  }
});