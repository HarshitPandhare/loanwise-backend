import bodyParser from "body-parser";
import { verifyWebhook } from "@clerk/express/webhooks";
import { Router } from "express";
import { User } from "../models/user.model";

export const webhookRouter = Router();

webhookRouter.post(
  "/clerk",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

    if (!WEBHOOK_SECRET) {
      return res.status(500).json({
        error: "Missing CLERK_WEBHOOK_SIGNING_SECRET",
      });
    }

    try {
      const payload = await verifyWebhook(req, {
        signingSecret: WEBHOOK_SECRET,
      });

      console.log("Webhook event:", payload.type);

      if (payload.type === "user.created" || payload.type === "user.updated") {
        await User.findOneAndUpdate(
          { clerkId: payload.data.id },
          {
            clerkId: payload.data.id,
            email: payload.data.email_addresses?.[0]?.email_address,
            firstName: payload.data.first_name,
            lastName: payload.data.last_name,
          },
          { upsert: true }
        );
      }

      if (payload.type === "user.deleted") {
        await User.findOneAndDelete({ clerkId: payload.data.id });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
  }
);
