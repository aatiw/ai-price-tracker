import { StateGraph, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ProductIntelligenceService } from './ProductIntelligence.service.js';
import { User } from '../models/User.js';

interface WorkflowState {
  query: string;
  userId: string;
  searchResults: any[];
  marketAnalysis: any;
  pricePredicition: any;
  recommendations: any;
  messages: BaseMessage[];
  scrapedData: Map<string, any>;
  error?: string;
}

interface WorkflowResult {
  scrapedData: Map<string, any>;
  marketAnalysis: any;
  recommendations: any;
  pricePredicition: any;
  searchResults: any[];
}

export class PriceIntelligenceWorkflow {
  private productService: ProductIntelligenceService;
  private workflow: any;

  constructor() {
    this.productService = new ProductIntelligenceService();
    this.initializeWorkflow();
  }

  private initializeWorkflow() {
    const workflow = new StateGraph<WorkflowState>({
      channels: {
        query: { value: null },
        userId: { value: null },
        searchResults: { value: [] },
        marketAnalysis: { value: null },
        pricePredicition: { value: null },
        recommendations: { value: null },
        messages: { value: [] },
        scrapedData: { value: new Map() },
        error: { value: null }
      }
    });

    // Define nodes (workflow steps)
    workflow.addNode('searchProducts', this.searchProductsNode.bind(this));
    workflow.addNode('analyzeMarket', this.analyzeMarketNode.bind(this));
    workflow.addNode('predictTrends', this.predictTrendsNode.bind(this));
    workflow.addNode('generateRecommendations', this.generateRecommendationsNode.bind(this));
    workflow.addNode('checkUserLimits', this.checkUserLimitsNode.bind(this));

    // Define edges (workflow flow)
    workflow.addEdge('checkUserLimits', 'searchProducts');
    workflow.addEdge('searchProducts', 'analyzeMarket');
    workflow.addEdge('analyzeMarket', 'predictTrends');
    workflow.addEdge('predictTrends', 'generateRecommendations');
    workflow.addEdge('generateRecommendations', END);

    // Set entry point
    workflow.setEntryPoint('checkUserLimits');

    this.workflow = workflow.compile();
  }

  async executeWorkflow(query: string, userId: string): Promise<WorkflowResult> {
    const initialState: WorkflowState = {
      query,
      userId,
      searchResults: [],
      marketAnalysis: null,
      pricePredicition: null,
      recommendations: null,
      messages: [new HumanMessage(`Search for: ${query}`)],
      scrapedData: new Map()
    };

    try {
      const result = await this.workflow.invoke(initialState);
      
      return {
        scrapedData: result.scrapedData,
        marketAnalysis: result.marketAnalysis,
        recommendations: result.recommendations,
        pricePredicition: result.pricePredicition,
        searchResults: result.searchResults
      };
    } catch (error) {
      console.error('Workflow execution failed:', error);
      throw new Error(`Price intelligence workflow failed: ${error}`);
    }
  }

