import "dotenv/config"; // ✅ MUST be first, no function call

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { requireAuth } from "@clerk/express";
import { businessLoanRouter } from "./routes/business";


import { connectDB } from "./config/db";

import { seedRouter } from "./routes/seed";
import { eligibilityRouter } from "./routes/eligibility";
import { profileRouter } from "./routes/profile";
import { toolsRouter } from "./routes/tools";
import { userRouter } from "./routes/user";
import { webhookRouter } from "./routes/webhooks";
import { educationLoanRouter } from "./routes/educationLoan";
import { personalLoanRouter } from "./routes/personalLoan";
import { homeLoanRouter } from "./routes/homeLoan";
import { vehicleLoanRouter } from "./routes/vehicleLoan";
import { businessLoanRouter } from "./routes/businessLoan";
import { profileRouter } from "./routes/profile";
import { toolsRouter } from "./routes/tools";

import { requireAuth } from "@clerk/express";
import bodyParser from "body-parser";
import { requireCompleteProfile } from "./middleware/requireCompleteProfile";

dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// ✅ env is now loaded correctly
connectDB();

// ---------- Public Routes ----------
app.get("/", (_req, res) => {
  res.json({ status: "Backend running 🚀" });
});

app.use(seedRouter);
app.use(eligibilityRouter);
app.use(educationLoanRouter);
app.use(personalLoanRouter);
app.use(homeLoanRouter);
app.use(vehicleLoanRouter);
app.use(businessLoanRouter);

// ---------- Webhook (PUBLIC + RAW BODY) ----------
app.use(
  "/api/webhooks",
  bodyParser.raw({ type: "application/json" }),
  webhookRouter
);

// ---------- Protected Routes ----------
app.use("/api/user", requireAuth(), userRouter);
app.use("/api", requireAuth(), profileRouter);
app.use("/api", requireAuth(), eligibilityRouter);
app.use("/api", businessLoanRouter);

app.use(
  "/api/tools",
  requireAuth(),
  requireCompleteProfile,
  toolsRouter
);

app.use(
  "/api/tools",
  requireAuth(),
  requireCompleteProfile,
  toolsRouter
);

// ---------- Start Server ----------
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
