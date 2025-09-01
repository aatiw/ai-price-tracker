
import type { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.js';

const SEARCH_LIMIT = 3;

export const checkSearchLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const now = new Date();

        if (user.searchLimitResetsAt && now > user.searchLimitResetsAt) {
            user.searchCount = 0;
            user.searchLimitResetsAt = null; 
            await user.save();
        }

        if (user.searchCount >= SEARCH_LIMIT) {
            return res.status(429).json({ 
                success: false,
                message: `You have exceeded your search limit of ${SEARCH_LIMIT} queries.`,
                limitResetsAt: user.searchLimitResetsAt
            });
        }

        next();

    } catch (error) {
        next(error);
    }
};