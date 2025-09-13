import { getConfiguredAI, makeStreamingRequest, rateLimiter } from '../config/geminiConfig.js';

interface ProductDetails {
  title: string;
  brand?: string;
  category?: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  availability: "in_stock" | "out_of_stock" | "limited_stock";
  seller?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  image?: string;
  url: string;
  platform: string;
  features?: string[];
  specifications?: Record<string, string>;
}

interface MarketAnalysis {
  averagePrice: number;
  priceRange: { min: number; max: number };
  bestDeal: { platform: string; price: number; reason: string };
  EMI: { platform: string; reason: string };
  marketTrend: "rising" | "falling" | "stable";
  recommendedAction: "buy_now" | "wait" | "monitor";
  confidence: number;
  insights: string[];
}

interface PricePrediction {
  nextMonthRange: { min: number; max: number };
  confidence: number;
  factors: string[];
  bestTimeToBuy: string;
}

export class ProductIntelligenceService {
  private ai: any;
  private model: string;
  private config: any;

  constructor() {
    const { ai, config, model } = getConfiguredAI();
    this.ai = ai;
    this.config = config;
    this.model = model;
  }

  private async makeGeminiRequest(prompt: string): Promise<string> {
    if (!rateLimiter.canMakeRequest()) {
      throw new Error('Rate limit exceeded. Remaining: ' + JSON.stringify(rateLimiter.getRemainingRequests()));
    }
    rateLimiter.recordRequest();

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    return makeStreamingRequest(this.ai, this.model, this.config, contents);
  }