  private async checkUserLimitsNode(state: WorkflowState): Promise<WorkflowState> {
    try {
      const user = await User.findById(state.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check search limits (assuming you have these fields in User model)
      const now = new Date();
      if (user.searchLimitResetsAt && now > user.searchLimitResetsAt) {
        // Reset weekly limit
        user.searchCount = 0;
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        user.searchLimitResetsAt = nextWeek;
        await user.save();
      }

      // Check if user has exceeded limits (e.g., 100 searches per week)
      if (user.searchCount && user.searchCount >= 100) {
        throw new Error('Search limit exceeded. Please wait for weekly reset.');
      }

      state.messages.push(new AIMessage('User limits checked successfully'));
      return state;
    } catch (error) {
      state.error = `Limit check failed: ${error}`;
      throw error;
    }
  }

  private async searchProductsNode(state: WorkflowState): Promise<WorkflowState> {
    try {
      console.log(`🔍 Searching for products: ${state.query}`);
      
      const products = await this.productService.searchProductsAcrossPlatforms(state.query);
      
      if (products.length === 0) {
        throw new Error('No products found for the given query');
      }

      // Convert products to Map format for backward compatibility
      const scrapedData = new Map();
      products.forEach(product => {
        scrapedData.set(product.platform, {
          url: product.url,
          price: product.price,
          availability: product.availability,
          seller: product.seller,
          rating: product.rating,
          reviews: product.reviews,
          delivery: product.delivery,
          title: product.title,
          brand: product.brand,
          category: product.category,
          originalPrice: product.originalPrice,
          discount: product.discount
        });
      });

      state.searchResults = products;
      state.scrapedData = scrapedData;
      state.messages.push(new AIMessage(`Found ${products.length} products across platforms`));
      
      console.log(`✅ Found ${products.length} products`);
      return state;
    } catch (error) {
      console.error('Search failed:', error);
      state.error = `Search failed: ${error}`;
      throw error;
    }
  }

  private async analyzeMarketNode(state: WorkflowState): Promise<WorkflowState> {
    try {
      console.log('📊 Analyzing market data...');
      
      const marketAnalysis = await this.productService.analyzeMarket(state.searchResults);
      
      state.marketAnalysis = marketAnalysis;
      state.messages.push(new AIMessage(`Market analysis completed. Best deal: ₹${marketAnalysis.bestDeal.price} on ${marketAnalysis.bestDeal.platform}`));
      
      console.log('✅ Market analysis completed');
      return state;
    } catch (error) {
      console.error('Market analysis failed:', error);
      state.error = `Market analysis failed: ${error}`;
      throw error;
    }
  }

  private async predictTrendsNode(state: WorkflowState): Promise<WorkflowState> {
    try {
      console.log('🔮 Predicting price trends...');
      
      const prediction = await this.productService.predictPriceTrends(state.searchResults);
      
      state.pricePredicition = prediction;
      state.messages.push(new AIMessage(`Price prediction completed. Confidence: ${prediction.confidence}%`));
      
      console.log('✅ Price prediction completed');
      return state;
    } catch (error) {
      console.error('Price prediction failed:', error);
      state.error = `Price prediction failed: ${error}`;
      throw error;
    }
  }

  private async generateRecommendationsNode(state: WorkflowState): Promise<WorkflowState> {
    try {
      console.log('💡 Generating recommendations...');
      
      const recommendations = this.createIntelligentRecommendations(
        state.marketAnalysis,
        state.pricePredicition,
        state.searchResults
      );
      
      state.recommendations = recommendations;
      state.messages.push(new AIMessage(`Recommendations generated: ${recommendations.primaryAction}`));
      
      console.log('✅ Recommendations generated');
      return state;
    } catch (error) {
      console.error('Recommendation generation failed:', error);
      state.error = `Recommendation generation failed: ${error}`;
      throw error;
    }
  }

  private createIntelligentRecommendations(marketAnalysis: any, prediction: any, products: any[]) {
    const avgPrice = marketAnalysis.averagePrice;
    const bestDeal = marketAnalysis.bestDeal;
    const trend = marketAnalysis.marketTrend;
    
    let primaryAction: string;
    let reasoning: string[];
    let urgency: 'low' | 'medium' | 'high';
    let alternativeActions: string[];

    // Intelligent decision logic
    if (marketAnalysis.recommendedAction === 'buy_now' && marketAnalysis.confidence > 70) {
      primaryAction = `Buy now from ${bestDeal.platform} at ₹${bestDeal.price}`;
      urgency = 'high';
      reasoning = [
        `Best deal available with ${marketAnalysis.confidence}% confidence`,
        bestDeal.reason,
        `Market trend is ${trend}`
      ];
      alternativeActions = [
        'Set price alert for better deals',
        'Compare with offline stores'
      ];
    } else if (trend === 'falling' || prediction.confidence > 80) {
      primaryAction = 'Wait for better prices';
      urgency = 'low';
      reasoning = [
        `Prices expected to drop (${trend} trend)`,
        `${prediction.bestTimeToBuy}`,
        `Predicted range: ₹${prediction.nextWeekRange.min}-₹${prediction.nextWeekRange.max}`
      ];
      alternativeActions = [
        'Set price alerts',
        'Monitor for 1 week',
        `Current best option: ${bestDeal.platform} at ₹${bestDeal.price}`
      ];
    } else {
      primaryAction = 'Monitor prices closely';
      urgency = 'medium';
      reasoning = [
        'Market conditions are uncertain',
        `Average price: ₹${avgPrice}`,
        'Consider your urgency to purchase'
      ];
      alternativeActions = [
        `Buy from ${bestDeal.platform} if urgent`,
        'Wait 3-5 days for more data',
        'Set multiple price alerts'
      ];
    }

    return {
      primaryAction,
      reasoning,
      urgency,
      alternativeActions,
      bestDeal: {
        platform: bestDeal.platform,
        price: bestDeal.price,
        savings: avgPrice - bestDeal.price,
        reason: bestDeal.reason
      },
      priceInsights: {
        currentRange: `₹${marketAnalysis.priceRange.min} - ₹${marketAnalysis.priceRange.max}`,
        predictedNextWeek: `₹${prediction.nextWeekRange.min} - ₹${prediction.nextWeekRange.max}`,
        trend: trend,
        confidence: Math.min(marketAnalysis.confidence, prediction.confidence)
      }
    };
  }

  // Additional workflow for product tracking
  async executeTrackingWorkflow(urls: string[], userId: string): Promise<any> {
    const results = new Map();
    
    for (const url of urls) {
      try {
        const product = await this.productService.getProductByUrl(url);
        if (product) {
          results.set(product.platform, {
            url: product.url,
            price: product.price,
            availability: product.availability,
            seller: product.seller,
            rating: product.rating,
            reviews: product.reviews,
            title: product.title,
            brand: product.brand,
            category: product.category
          });
        }
      } catch (error) {
        console.error(`Failed to process ${url}:`, error);
      }
    }

    return results;
  }

  // Utility method for price alerts
  async checkPriceAlerts(productId: string, currentPrices: Map<string, number>): Promise<any> {
    // This would integrate with your alert system
    // Check if current prices trigger any user-set alerts
    return {
      alertsTriggered: [],
      priceChanges: []
    };
  }
}