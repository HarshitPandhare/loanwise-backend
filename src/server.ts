import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";

import { seedRouter } from "./routes/seed";
import { eligibilityRouter } from "./routes/eligibility";
import { profileRouter } from "./routes/profile";
import { toolsRouter } from "./routes/tools";
import { userRouter } from "./routes/user";
import { webhookRouter } from "./routes/webhooks";

import { requireAuth } from "@clerk/express";
import bodyParser from "body-parser";
import { requireCompleteProfile } from "./middleware/requireCompleteProfile";

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
app.use("/api", requireAuth(), profileRouter);
app.use("/api", requireAuth(), eligibilityRouter);


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
