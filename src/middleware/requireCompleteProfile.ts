import { User } from "../models/user.model";

export const requireCompleteProfile = async (req: any, res: any, next: any) => {
    const clerkId = req.auth.userId;

    const user = await User.findOne({ clerkId });

    if (!user || !user.isComplete) {
        return res.status(403).json({
            success: false,
            requiresProfile: true,
            message: "Complete your profile to access loan tools"
        });
    }

    next();
};