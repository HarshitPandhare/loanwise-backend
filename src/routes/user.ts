import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { User } from "../models/user.model";

export const userRouter = Router();

// Sync Clerk user with MongoDB
userRouter.post("/sync", requireAuth(), async (req, res) => {
  try {
    const { userId, sessionClaims } = getAuth(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const userData = {
      clerkId: userId,
      email: sessionClaims?.email as string,
      firstName: sessionClaims?.firstName as string,
      lastName: sessionClaims?.lastName as string,
    };

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      userData,
      { upsert: true, new: true }
    );

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// Get current user
userRouter.get("/me", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await User.findOne({ clerkId: userId });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
});