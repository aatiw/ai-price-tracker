import { WatchList } from '../models/WatchList.js';
import { Product } from '../models/Product.js';
import mongoose from 'mongoose';

export const createNewWatchlist = async (data: any, userId: string) => {
    const { name, description, isDefault = false } = data;

    const existing = await WatchList.findOne({ user: userId, name: name.trim() });
    if (existing) {
        throw new Error('Watchlist with this name already exists'); 
    }

    if (isDefault) {
        await WatchList.updateMany({ user: userId, isDefault: true }, { isDefault: false });
    }

    const watchlist = new WatchList({
        user: userId,
        name: name.trim(),
        description: description?.trim(),
        isDefault
    });

    return await watchlist.save();
};

export const findUserWatchlists = (userId: string) => {
    return WatchList.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } },
        {
            $addFields: {
                productCount: { $size: '$products' } 
            }
        },
        { $sort: { isDefault: -1, createdAt: -1 } }
    ]);
};

export const findWatchlistWithProducts = async (watchlistId: string, userId: string, options: any) => {
    const { page = 1, limit = 20, sortBy = 'createdAt' } = options;

    const watchlist = await WatchList.findOne({ _id: watchlistId, user: userId });
    if (!watchlist) return null;

    const sortOptions: any = { [sortBy]: -1 };
    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find({ _id: { $in: watchlist.products } })
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean();
    
    return { watchlist, products };
};

export const updateWatchlistDetails = async (watchlistId: string, userId: string, updates: any) => {
    const { name, description, isDefault } = updates;
    const watchlist = await WatchList.findOne({ _id: watchlistId, user: userId });
    if (!watchlist) return null;

    if (name && name.trim() !== watchlist.name) {
        const existing = await WatchList.findOne({ user: userId, name: name.trim(), _id: { $ne: watchlistId } });
        if (existing) throw new Error('Watchlist with this name already exists');
        watchlist.name = name.trim();
    }

    if (isDefault === true && !watchlist.isDefault) {
        await WatchList.updateMany({ user: userId, isDefault: true }, { isDefault: false });
        watchlist.isDefault = true;
    } else if (isDefault === false) {
        watchlist.isDefault = false;
    }

    if (description !== undefined) watchlist.description = description?.trim();

    return await watchlist.save();
};

export const deleteWatchlistById = (watchlistId: string, userId: string) => {
    return WatchList.findOneAndDelete({ _id: watchlistId, user: userId });
};

export const addProducts = async (watchlistId: string, productIds: string[], userId: string) => {
    const watchlist = await WatchList.findOne({ _id: watchlistId, user: userId });
    if (!watchlist) throw new Error('Watchlist not found or access denied');

    const userProducts = await Product.countDocuments({ _id: { $in: productIds }, user: userId });
    if (userProducts !== productIds.length) {
        throw new Error('One or more products not found or do not belong to the user');
    }
    
    const result = await WatchList.updateOne(
        { _id: watchlistId },
        { $addToSet: { products: { $each: productIds } } } 
    );

    return result;
};

export const removeProduct = async (watchlistId: string, productId: string, userId: string) => {
    return WatchList.updateOne(
        { _id: watchlistId, user: userId },
        { $pull: { products: productId } } 
    );
};