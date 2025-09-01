import express from "express";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { User } from "../models/User.js";
import "dotenv/config";
import redis from "../config/redisConfig.js";


const router = express.Router();

const generateAccessToken = (userId: string): string => {
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET environment variable not set.");
    return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET!, {
        expiresIn: '15m'
    });
};

const generateRefreshToken = (userId: string): string => {
    if(!process.env.JWT_SECRET) throw new Error("JWT_SECRET not set");
    return jwt.sign({userId}, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: '3d'
    });
};

const storeRefreshToken = async (userId: string, token: string) => {
  await redis.set(`refresh:${userId}`, token, "EX", 3*24*60*60*1000);
};

const sendTokens = (res: Response, user: any) => {
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    storeRefreshToken(user._id.toString(), refreshToken);

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3*24*60*60*1000
    });

    res.json({
        success: true,
        accessToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            authProviders: user.authProviders
        }
    });
};

export const signup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {name, email, password} = req.body;

        const existingUser = await User.findOne({email});

        if(existingUser){
            if(existingUser.authProviders.includes('google')){
                return res.status(409).json({
                    success: false,
                    message: 'This email is registered via google. Please login with google'
                });
            }
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists.'
            })
        }

        const user = new User({
            name: name.trim(),
            email: email.trim(),
            password,
            authProviders: ['local'],
            lastLogin: new Date()
        });
        await user.save();
        res.status(201);
        sendTokens(res, user);
    } catch (error) {
        next(error);
        console.log("error in signup function ar auth.controller");
    }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {email, password} = req.body;

        const user = await User.findOne({ email: email}).select('+password');
        if(!user){
            return res.status(401).json({success: false, message: 'Invalid credentials'});
        }
        if(!user.password || !user.authProviders.includes('local')){
            return res.status(401).json({
                success: false,
                message: 'This account uses Google sign-in. Please use the google authentication'
            });
        }

        const isPasswordValid = await user.comparePasswords(password);

        if (!isPasswordValid){
            return res.status(401).json({success: false, message: 'Invalid credentials'});
        }

        user.lastLogin = new Date();
        await user.save();

        sendTokens(res, user);
    } catch (error) {
        next(error);
        console.log("error in login function auth.controller");
    }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.refreshToken;
        if(!token) {
            return res.status(401).json({success: false, message: 'noe refresh token provided'});
        }

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as {userId: string};
        
        const storedToken = await redis.get(`refresh:${decoded.userId}`);
        if (!storedToken || storedToken !== token) {
            return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }
        const user = await User.findById(decoded.userId);
        if(!user) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token'});
        }
        await sendTokens(res, user);
    } catch (error) {
        next(error);
        console.log("error in refreshtoken auth.controller.ts");
    }
}

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const decoded = jwt.decode(token) as { userId: string };
      if (decoded?.userId) {
        await redis.del(`refresh:${decoded.userId}`);
      }
    }

    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
    console.error("error in logout:", error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.user!.userId);
        if(!user){
            return res.status(404).json({ success: false, message: 'User not found'});
        }

        res.json({
            success: true,
            user:{
                id: user._id,
                name: user.name,
                email: user.email,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt,
                authProviders: user.authProviders,
            }
        });
    } catch (error) {
        next(error);
        console.log("error in getme uth.controller");
    }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {name} = req.body;
        const userId = req.user!.userId;

        const user = await User.findByIdAndUpdate(
            userId,
            {name: name.trim()},
            {new: true, runValidators: true}
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                authProviders: user.authProviders
            }
        });
    } catch (error) {
        next(error);
        console.log("error in updateprofile in auth.controller");
    }
}

export const forgotPassword = (req: Request, res: Response, next: NextFunction) => {

}

export const isEmailVerified = (req: Request, res: Response, next: NextFunction) => {

}

export const resetPassword = (req: Request, res: Response, next: NextFunction) => {

}