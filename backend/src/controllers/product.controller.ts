import type { Request, Response, NextFunction } from 'express';
import * as ProductService from '../services/product.service.js';
import * as ProductTransformer from '../utils/product.transformer.js';

// POST /api/products/search
export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { query } = req.body;
        const userId = req.user!.userId;
        if (!query || !query.trim()) {
            return res.status(400).json({ success: false, message: 'Search query is required' });
        }
        
        const { cached, data } = await ProductService.searchAndAnalyze(query.trim(), userId);
        
        const responseData = cached ? {
            success: true,
            message: 'Results from recent search',
            searchId: data.searchId,
            results: data.results,
            cachedAt: (data as any).createdAt
        } : {
            success: true,
            message: 'Product search completed',
            searchId: data.searchId,
            results: data.results,
            aiInsights: (data as any).aiInsights
        };

        res.json(responseData);
    } catch (error) {
        next(error);
    }
};

// POST /api/products/track
export const trackProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { title, urls } = req.body;
        if (!title || !urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ success: false, message: 'Product title and at least one URL are required' });
        }

        const product = await ProductService.createTrackedProduct(req.body, req.user!.userId);
        
        res.status(201).json({
            success: true,
            message: 'Product added to tracking',
            product: {
                id: product._id,
                title: product.title,
                masterProductId: product.masterProductId,
                platforms: Object.fromEntries(product.platforms),
                selectedPlatforms: product.selectedPlatforms
            }
        });
    } catch (error: any) {
        if (error.message.includes('Unable to scrape')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// GET /api/products/user/:userId
export const getUserProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { products, totalProducts, page, limit } = await ProductService.findProductsByUser(req.user!.userId, req.query);

        const transformedProducts = products.map(ProductTransformer.transformProductForList);
        const totalPages = Math.ceil(totalProducts / Number(limit));

        res.json({
            success: true,
            products: transformedProducts,
            pagination: {
                currentPage: Number(page),
                totalPages,
                totalProducts,
                hasMore: (Number(page) * Number(limit)) < totalProducts
            }
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const updatedProduct = await ProductService.updateProductDetails(req.params.id!, req.user!.userId, req.body);
        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: 'Product not found or access denied' });
        }
        res.json({ success: true, message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const deletedProduct = await ProductService.deleteProductById(req.params.id!, req.user!.userId);
        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: 'Product not found or access denied' });
        }
        res.json({ success: true, message: 'Product removed from tracking' });
    } catch (error) {
        next(error);
    }
};

// GET /api/products/:id/history
export const getProductHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ProductService.getProductPriceHistory(req.params.id!, req.user!.userId, req.query);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Product not found or access denied' });
        }
        
        const chartData = ProductTransformer.formatHistoryForChart(result.product, result.priceHistory);

        res.json({
            success: true,
            productTitle: result.product.title,
            priceHistory: chartData,
            dateRange: { from: result.fromDate, to: new Date(), days: Number(result.days) }
        });
    } catch (error) {
        next(error);
    }
};