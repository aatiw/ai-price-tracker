// Transforms a single product document for an API list response
export const transformProductForList = (product: any) => ({
    ...product,
    platforms: Object.fromEntries(product.platforms),
    currentPrices: Object.fromEntries(
        Array.from(product.platforms.entries()).map(([platform, data]: [string, any]) => [
            platform, 
            { price: data.currentPrice, lastUpdated: data.lastScraped }
        ])
    )
});

// Formats price history data for a charting library like Chart.js
export const formatHistoryForChart = (product: any, priceHistory: any) => {
    return Object.entries(priceHistory).map(([platformName, history]: [string, any[]]) => ({
        platform: platformName,
        data: history.map(point => ({
            x: point.date,
            y: point.price,
            availability: point.availability
        })),
        currentPrice: product.platforms.get(platformName)?.currentPrice,
        lastUpdated: product.platforms.get(platformName)?.lastScraped
    }));
};