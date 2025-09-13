export interface PricePoint {
  date: Date;
  price: number;
  source: 'scraped' | 'historical_api' | 'manual' | 'ai_fetched' | 'ai_updated';
  availability?: 'in_stock' | 'out_of_stock' | 'limited_stock';
}

export interface PlatformData {
  url: string;
  platformProductId: string;
  currentPrice: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited_stock';
  seller?: string;
  rating?: number;
  reviews?: number;
  priceHistory: PricePoint[];
  lastScraped: Date;
  isActive: boolean;
  originalPrice?: number;
  discount?: number;
  delivery?: string;
  features?: string[];
  specifications?: Record<string, string>;
}

export interface ProductVariant {
  platform: string;
  url: string;
  price: number;
  availability: string;
  seller?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  lastUpdated: Date;
  title?: string;
  brand?: string;
  category?: string;
  originalPrice?: number;
  discount?: number;
}

export interface MarketAnalysis {
  averagePrice: number;
  priceRange: { min: number; max: number };
  bestDeal: { 
    platform: string; 
    price: number; 
    reason: string;
    savings?: number;
  };
  marketTrend: 'rising' | 'falling' | 'stable';
  recommendedAction: 'buy_now' | 'wait' | 'monitor';
  confidence: number;
  insights: string[];
  competitorCount: number;
  priceDispersion: number;
}

export interface PricePrediction {
  nextWeekRange: { min: number; max: number };
  nextMonthRange: { min: number; max: number };
  confidence: number;
  factors: string[];
  bestTimeToBuy: string;
  seasonalTrends?: {
    peak: string;
    low: string;
    current: 'peak' | 'low' | 'normal';
  };
}

export interface AIRecommendation {
  primaryAction: string;
  reasoning: string[];
  urgency: 'low' | 'medium' | 'high';
  alternativeActions: string[];
  bestDeal: {
    platform: string;
    price: number;
    savings: number;
    reason: string;
  };
  priceInsights: {
    currentRange: string;
    predictedNextWeek: string;
    trend: string;
    confidence: number;
  };
  timeframe: string;
  riskAssessment: 'low' | 'medium' | 'high';
}

export interface SearchResult {
  cached: boolean;
  data: {
    searchId: string;
    results: ProductVariant[];
    aiInsights: {
      marketAnalysis: MarketAnalysis;
      recommendations: AIRecommendation;
      pricePredicition: PricePrediction;
    };
    cachedAt?: Date;
  };
}

export interface TrackingResult {
  productId: string;
  title: string;
  masterProductId: string;
  platforms: Map<string, PlatformData>;
  selectedPlatforms: string[];
  success: boolean;
  error?: string;
}

export interface PriceUpdateResult {
  updated: boolean;
  product: any;
  changes: Array<{
    platform: string;
    oldPrice: number;
    newPrice: number;
    priceChange: number;
    percentChange: number;
  }>;
  alertsTriggered: Array<{
    type: 'price_drop' | 'price_rise' | 'back_in_stock';
    platform: string;
    details: string;
  }>;
}

export interface BulkUpdateResult {
  totalProcessed: number;
  successfulUpdates: number;
  results: Array<{
    productId: string;
    title: string;
    updated: boolean;
    error: string | null;
  }>;
}

export interface UserSearchLimits {
  searchCount: number;
  searchLimitResetsAt?: Date;
  dailySearchLimit: number;
  weeklySearchLimit: number;
  isPremium: boolean;
}

export interface ProductStatistics {
  totalProducts: number;
  activeProducts: number;
  totalPlatforms: number;
  averagePriceTracked: number;
  totalSavingsIdentified: number;
  priceAlertsTriggered: number;
  lastUpdateTime: Date;
}

export interface PlatformAvailability {
  platform: string;
  isAvailable: boolean;
  lastChecked: Date;
  responseTime?: number;
  errorRate: number;
}

export interface APIUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsToday: number;
  requestsThisWeek: number;
  remainingQuota: number;
}

// Error types
export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.name = 'ProductNotFoundError';
  }
}

export class PlatformUnavailableError extends Error {
  constructor(platform: string) {
    super(`Platform unavailable: ${platform}`);
    this.name = 'PlatformUnavailableError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(limit: number, resetTime: Date) {
    super(`Rate limit exceeded. Limit: ${limit}. Resets at: ${resetTime}`);
    this.name = 'RateLimitExceededError';
  }
}

export class AIServiceError extends Error {
  constructor(service: string, originalError: string) {
    super(`AI service failed: ${service}. Error: ${originalError}`);
    this.name = 'AIServiceError';
  }
}

// Utility types
export type Platform = 'amazon' | 'flipkart' | 'myntra' | 'meesho' | 'nykaa' | 'ajio';
export type PriceSource = 'scraped' | 'historical_api' | 'manual' | 'ai_fetched' | 'ai_updated';
export type AvailabilityStatus = 'in_stock' | 'out_of_stock' | 'limited_stock';
export type TrendDirection = 'rising' | 'falling' | 'stable';
export type RecommendedAction = 'buy_now' | 'wait' | 'monitor';
export type UrgencyLevel = 'low' | 'medium' | 'high';
export type VolatilityLevel = 'low' | 'medium' | 'high';

// Request/Response interfaces
export interface SearchProductsRequest {
  query: string;
  platforms?: Platform[];
  maxResults?: number;
  includeOutOfStock?: boolean;
}

export interface TrackProductRequest {
  title: string;
  urls: string[];
  brand?: string;
  category?: string;
  notes?: string;
  alertThresholds?: {
    priceDropPercentage?: number;
    priceDropAmount?: number;
    backInStock?: boolean;
  };
}