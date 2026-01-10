import { Router } from "express";

export const vehicleLoanRouter = Router();

// --- Helper Utilities ---
const calculateEMI = (P: number, annualRate: number, tenureYears: number) => {
    const r = annualRate / 12 / 100;
    const n = tenureYears * 12;
    if (r === 0 || n === 0) return 0;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi);
};

const calculateMaxLoanFromEMI = (maxEMI: number, annualRate: number, tenureYears: number) => {
    const r = annualRate / 12 / 100;
    const n = tenureYears * 12;
    if (r === 0) return maxEMI * n;
    const principal = maxEMI * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
    return Math.round(principal);
};

// --- Main Eligibility Endpoint ---
vehicleLoanRouter.post("/check-vehicle-eligibility", async (req, res) => {
    try {
        const {
            vehicleDetails,   // { category: 'Two-Wheeler'|'Four-Wheeler'|'Commercial', condition: 'New'|'Used', price: 1000000 }
            applicantDetails, // { age, income, existingEMIs, creditScore, downpayment }
            loanRequest       // { preferredTenureYears }
        } = req.body;

        const rejectionReasons: string[] = [];

        // 1. Initial Hard Rejections
        if (applicantDetails.age < 21 || applicantDetails.age > 60) {
            rejectionReasons.push("Age must be between 21 and 60 years.");
        }
        if (applicantDetails.creditScore < 650) {
            rejectionReasons.push("Credit score too low (Min 650 required).");
        }

        // 2. Dynamic Rule Configuration based on Vehicle Category
        let config = {
            baseRate: 8.5,
            maxTenure: 7,
            maxLTV: 0.90
        };

        switch (vehicleDetails.category) {
            case 'Two-Wheeler':
                config = { baseRate: 11.0, maxTenure: 3, maxLTV: 0.85 };
                break;
            case 'Four-Wheeler':
                config = { baseRate: 8.5, maxTenure: 7, maxLTV: 0.90 };
                break;
            case 'Commercial':
                config = { baseRate: 14.0, maxTenure: 5, maxLTV: 0.70 };
                break;
            default:
                // defaulting to Four-Wheeler if something weird comes in, or push error
                // but let's assume valid input or handle generic
                config = { baseRate: 8.5, maxTenure: 7, maxLTV: 0.90 };
        }

        // Adjust for Used Vehicles (Higher risk = higher rate, lower LTV)
        if (vehicleDetails.condition === 'Used') {
            config.baseRate += 3.5;
            config.maxLTV -= 0.15;
            config.maxTenure = Math.min(config.maxTenure, 4);
        }

        // 3. Rate Adjustment based on Credit Score
        let finalInterestRate = config.baseRate;
        if (applicantDetails.creditScore >= 800) finalInterestRate -= 0.5;
        else if (applicantDetails.creditScore < 700) finalInterestRate += 1.0;

        // 4. LTV (Loan to Value) Validation
        const ltvCap = vehicleDetails.price * config.maxLTV;
        const minDownpayment = vehicleDetails.price * (1 - config.maxLTV);
        const loanNeeded = vehicleDetails.price - applicantDetails.downpayment;

        if (applicantDetails.downpayment < minDownpayment) {
            rejectionReasons.push(`${vehicleDetails.category || 'Vehicle'} requires at least ${Math.round((1 - config.maxLTV) * 100)}% downpayment (₹${Math.round(minDownpayment)}).`);
        }

        if (rejectionReasons.length > 0) {
            return res.json({ status: "Rejected", reasons: rejectionReasons });
        }

        // 5. Repayment Capacity (Max 50% of income minus existing EMIs)
        const tenure = Math.min(loanRequest.preferredTenureYears, config.maxTenure);
        const maxEMIAllowed = (applicantDetails.income * 0.50) - applicantDetails.existingEMIs;

        if (maxEMIAllowed <= 0) {
            return res.json({ status: "Rejected", reasons: ["Existing debt burden is too high."] });
        }

        const incomeLimit = calculateMaxLoanFromEMI(maxEMIAllowed, finalInterestRate, tenure);

        // 6. Final Decision Logic (Lowest of: What they need vs Asset Cap vs Income Cap)
        let approvedAmount = Math.min(loanNeeded, ltvCap, incomeLimit);
        const finalEMI = calculateEMI(approvedAmount, finalInterestRate, tenure);



        res.json({
            eligibilityStatus: approvedAmount >= loanNeeded ? "Approved" : "Partially Approved",
            summary: {
                category: vehicleDetails.category,
                condition: vehicleDetails.condition,
                interestRate: finalInterestRate.toFixed(2), // fixed to string for display usually, but number is fine too.
                tenureYears: tenure,
                maxTenureAllowed: config.maxTenure
            },
            financials: {
                vehiclePrice: vehicleDetails.price,
                approvedLoanAmount: Math.round(approvedAmount),
                monthlyEMI: finalEMI,
                downpaymentProvided: applicantDetails.downpayment,
                totalInterest: Math.round((finalEMI * tenure * 12) - approvedAmount)
            },
            limitsApplied: {
                ltvLimit: Math.round(ltvCap),
                repaymentLimit: incomeLimit
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
