
import type { Request, Response, NextFunction } from 'express';
import * as WatchlistService from '../services/watchlist.service.js';
import * as WatchlistTransformer from '../utils/watchlist.transformer.js';
import mongoose from 'mongoose';

export const createWatchlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body.name || !req.body.name.trim()) {
            return res.status(400).json({ success: false, message: 'Watchlist name is required' });
        }
        const watchlist = await WatchlistService.createNewWatchlist(req.body, req.user!.userId);
        res.status(201).json({ success: true, message: 'Watchlist created', watchlist });
    } catch (error:any) {
        if (error.message.includes('already exists')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

export const getUserWatchlists = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const watchlists = await WatchlistService.findUserWatchlists(req.user!.userId);
        const transformed = watchlists.map(WatchlistTransformer.transformWatchlistForList);
        res.json({ success: true, watchlists: transformed });
    } catch (error) {
        next(error);
    }
};

export const getWatchlistProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await WatchlistService.findWatchlistWithProducts(req.params.id!, req.user!.userId, req.query);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Watchlist not found' });
        }

        const { watchlist, products } = result;
        const totalProducts = watchlist.products.length;
        const limit = Number(req.query.limit) || 20;

        res.json({
            success: true,
            watchlist: { id: watchlist._id, name: watchlist.name },
            products: products.map(WatchlistTransformer.transformProduct),
            pagination: {
                currentPage: Number(req.query.page) || 1,
                totalPages: Math.ceil(totalProducts / limit),
                totalProducts
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updateWatchlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const watchlist = await WatchlistService.updateWatchlistDetails(req.params.id!, req.user!.userId, req.body);
        if (!watchlist) {
            return res.status(404).json({ success: false, message: 'Watchlist not found' });
        }
        res.json({ success: true, message: 'Watchlist updated', watchlist });
    } catch (error:any) {
        if (error.message.includes('already exists')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        next(error);
    }
};

export const deleteWatchlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const watchlist = await WatchlistService.deleteWatchlistById(req.params.id!, req.user!.userId);
        if (!watchlist) {
            return res.status(404).json({ success: false, message: 'Watchlist not found' });
        }
        res.json({ success: true, message: 'Watchlist deleted' });
    } catch (error) {
        next(error);
    }
};

export const addProductsToWatchlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { productIds } = req.body;
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Product IDs array is required' });
        }
        await WatchlistService.addProducts(req.params.id!, productIds, req.user!.userId);
        res.json({ success: true, message: 'Products added to watchlist' });
    } catch (error: any) {
        if (error.message.includes('not found')) {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};


export const removeProductFromWatchlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id, productId } = req.params;
        const result = await WatchlistService.removeProduct(id!, productId!, req.user!.userId);
        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Watchlist or product not found' });
        }
        res.json({ success: true, message: 'Product removed from watchlist' });
    } catch (error) {
        next(error);
    }
};