  async searchProductsAcrossPlatforms(query: string): Promise<ProductDetails[]> {
    const prompt = `
    Search for "${query}" across on Amazon India, Flipkart, Myntra, Meesho and one more e-commerce website that provides cheap selling
    price for the same product.
    
    For each platform where this product is available, provide:
    - Exact product title
    - Current price in INR
    - Original price (if discounted)
    - Availability status
    - Seller name
    - Rating (out of 5)
    - Number of reviews
    - Delivery information
    - Product category
    - Brand name
    - Key features (top 3-5)
    - Product URL (realistic format)

    Return ONLY a JSON array with this exact structure:
    [
      {
        "title": "Product Title",
        "brand": "Brand Name",
        "category": "Category",
        "price": 1599,
        "originalPrice": 1999,
        "discount": 20,
        "availability": "in_stock",
        "seller": "Seller Name",
        "rating": 4.2,
        "reviews": 1523,
        "delivery": "Free delivery by Tomorrow",
        "platform": "amazon",
        "features": ["Feature 1", "Feature 2"],
        "url": "https://amazon.in/product-url"
      }
    ]

    Important: 
    - Use realistic Indian pricing
    - Include at least 2-3 platforms where available
    - Use platform names: "amazon", "flipkart", "myntra", "meesho"
    - Return valid JSON only, no additional text
    `;

    try {
      const text = await this.makeGeminiRequest(prompt);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response");
      }

      const products: ProductDetails[] = JSON.parse(jsonMatch[0]);
      return products.map((product) => ({
        ...product,
        url: product.url || this.generatePlatformUrl(product.platform, query),
      }));
    } catch (error) {
      console.error("Error searching products:", error);
      return this.getFallbackResults(query);
    }
  }

  async analyzeMarket(products: ProductDetails[]): Promise<MarketAnalysis> {
    if (products.length === 0) {
      throw new Error("No products to analyze");
    }

    const prompt = `
    Analyze this market data for pricing intelligence:
    
    Products: ${JSON.stringify(products, null, 2)}
    
    Provide market analysis with:
    1. Average price across platforms
    2. Price range (min/max)
    3. Best deal identification with reasoning
    4. no-cost EMI offer(check for platforms which specifically mention about no cost emi for that product, generally expensive items
    have this offer, also mention 2-3 banks offers the no cost emi feature; do not mention anything if you cannot find)
    5. Market trend analysis
    6. Purchase recommendation (buy_now/wait/monitor)
    7. Confidence level (0-100)
    8. Key insights about pricing patterns

    Consider factors like:
    - Price variations between platforms
    - Discount patterns
    - Delivery date with respect to pin-code
    - Stock availability

    Return ONLY JSON with this structure:
    {
      "averagePrice": 1750,
      "priceRange": {"min": 1299, "max": 2199},
      "bestDeal": {"platform": "flipkart", "price": 1299, "reason": "Lowest price with good seller rating"},
      "EMI": {"platform": "amazon", "reason": "ICICI bank is offering this service as mentioned in the offers section"}
      "marketTrend": "falling",
      "recommendedAction": "buy_now",
      "confidence": 85,
      "insights": ["Price dropped 15% this week", "High demand product", "Limited stock on best deal"]
    }
    `;

    try {
      const result = await this.makeGeminiRequest(prompt);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getFallbackAnalysis(products);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Error analyzing market:", error);
      return this.getFallbackAnalysis(products);
    }
  }

  async predictPriceTrends(products: ProductDetails[],historicalData?: any): Promise<PricePrediction> {
    const prompt = `
    Predict price trends for this product based on current market data:
    
    Current Products: ${JSON.stringify(products.slice(0, 3), null, 2)}
    ${
      historicalData ? `Historical Data: ${JSON.stringify(historicalData)}` : ""
    }
    
    Consider factors:
    - Current price variations
    - Seasonal trends in India
    - Festival/sale seasons
    - Product category behavior
    - Market competition
    
    Predict:
    1. Price range for next month(generally during festive seasons, prices dips by 5-10% on phones, 10-20% on laptops, make
    some dummy assumption about price dips and price rise according to your own analysis on date and give the prices, it can be incorrect
    but there should be a realistic rationale behinde the price dips and rise)
    2. Confidence level
    3. Key factors affecting price
    4. Best time to buy recommendation

    Return ONLY JSON:
    {
      "nextMonthRange": {"min": 1150, "max": 1500},
      "confidence": 75,
      "factors": ["Upcoming sale season", "High competition", "Stock levels"],
      "bestTimeToBuy": "Wait for next week's sale"
    }
    `;

    try {
      const result = await this.makeGeminiRequest(prompt);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getFallbackPrediction(products);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Error predicting trends:", error);
      return this.getFallbackPrediction(products);
    }
  }

  async getProductByUrl(url: string): Promise<ProductDetails | null> {
    const platform = this.getPlatformFromUrl(url);

    const prompt = `
    Extract detailed product information from this ${platform} URL: ${url}
    
    Provide current product details:
    - Title, brand, category
    - Current price in INR
    - Original price if discounted
    - Availability status
    - Seller information
    - Ratings and reviews
    - Key features
    - Delivery information
    
    Return ONLY JSON with ProductDetails structure:
    {
      "title": "Product Title",
      "brand": "Brand",
      "category": "Category", 
      "price": 1599,
      "availability": "in_stock",
      "platform": "${platform}",
      "url": "${url}"
    }
    `;

    try {
      const result = await this.makeGeminiRequest(prompt);
      
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const product: ProductDetails = JSON.parse(jsonMatch[0]);
      return { ...product, platform, url };
    } catch (error) {
      console.error('Error extracting product from URL:', error);
      return null;
    }
  }

  getPlatformFromUrl(url: string): string {
    if (url.includes("amazon")) return "amazon";
    if (url.includes("flipkart")) return "flipkart";
    if (url.includes("myntra")) return "myntra";
    if (url.includes("meesho")) return "meesho";
    if (url.includes("nykaa")) return "nykaa";
    if (url.includes("ajio")) return "ajio";
    return "unknown";
  }

  private generatePlatformUrl(platform: string, query: string): string {
    const encodedQuery = encodeURIComponent(query);
    const urls = {
      amazon: `https://www.amazon.in/s?k=${encodedQuery}`,
      flipkart: `https://www.flipkart.com/search?q=${encodedQuery}`,
      myntra: `https://www.myntra.com/${encodedQuery}`,
      meesho: `https://www.meesho.com/search?q=${encodedQuery}`,
    };
    return (
      urls[platform as keyof typeof urls] ||
      `https://www.google.com/search?q=${encodedQuery}`
    );
  }

  private getFallbackResults(query: string): ProductDetails[] {
    return [
      {
        title: `${query} - Product Not Found`,
        price: 0,
        availability: "out_of_stock" as const,
        platform: "unknown",
        url: "#",
      },
    ];
  }

  private getFallbackAnalysis(products: ProductDetails[]): MarketAnalysis {
    const prices = products.map((p) => p.price).filter((p) => p > 0);
    const avgPrice =
      prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    return {
      averagePrice: avgPrice,
      priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      bestDeal: {
        platform: products[0]?.platform || "unknown",
        price: Math.min(...prices),
        reason: "Lowest available price",
      },
      EMI: {platform:"none" as const, reason:"data not available"},
      marketTrend: "stable" as const,
      recommendedAction: "monitor" as const,
      confidence: 50,
      insights: ["Limited data available for analysis"],
    };
  }

  private getFallbackPrediction(products: ProductDetails[]): PricePrediction {
    const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
    
    return {
      nextMonthRange: { min: Math.round(avgPrice * 0.8), max: Math.round(avgPrice * 1.2) },
      confidence: 40,
      factors: ['Limited historical data', 'Market volatility'],
      bestTimeToBuy: 'Monitor for better data'
    };
  }
}
