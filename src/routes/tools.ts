import { Router } from "express";

export const toolsRouter = Router();

// Placeholder routes
const placeholderHandler = (toolName: string) => (req: any, res: any) => {
    res.json({
        success: true,
        tool: toolName,
    });
};

// GET /api/tools/eligibility
toolsRouter.get("/eligibility", placeholderHandler("eligibility"));

// GET /api/tools/compare
toolsRouter.get("/compare", placeholderHandler("compare"));

// GET /api/tools/emi
toolsRouter.get("/emi", placeholderHandler("emi"));

// GET /api/tools/recommendations
toolsRouter.get("/recommendations", placeholderHandler("recommendations"));
