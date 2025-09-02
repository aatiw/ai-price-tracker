import type { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';

// Helper function to handle validation results
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: errors.array()
        });
    }
    next();
};

export const productValidation = {
    search: [
        body('query')
            .trim()
            .isLength({ min: 2, max: 500 })
            .withMessage('Search query must be between 2 and 200 characters'),
        body('platforms')
            .optional()
            .isArray()
            .withMessage('Platforms must be an array')
            .custom((platforms) => {
                const validPlatforms = ['amazon', 'flipkart', 'myntra', 'meesho'];
                return platforms.every((platform: string) => validPlatforms.includes(platform));
            })
            .withMessage('Invalid platform specified'),
        handleValidationErrors
    ],

    track: [
        body('title')
            .trim()
            .isLength({ min: 2, max: 500 })
            .withMessage('Product title must be between 2 and 500 characters'),
        body('urls')
            .isArray({ min: 1 })
            .withMessage('At least one URL is required')
            .custom((urls) => {
                return urls.every((url: string) => {
                    try {
                        new URL(url);
                        return true;
                    } catch {
                        return false;
                    }
                });
            })
            .withMessage('All URLs must be valid'),
        body('brand')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Brand name cannot exceed 100 characters'),
        body('category')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Category cannot exceed 100 characters'),
        body('notes')
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage('Notes cannot exceed 1000 characters'),
        handleValidationErrors
    ],

    update: [
        param('id')
            .isMongoId()
            .withMessage('Invalid product ID'),
        body('title')
            .optional()
            .trim()
            .isLength({ min: 2, max: 500 })
            .withMessage('Product title must be between 2 and 500 characters'),
        body('brand')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Brand name cannot exceed 100 characters'),
        body('category')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Category cannot exceed 100 characters'),
        body('selectedPlatforms')
            .optional()
            .isArray()
            .withMessage('Selected platforms must be an array'),
        body('notes')
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage('Notes cannot exceed 1000 characters'),
        handleValidationErrors
    ]
};

export const watchlistValidation = {
    create: [
        body('name')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Watchlist name must be between 1 and 100 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
        body('isDefault')
            .optional()
            .isBoolean()
            .withMessage('isDefault must be a boolean'),
        handleValidationErrors
    ],

    update: [
        param('id')
            .isMongoId()
            .withMessage('Invalid watchlist ID'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Watchlist name must be between 1 and 100 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description cannot exceed 500 characters'),
        body('isDefault')
            .optional()
            .isBoolean()
            .withMessage('isDefault must be a boolean'),
        handleValidationErrors
    ],

    addProducts: [
        param('id')
            .isMongoId()
            .withMessage('Invalid watchlist ID'),
        body('productIds')
            .isArray({ min: 1 })
            .withMessage('At least one product ID is required')
            .custom((productIds) => {
                return productIds.every((id: string) => /^[0-9a-fA-F]{24}$/.test(id));
            })
            .withMessage('All product IDs must be valid MongoDB ObjectIds'),
        handleValidationErrors
    ]
};