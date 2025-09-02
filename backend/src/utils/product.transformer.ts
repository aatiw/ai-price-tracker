export const transformProductForList = (product: any) => ({
    ...product,
    platforms: Object.fromEntries(product.platforms as Map<string, any>),
    currentPrices: Object.fromEntries(
        Array.from(product.platforms.entries() as [string, any]).map(([platform, data]) => [
            platform, 
            { price: data.currentPrice, lastUpdated: data.lastScraped }
        ])
    )
});

export const formatHistoryForChart = (product: any, priceHistory: any) => {
    return Object.entries(priceHistory as Record<string, any[]>).map(([platformName, history]) => ({
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