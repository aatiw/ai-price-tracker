import express from "express";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { z } from 'zod';
import { User } from "../models/User";

const router = express.Router();

const generateToken = (userId: string): string => {
    return jwt.sign({userId}, process.env.JWT_SECRET!, {
        expiresIn: '3d'
    });
};

