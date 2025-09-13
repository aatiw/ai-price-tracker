import { User } from '../models/User.js'; 
import { Product} from '../models/Product.js';
import { ProductSearch } from '../models/ProductSearch.js';
import { PriceIntelligenceWorkflow } from '../services/ai/LangChainWorkflows.js';
import { v4 as uuidv4 } from 'uuid';
import type { SortOrder } from 'mongoose';

interface PriceEntry {
  date: Date;
  price: number;
}

const aiWorkflow = new PriceIntelligenceWorkflow();
const productIntelligence = new ProductIntelligenceService();

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

    try {
        const trackingResults = await aiWorkflow.executeTrackingWorkflow(urls, userId);
        
        if (trackingResults.size === 0) {
            throw new Error('Unable to fetch product data from any of the provided URLs');
        }

        // Process results from AI service
        for (const [platform, data] of trackingResults.entries()) {
            const platformEntry = {
                url: data.url,
                platformProductId: `${platform}_${Date.now()}`,
                currentPrice: data.price,
                availability: data.availability,
                seller: data.seller,
                rating: data.rating,
                reviews: data.reviews,
                priceHistory: [{ 
                    date: new Date(), 
                    price: data.price, 
                    source: 'ai_fetched' as const, 
                    availability: data.availability 
                }],
                lastScraped: new Date(),
                isActive: true
            };
            platformsData.set(platform, platformEntry);
            selectedPlatforms.push(platform);
        }

        const product = new Product({
            title: title.trim(),
            brand: brand || Array.from(trackingResults.values())[0]?.brand,
            category: category || Array.from(trackingResults.values())[0]?.category,
            masterProductId,
            platforms: platformsData,
            user: userId,
            selectedPlatforms,
            trackingStartDate: new Date(),
            notes
        });
        
        return await product.save();
    } catch (error) {
        console.error('Product tracking creation failed:', error);
        throw new Error(`Failed to create tracked product: ${error}`);
    }
};

export const updateProductPrices = async (productId: string, userId: string) => {
    const product = await Product.findOne({ _id: productId, user: userId });
    if (!product) {
        throw new Error('Product not found');
    }

    const updatedPlatforms = new Map();
    let hasUpdates = false;

    // Update prices using AI service for each tracked platform
    for (const [platform, platformData] of product.platforms.entries()) {
        if (!platformData.isActive) {
            updatedPlatforms.set(platform, platformData);
            continue;
        }

        try {
            const updatedData = await productIntelligence.getProductByUrl(platformData.url);
            
            if (updatedData && updatedData.price !== platformData.currentPrice) {
                // Price changed - add to history
                platformData.priceHistory.push({
                    date: new Date(),
                    price: updatedData.price,
                    source: 'ai_updated' as const,
                    availability: updatedData.availability
                });

                // Update current data
                platformData.currentPrice = updatedData.price;
                platformData.availability = updatedData.availability;
                platformData.seller = updatedData.seller;
                platformData.rating = updatedData.rating;
                platformData.reviews = updatedData.reviews;
                platformData.lastScraped = new Date();
                
                hasUpdates = true;
                console.log(`Price updated for ${platform}: ₹${updatedData.price}`);
            }
            
            updatedPlatforms.set(platform, platformData);
        } catch (error) {
            console.error(`Failed to update ${platform}:`, error);
            // Keep existing data if update fails
            updatedPlatforms.set(platform, platformData);
        }
    }

    if (hasUpdates) {
        product.platforms = updatedPlatforms;
        await product.save();
        
        // Check for price alerts
        const currentPrices = new Map();
        for (const [platform, data] of updatedPlatforms.entries()) {
            currentPrices.set(platform, data.currentPrice);
        }
        
        await aiWorkflow.checkPriceAlerts(productId, currentPrices);
    }

    return { updated: hasUpdates, product };
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

export const getMarketAnalysis = async (productId: string, userId: string) => {
    const product = await Product.findOne({ _id: productId, user: userId });
    if (!product) return null;

    // Get current prices from all platforms
    const currentProducts = [];
    for (const [platform, data] of product.platforms.entries()) {
        if (data.isActive) {
            currentProducts.push({
                platform,
                title: product.title,
                price: data.currentPrice,
                availability: data.availability,
                seller: data.seller,
                rating: data.rating,
                reviews: data.reviews,
                url: data.url
            });
        }
    }

    if (currentProducts.length === 0) {
        return { error: 'No active platforms for analysis' };
    }

    try {
        // Use AI service for comprehensive analysis
        const marketAnalysis = await productIntelligence.analyzeMarket(currentProducts);
        const pricePrediction = await productIntelligence.predictPriceTrends(currentProducts, {
            historicalData: Array.from(product.platforms.values()).map(p => p.priceHistory)
        });

        return {
            product: {
                id: product._id,
                title: product.title,
                category: product.category,
                trackingStartDate: product.trackingStartDate
            },
            marketAnalysis,
            pricePrediction,
            currentPlatforms: currentProducts,
            lastUpdated: new Date()
        };
    } catch (error) {
        console.error('Market analysis failed:', error);
        return { error: 'Failed to analyze market data' };
    }
};

export const refreshProductData = async (productId: string, userId: string) => {
    // Refresh all platform data for a product
    return await updateProductPrices(productId, userId);
};

export const bulkUpdatePrices = async (userId: string, productIds?: string[]) => {
    const query: any = { user: userId };
    if (productIds && productIds.length > 0) {
        query._id = { $in: productIds };
    }

    const products = await Product.find(query).limit(50); // Limit for API efficiency
    const results = [];

    for (const product of products) {
        try {
            const updateResult = await updateProductPrices(product._id.toString(), userId);
            results.push({
                productId: product._id,
                title: product.title,
                updated: updateResult.updated,
                error: null
            });
        } catch (error) {
            results.push({
                productId: product._id,
                title: product.title,
                updated: false,
                error: error.message
            });
        }
    }

    return {
        totalProcessed: results.length,
        successfulUpdates: results.filter(r => r.updated).length,
        results
    };
};

export const getPlatformFromUrl = (url: string): string => {
    return productIntelligence.getPlatformFromUrl(url);
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




export { productIntelligence, aiWorkflow };