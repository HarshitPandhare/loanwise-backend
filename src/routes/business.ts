import { Router, Request, Response } from "express";

export const businessLoanRouter = Router();

/* ------------------ Type Definitions ------------------ */

interface BusinessDetails {
    businessType?: string;
    yearsInBusiness: number;
    annualTurnover: number;
    profitMargin: number;
}

interface ApplicantDetails {
    age: number;
    creditScore: number;
    existingEMIs: number;
}

interface LoanRequest {
    requestedAmount: number;
    preferredTenureYears: number;
}

interface BusinessLoanRequestBody {
    businessDetails: BusinessDetails;
    applicantDetails: ApplicantDetails;
    loanRequest: LoanRequest;
}

/* ------------------ Helper Utilities ------------------ */

// EMI calculation
const calculateEMI = (
    principal: number,
    annualRate: number,
    tenureYears: number
): number => {
    const r = annualRate / 12 / 100;
    const n = tenureYears * 12;

    if (r === 0) return principal / n;

    return Math.round(
        (principal * r * Math.pow(1 + r, n)) /
        (Math.pow(1 + r, n) - 1)
    );
};

// Reverse EMI → Loan
const calculateLoanFromEMI = (
    emi: number,
    annualRate: number,
    tenureYears: number
): number => {
    const r = annualRate / 12 / 100;
    const n = tenureYears * 12;

    if (r === 0) return emi * n;

    return Math.round(
        emi * (Math.pow(1 + r, n) - 1) /
        (r * Math.pow(1 + r, n))
    );
};

/* ------------------ Main API ------------------ */

businessLoanRouter.post(
    "/check-business-eligibility",
    async (
        req: Request<{}, {}, BusinessLoanRequestBody>,
        res: Response
    ) => {
        try {
            const {
                businessDetails,
                applicantDetails,
                loanRequest
            } = req.body;

            const rejectionReasons: string[] = [];

            /* ---------- HARD ELIGIBILITY CHECKS ---------- */

            if (applicantDetails.age < 25 || applicantDetails.age > 65) {
                rejectionReasons.push(
                    "Applicant age must be between 25 and 65 years."
                );
            }

            if (businessDetails.yearsInBusiness < 2) {
                rejectionReasons.push(
                    "Minimum 2 years of business continuity required."
                );
            }

            if (applicantDetails.creditScore < 650) {
                rejectionReasons.push(
                    "Credit score below acceptable limit."
                );
            }

            if (businessDetails.annualTurnover < 500_000) {
                rejectionReasons.push(
                    "Annual turnover too low for business loan."
                );
            }

            if (rejectionReasons.length > 0) {
                return res.json({
                    eligibilityStatus: "Rejected",
                    reasons: rejectionReasons
                });
            }

            /* ---------- RISK SCORING (100 POINTS) ---------- */

            let riskScore = 0;

            // Credit Score (30)
            if (applicantDetails.creditScore >= 750) riskScore += 30;
            else if (applicantDetails.creditScore >= 700) riskScore += 22;
            else riskScore += 15;

            // Business Vintage (25)
            if (businessDetails.yearsInBusiness >= 5) riskScore += 25;
            else if (businessDetails.yearsInBusiness >= 3) riskScore += 18;
            else riskScore += 10;

            // Turnover (25)
            if (businessDetails.annualTurnover >= 5_000_000) riskScore += 25;
            else if (businessDetails.annualTurnover >= 2_000_000) riskScore += 18;
            else riskScore += 10;

            // Profitability (20)
            if (businessDetails.profitMargin >= 20) riskScore += 20;
            else if (businessDetails.profitMargin >= 10) riskScore += 12;
            else riskScore += 5;

            /* ---------- ELIGIBILITY BAND ---------- */

            let eligibilityStatus: "Approved" | "Partially Approved";

            if (riskScore >= 70) eligibilityStatus = "Approved";
            else if (riskScore >= 55) eligibilityStatus = "Partially Approved";
            else {
                return res.json({
                    eligibilityStatus: "Rejected",
                    riskScore,
                    remarks: "High risk business profile"
                });
            }

            /* ---------- INTEREST RATE ---------- */

            let interestRate = 14.5;

            if (riskScore >= 80) interestRate -= 1.0;
            else if (riskScore >= 70) interestRate -= 0.5;
            else if (riskScore < 60) interestRate += 1.0;

            /* ---------- LOAN LIMIT LOGIC ---------- */

            let turnoverMultiplier = 0.25;
            if (businessDetails.yearsInBusiness >= 5) turnoverMultiplier = 0.40;
            else if (businessDetails.yearsInBusiness >= 3) turnoverMultiplier = 0.30;

            const turnoverCap =
                businessDetails.annualTurnover * turnoverMultiplier;

            /* ---------- EMI & DSCR CHECK ---------- */

            const monthlyIncome =
                (businessDetails.annualTurnover / 12) *
                (businessDetails.profitMargin / 100);

            const maxAllowedEMI =
                monthlyIncome * 0.55 - applicantDetails.existingEMIs;

            const tenure = Math.min(
                loanRequest.preferredTenureYears,
                10
            );

            const emiBasedCap = calculateLoanFromEMI(
                maxAllowedEMI,
                interestRate,
                tenure
            );

            /* ---------- FINAL APPROVAL ---------- */

            const approvedLoanAmount = Math.min(
                loanRequest.requestedAmount,
                turnoverCap,
                emiBasedCap
            );

            const finalEMI = calculateEMI(
                approvedLoanAmount,
                interestRate,
                tenure
            );

            return res.json({
                eligibilityStatus,
                riskScore,
                approvedLoanAmount: Math.round(approvedLoanAmount),
                interestRate: Number(interestRate.toFixed(2)),
                tenureYears: tenure,
                monthlyEMI: finalEMI,
                totalInterestPayable: Math.round(
                    finalEMI * tenure * 12 - approvedLoanAmount
                ),
                remarks:
                    approvedLoanAmount < loanRequest.requestedAmount
                        ? "Loan amount reduced due to income or risk constraints."
                        : "Loan approved as requested."
            });

        } catch (error) {
            console.error("Business loan error:", error);
            return res
                .status(500)
                .json({ error: "Failed to process business loan eligibility" });
        }
    }
);
