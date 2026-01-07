import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";

import { seedRouter } from "./routes/seed";
import { eligibilityRouter } from "./routes/eligibility";
import { userRouter } from "./routes/user";
import { webhookRouter } from "./routes/webhooks";

import { requireAuth } from "@clerk/express";
import bodyParser from "body-parser";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

// ---------- Public Routes ----------
app.get("/", (_req, res) => {
  res.json({ status: "Backend running 🚀" });
});

app.use(seedRouter);
app.use(eligibilityRouter);

// ---------- Webhook (must stay PUBLIC + RAW BODY) ----------
app.use(
  "/api/webhooks",
  bodyParser.raw({ type: "application/json" }),
  webhookRouter
);

// ---------- Protected Routes ----------
app.use("/api/user", requireAuth(), userRouter);
app.use("/api", requireAuth(), eligibilityRouter);

// ---------- Start Server ----------
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
