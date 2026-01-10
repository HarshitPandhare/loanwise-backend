import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { User } from "../models/user.model";

export const profileRouter = Router();

// Helper to check if profile is complete
const checkCompletion = (user: any) => {
  const requiredFields = [
    'fullName',
    'age',
    'phone',
    'address',
    'employmentStatus',
    'email',
    'monthlyIncome',
    'incomeSource'
  ];

  for (const field of requiredFields) {
    if (!user[field] && user[field] !== 0) { // Allow 0 for numbers if valid, but maybe not for income? Assuming income > 0 usually. 
      // Actually 0 income might be valid but unlikely for loan. 
      // "Missing" usually means null/undefined or empty string.
      if (user[field] === undefined || user[field] === null || user[field] === '') {
        return false;
      }
    }
  }
  return true;
};

// GET /api/profile
profileRouter.get("/profile", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      // Lazy creation if not found (unexpected but safe)
      // We might not have email here if it's not in claims, so we accept partial info
      user = new User({
        clerkId: userId,
        email: "pending@update.com" // Placeholder, should be updated via sync or this endpoint 
      });
      await user.save();
    }

    res.json(user);
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/profile
profileRouter.put("/profile", requireAuth(), async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updates = req.body;

    // Prevent sensitive field updates directly if needed, but for this task we trust the body
    // except clerkId
    delete updates.clerkId;
    delete updates.isComplete; // Re-calculated below

    // We use findOne to get the document instance so we can check completion
    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      user = new User({ clerkId: userId, ...updates });
    } else {
      Object.assign(user, updates);
    }

    // Check completion
    user.isComplete = checkCompletion(user);

    await user.save();

    res.json(user);

  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});