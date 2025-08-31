import express from "express";
import type { NextFunction, Request, Response } from "express";
import cookieParser from 'cookie-parser';
import connectDb from "./config/db.js";
import authRoutes from './routes/auth.js';

const app = express();
app.use(express.json());
app.use(cookieParser())

connectDb();

app.use('/api/auth', authRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message,
    });
});

app.get("/", function(req: Request, res: Response) {
    console.log("welcome to the first get request");
    res.send("hello word");
}) 

app.listen(5000, () => {
    console.log("listenting on port 3000")
});