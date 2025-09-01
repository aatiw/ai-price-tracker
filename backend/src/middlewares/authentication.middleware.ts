import jwt, { type JwtPayload } from 'jsonwebtoken';
import type {Request, Response, NextFunction} from 'express';
import { User } from '../models/User.js';
import "dotenv/config";


declare global{
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
            }
        }
    }
}

interface DecodedToken extends JwtPayload {
    userId: string;
}

export const auth = async (req:Request, res: Response, next: NextFunction ) => {
    try {
        const authHeader = req.header('Authorization') || req.headers.authorization;

        if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: 'No token provided, authorization denied'
            });
        }

        const token = authHeader!.substring(7);

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as unknown as DecodedToken;

        const user = await User.findById(decoded.userId).select('email');

        if(!user){
            return res.status(401).json({
                success: false,
                message: 'Token is not valid - user not found'
            });
        }

        req.user = {
            userId: user._id.toString(),
            email: user.email
        };
        next();
    } catch (error: any) {
        console.error('Auth middleware error:', error.name);
        if(error.name === 'TokenExpiredError'){
            return res.status(401).json({ success: false, message: 'Token has expired'})
        }
        if(error.name === 'JsonWebTokenError'){
            return res.status(401).json({ success: false, message: ' token in not valid'})
        }
        next(error);
    }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as DecodedToken;
            const user = await User.findById(decoded.userId).select('email');
            
            if (user) {
                req.user = {
                    userId: user._id.toString(),
                    email: user.email
                };
            }
        }
    } catch (error) {
    }
    next();
};