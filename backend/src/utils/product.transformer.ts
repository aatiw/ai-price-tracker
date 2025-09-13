import { GoogleGenerativeAI } from "@google/generative-ai";

interface ProductForList {
  id: string;
  title: string;
  brand?: string;
  category?: string;
  masterProductId: string;
  platformCount: number;
  activePlatforms: string[];
  currentPrices: PlatformPrice[];
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceRange: string;
  trackingStartDate: Date;
  lastUpdated: Date;
  notes?: string;
  availability: {
    inStock: number;
    outOfStock: number;
    limited: number;
  };
}

interface PlatformPrice {
  platform: string;
  price: number;
  availability: string;
  seller?: string;
  rating?: number;
  url: string;
  lastScraped: Date;
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  [platform: string]: string | number; // Dynamic platform names as keys
}

export const transformProductForList = (product: any): ProductForList => {
  const platforms = Array.from(product.platforms.entries());
  const activePlatforms = platforms.filter(([_, data]) => data.isActive);
  const prices = activePlatforms.map(([_, data]) => data.currentPrice).filter(p => p > 0);
  
  const currentPrices: PlatformPrice[] = activePlatforms.map(([platform, data]) => ({
    platform,
    price: data.currentPrice,
    availability: data.availability,
    seller: data.seller,
    rating: data.rating,
    url: data.url,
    lastScraped: data.lastScraped
  }));

  // Calculate availability counts
  const availability = activePlatforms.reduce((acc, [_, data]) => {
    if (data.availability === 'in_stock') acc.inStock++;
    else if (data.availability === 'out_of_stock') acc.outOfStock++;
    else acc.limited++;
    return acc;
  }, { inStock: 0, outOfStock: 0, limited: 0 });

  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const averagePrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  
  // Find most recent update across all platforms
  const lastUpdated = activePlatforms.reduce((latest, [_, data]) => {
    return data.lastScraped > latest ? data.lastScraped : latest;
  }, new Date(0));

  return {
    id: product._id.toString(),
    title: product.title,
    brand: product.brand,
    category: product.category,
    masterProductId: product.masterProductId,
    platformCount: platforms.length,
    activePlatforms: activePlatforms.map(([platform]) => platform),
    currentPrices,
    lowestPrice,
    highestPrice,
    averagePrice,
    priceRange: lowestPrice === highestPrice ? `₹${lowestPrice}` : `₹${lowestPrice} - ₹${highestPrice}`,
    trackingStartDate: product.trackingStartDate,
    lastUpdated,
    notes: product.notes,
    availability
  };
};

export const transformProductForDetail = (product: any) => {
  const platforms = Object.fromEntries(product.platforms);
  
  return {
    id: product._id.toString(),
    title: product.title,
    brand: product.brand,
    category: product.category,
    masterProductId: product.masterProductId,
    platforms,
    selectedPlatforms: product.selectedPlatforms,
    trackingStartDate: product.trackingStartDate,
    historicalDataStatus: product.historicalDataStatus,
    notes: product.notes,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
};

export const formatHistoryForChart = (product: any, priceHistory: Record<string, any[]>): ChartDataPoint[] => {
  // Collect all unique dates from all platforms
  const allDates = new Set<string>();
  const platformData: Record<string, Record<string, number>> = {};

  // Process each platform's price history
  Object.entries(priceHistory).forEach(([platform, history]) => {
    platformData[platform] = {};
    history.forEach((point: any) => {
      const dateStr = point.date.toISOString().split('T')[0]; // YYYY-MM-DD format
      allDates.add(dateStr);
      platformData[platform][dateStr] = point.price;
    });
  });

  // Convert to chart-friendly format
  const chartData: ChartDataPoint[] = Array.from(allDates)
    .sort()
    .map(dateStr => {
      const dataPoint: ChartDataPoint = {
        date: formatDateForDisplay(dateStr),
        timestamp: new Date(dateStr).getTime()
      };

      // Add price data for each platform
      Object.keys(platformData).forEach(platform => {
        dataPoint[platform] = platformData[platform][dateStr] || null;
      });

      return dataPoint;
    });

  return chartData;
};

export const formatPriceChange = (currentPrice: number, previousPrice: number): string => {
  if (!previousPrice || previousPrice === 0) return 'New';
  
  const change = currentPrice - previousPrice;
  const percentChange = Math.round((change / previousPrice) * 100);
  
  if (change > 0) {
    return `↑₹${change} (+${percentChange}%)`;
  } else if (change < 0) {
    return `↓₹${Math.abs(change)} (${percentChange}%)`;
  }
  return 'No change';
};

export const formatAvailabilityStatus = (availability: string): { text: string; color: string } => {
  switch (availability) {
    case 'in_stock':
      return { text: 'In Stock', color: 'green' };
    case 'out_of_stock':
      return { text: 'Out of Stock', color: 'red' };
    case 'limited_stock':
      return { text: 'Limited Stock', color: 'orange' };
    default:
      return { text: 'Unknown', color: 'gray' };
  }
};

export const formatPlatformName = (platform: string): string => {
  const platformNames: Record<string, string> = {
    amazon: 'Amazon',
    flipkart: 'Flipkart',
    myntra: 'Myntra',
    meesho: 'Meesho',
    nykaa: 'Nykaa',
    ajio: 'AJIO'
  };
  return platformNames[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
};

export const calculateSavings = (currentPrice: number, originalPrice?: number): { amount: number; percentage: number } | null => {
  if (!originalPrice || originalPrice <= currentPrice) return null;
  
  const amount = originalPrice - currentPrice;
  const percentage = Math.round((amount / originalPrice) * 100);
  
  return { amount, percentage };
};

export const formatDateForDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

export const getPriceStatistics = (priceHistory: any[]): {
  min: number;
  max: number;
  average: number;
  trend: 'rising' | 'falling' | 'stable';
  volatility: 'low' | 'medium' | 'high';
} => {
  if (priceHistory.length === 0) {
    return { min: 0, max: 0, average: 0, trend: 'stable', volatility: 'low' };
  }

  const prices = priceHistory.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  // Calculate trend (last 5 data points vs previous 5)
  let trend: 'rising' | 'falling' | 'stable' = 'stable';
  if (prices.length >= 10) {
    const recent = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const previous = prices.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    const change = ((recent - previous) / previous) * 100;
    
    if (change > 5) trend = 'rising';
    else if (change < -5) trend = 'falling';
  }

  // Calculate volatility based on price variance
  const variance = prices.reduce((acc, price) => acc + Math.pow(price - average, 2), 0) / prices.length;
  const stdDeviation = Math.sqrt(variance);
  const coefficientOfVariation = (stdDeviation / average) * 100;
  
  let volatility: 'low' | 'medium' | 'high';
  if (coefficientOfVariation < 10) volatility = 'low';
  else if (coefficientOfVariation < 25) volatility = 'medium';
  else volatility = 'high';

  return { min, max, average, trend, volatility };
};

export const transformSearchResults = (results: any[]) => {
  return results.map(result => ({
    ...result,
    platformName: formatPlatformName(result.platform),
    formattedPrice: formatCurrency(result.price),
    availabilityStatus: formatAvailabilityStatus(result.availability),
    savings: result.originalPrice ? calculateSavings(result.price, result.originalPrice) : null,
    lastUpdatedFormatted: formatDateForDisplay(result.lastUpdated)
  }));
};