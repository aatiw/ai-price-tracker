import express from "express";
import { authRateLimit } from "../middlewares/rateLimiter.js";
import * as authController from '../controllers/auth.controller.js';
import { loginSchema, signupSchema, validate } from "../middlewares/authValidationSchema.js";
import { auth } from "../middlewares/authentication.middleware.js";

const router = express.Router();

router.post('/signup', authRateLimit, validate(signupSchema), authController.signup);
router.post('/login', authRateLimit, validate(loginSchema), authController.login);
router.post('/logout', auth, authController.logout);

// forgot password;

router.get("/me", auth, authController.getMe);
router.put('/profile', auth, authController.updateProfile);

export default router;