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
import { requireCompleteProfile } from "./middleware/requireCompleteProfile";

// 🔍 TEMP DEBUG (remove later)
console.log("ENV CHECK:", {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
});

const app = express();

app.use(cors());
app.use(express.json());

// ✅ env is now loaded correctly
connectDB();

// ---------- Public Routes ----------
app.get("/", (_req, res) => {
  res.json({ status: "Backend running 🚀" });
});

app.use(seedRouter);
app.use(eligibilityRouter);

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

// ---------- Start Server ----------
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
