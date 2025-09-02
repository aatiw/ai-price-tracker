import { User } from '../models/User.js'; 
import { Product} from '../models/Product.js';
import { ProductSearch } from '../models/ProductSearch.js';
import { ScrapingService } from '../services/scraping/ScrapingService.js';
import { PriceIntelligenceWorkflow } from '../services/ai/LangChainWorkflows.js';
import { v4 as uuidv4 } from 'uuid';
import type { SortOrder } from 'mongoose';

interface PriceEntry {
  date: Date;
  price: number;
}

const scrapingService = new ScrapingService();
const aiWorkflow = new PriceIntelligenceWorkflow();

export const searchAndAnalyze = async (query: string, userId: string) => {

    const existingSearch = await ProductSearch.findOne({
        User: userId,
        SearchQuery: query,
        createdAt: { $gte: new Date(Date.now() - 7*3600000) }
    });
    if (existingSearch) {
        return { cached: true, data: existingSearch };
    }

    const workflowResult = await aiWorkflow.executeWorkflow(query, userId);

    const results = Array.from(workflowResult.scrapedData.entries() as Iterable<[string, any]>).map(([platform, data]) => ({
        platform,
        url: data.url || `https://${platform}.com/search?q=${encodeURIComponent(query)}`,
        price: data.price || 0,
        availability: data.availability || 'unknown',
        seller: data.seller,
        rating: data.rating,
        reviews: data.reviews,
        delivery: data.delivery,
        lastUpdated: new Date()
    }));

    const searchId = uuidv4();
    const productSearch = new ProductSearch({
        SearchQuery: query,
        searchId,
        results,
        User: userId
    });
    await productSearch.save();

    await incrementUserSearchCount(userId);

    return {
        cached: false,
        data: {
            searchId,
            results,
            aiInsights: {
                marketAnalysis: workflowResult.marketAnalysis,
                recommendations: workflowResult.recommendations,
                pricePredicition: workflowResult.pricePredicition
            }
        }
    };
};

export const createTrackedProduct = async (productData: any, userId: string) => {
    const { title, urls, brand, category, notes } = productData;
    const masterProductId = uuidv4();
    const platformsData = new Map();
    const selectedPlatforms: string[] = [];

    for (const url of urls) {
        try {
            const platform = scrapingService.getPlatformFromUrl(url);
            const scrapedData = await scrapingService.scrapeProduct(url);
            
            const platformEntry = {
                url,
                platformProductId: `${platform}_${Date.now()}`,
                currentPrice: scrapedData.price,
                availability: scrapedData.availability,
                seller: scrapedData.seller,
                rating: scrapedData.rating,
                reviews: scrapedData.reviews,
                priceHistory: [{ date: new Date(), price: scrapedData.price, source: 'scraped' as const, availability: scrapedData.availability }],
                lastScraped: new Date(),
                isActive: true
            };
            platformsData.set(platform, platformEntry);
            selectedPlatforms.push(platform);
        } catch (error) {
            console.error(`Failed to scrape ${url}:`, error);
        }
    }

    if (platformsData.size === 0) {
        throw new Error('Unable to scrape data from any of the provided URLs');
    }

    const product = new Product({
        title: title.trim(),
        brand,
        category,
        masterProductId,
        platforms: platformsData,
        user: userId,
        selectedPlatforms,
        trackingStartDate: new Date(),
        notes
    });
    
    return await product.save();
};

export const findProductsByUser = async (userId: string, options: any) => {
    const { page = 1, limit = 20, category, sortBy = 'createdAt' } = options;
    const query: any = { user: userId };
    if (category && category !== 'all') {
        query.category = category;
    }

    const allowedSortFields = ['createdAt', 'title', 'category'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOptions: Record<string, SortOrder> = { [sortField]: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const products = await Product.find(query).sort(sortOptions).skip(skip).limit(Number(limit)).lean();
    const totalProducts = await Product.countDocuments(query);
    
    return { products, totalProducts, page, limit };
};

export const updateProductDetails = async (productId: string, userId: string, updates: any) => {
    const product = await Product.findOne({ _id: productId, user: userId });
    if (!product) return null;

    if (updates.title) product.title = updates.title.trim();
    if (updates.brand !== undefined) product.brand = updates.brand;
    if (updates.category !== undefined) product.category = updates.category;
    if (updates.notes !== undefined) product.notes = updates.notes;
    if (updates.selectedPlatforms && Array.isArray(updates.selectedPlatforms)) {
        product.selectedPlatforms = updates.selectedPlatforms;
        for (const [platform, data] of product.platforms) {
            data.isActive = updates.selectedPlatforms.includes(platform);
        }
    }

    return await product.save();
};

export const deleteProductById = (productId: string, userId: string) => {
    return Product.findOneAndDelete({ _id: productId, user: userId });
};

export const getProductPriceHistory = async (productId: string, userId: string, options: any) => {
    const { platform, days = 30 } = options;
    const product = await Product.findOne({ _id: productId, user: userId });
    if (!product) return null;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - Number(days));
    const priceHistory: Record<string, PriceEntry[]> = {};

    const platformsToProcess = platform ? [[platform, product.platforms.get(platform)]] : product.platforms.entries();

    for (const [platformName, data] of platformsToProcess) {
        if (data) {
            priceHistory[platformName] = data.priceHistory.filter((p: PriceEntry) => p.date >= fromDate);
        }
    }
    
    return { product, priceHistory, fromDate, days };
};




export const incrementUserSearchCount = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) return;

    if (user.searchCount === 0) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        user.searchLimitResetsAt = nextWeek;
    }

    user.searchCount += 1;
    await user.save();
};