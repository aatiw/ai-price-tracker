import {z} from 'zod';
import type { Request, Response, NextFunction } from 'express';



export const signupSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, {message: 'Name is required'}),
        email: z.string().trim().email({message: 'A valid email is required'}),
        password: z.string().min(6, {message: 'Password must be at least 6 characters'})
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().email({message: 'A valid email is required'}),
        password: z.string().min(1, {message: 'Password is required'}),
    }),
});

export const updateProfileSchema = z.object({
    body: z.object({
        name: z.string(). trim().min(1, {message: 'Name cannot be empty'})
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().trim().email({ message: 'A valid email is required' }),
    }),
});

export const resetPasswordSchema = z.object({
    params: z.object({
        token: z.string().min(1, { message: 'Reset token is required' }),
    }),
    body: z.object({
        password: z.string().min(6, { message: 'New password must be at least 6 characters long' }),
    }),
});

export const validate = (schema: z.ZodObject) =>
    async (req: Request, res: Response, next: NextFunction) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        return next();
    } catch (err: unknown) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Input validation failed',
                errors: err.issues.map((e) => ({ path: e.path.join('.'), message: e.message })),
            });
        }
        return next(err);
    }
};