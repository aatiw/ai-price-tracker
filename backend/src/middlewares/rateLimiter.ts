import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
    windowMs: 6*60*1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message:{
        success: false,
        message: 'To many requests hit from one IP adress, try again after 6 hours'
    }
})