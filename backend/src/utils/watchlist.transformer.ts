
export const transformWatchlistForList = (watchlist: any) => ({
    id: watchlist._id,
    name: watchlist.name,
    description: watchlist.description,
    isDefault: watchlist.isDefault,
    productCount: watchlist.productCount, 
    createdAt: watchlist.createdAt,
    updatedAt: watchlist.updatedAt
});

export const transformProduct = (product: any) => ({
    ...product,
    platforms: Object.fromEntries(product.platforms || new Map()),
    currentPrices: Object.fromEntries(
        (Array.from(product.platforms?.entries() || []) as [string, any][])
        .map(([platform, data]: [string, any]) => [
            platform, 
            { price: data.currentPrice, lastUpdated: data.lastScraped }
        ])
    )
});