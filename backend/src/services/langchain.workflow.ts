import { StateGraph, START, END, CompiledStateGraph, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { 
  type PricePrediction, 
  type MarketAnalysis, 
  type Recommendation, 
  type ProductDetails,
  ProductIntelligenceService 
} from './ProductIntelligence.service.js';
import { User } from '../models/User.js';

export const WorkflowStateAnnotation = Annotation.Root({
  query: Annotation<string | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
  userId: Annotation<string | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
  searchResults: Annotation<ProductDetails[] | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
  marketAnalysis: Annotation<MarketAnalysis | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
  pricePrediction: Annotation<PricePrediction | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
  recommendations: Annotation<Recommendation[] | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[]) => {
      if (Array.isArray(right)) return left.concat(right);
      return left.concat([right]);
    },
  }),
  error: Annotation<string | null>({
    default: () => null,
    value: (_left, right) => right,
  }),
});

export type WorkflowState = typeof WorkflowStateAnnotation.State;


export interface WorkflowResult extends Omit<WorkflowState, "messages"> {
  messages: string[];
}

export class PriceIntelligenceWorkflow {
  private productService = new ProductIntelligenceService();
  private workflow: CompiledStateGraph<WorkflowState, Partial<WorkflowState>>;

  constructor() {
    this.workflow = this.initializeWorkflow();
  }

  private initializeWorkflow() {
    const graph = new StateGraph(WorkflowStateAnnotation);

    graph.addNode("checkUserLimits", this.checkUserLimitsNode.bind(this));
    graph.addNode("searchProducts", this.searchProductsNode.bind(this));
    graph.addNode("analyzeMarket", this.analyzeMarketNode.bind(this));
    graph.addNode("predictTrends", this.predictTrendsNode.bind(this));
    graph.addNode("generateRecommendations", this.generateRecommendationsNode.bind(this));

  
    graph.addEdge(START, "checkUserLimits" as any);
    graph.addEdge("checkUserLimits" as any, "searchProducts" as any);
    graph.addEdge("searchProducts" as any, "analyzeMarket" as any);
    graph.addEdge("analyzeMarket" as any, "predictTrends" as any);
    graph.addEdge("predictTrends" as any, "generateRecommendations" as any);
    graph.addEdge("generateRecommendations" as any, END);

    
      return graph.compile();
  }

  async executeWorkflow(query: string, userId: string): Promise<WorkflowResult> {
    const initial: WorkflowState = {
      query,
      userId,
      searchResults: [],
      marketAnalysis: null,
      pricePrediction: null,
      recommendations: null,
      messages: [new HumanMessage(`Search for: ${query}`)],
      error: null
    };

    try {
      const result = await this.workflow.invoke(initial) as WorkflowResult;
      return {
        ...result,
        messages: (result.messages as BaseMessage[]).map(m => m.content as string),
      }
    } catch (err) {
      throw new Error(`Workflow failed: ${err}`);
    }
  }

  private async checkUserLimitsNode(state: WorkflowState) {
    const user = await User.findById(state.userId);
    if (!user) throw new Error("User not found");

    const now = new Date();
    if (user.searchLimitResetsAt && now > user.searchLimitResetsAt) {
      user.searchCount = 0;
      user.searchLimitResetsAt = new Date(now.setDate(now.getDate() + 7));
      await user.save();
    }

    if (user.searchCount && user.searchCount >= 100) {
      throw new Error("Weekly search limit exceeded.");
    }

    state.messages.push(new AIMessage("User limits validated"));
    return state;
  }

  private async searchProductsNode(state: WorkflowState) {
    const products = await this.productService.searchProductsAcrossPlatforms(state.query!);
    if (!products.length) throw new Error("No products found");

    state.searchResults = products;
    state.messages.push(new AIMessage(`Found ${products.length} products`));
    return state;
  }

  private async analyzeMarketNode(state: WorkflowState) {
    state.marketAnalysis = await this.productService.analyzeMarket(state.searchResults);
    state.messages.push(new AIMessage(`Market analysis complete`));
    return state;
  }

  private async predictTrendsNode(state: WorkflowState) {
    state.pricePrediction = await this.productService.predictPriceTrends(state.searchResults);
    state.messages.push(new AIMessage("Price prediction complete"));
    return state;
  }

  private async generateRecommendationsNode(state: WorkflowState) {
    state.recommendations = [
      this.createRecommendation(state.marketAnalysis!, state.pricePrediction!, state.searchResults)
    ];
    state.messages.push(new AIMessage("Recommendation generated"));
    return state;
  }

  private createRecommendation(analysis: MarketAnalysis, prediction: PricePrediction, products: ProductDetails[]): Recommendation {
    const { bestDeal, averagePrice, marketTrend, confidence } = analysis;

    if (analysis.recommendedAction === "buy_now" && confidence > 70) {
      return {
        action: "buy_now",
        rationale: `Best deal at ₹${bestDeal.price} on ${bestDeal.platform}. High confidence decision.`,
        confidence,
        targetPrice: bestDeal.price,
        platform: bestDeal.platform,
      };
    }

    if (marketTrend === "falling" || prediction.confidence > 80) {
      return {
        action: "wait",
        rationale: `Prices expected to drop. Predicted range: ₹${prediction.nextMonthRange.min}-₹${prediction.nextMonthRange.max}. Best time: ${prediction.bestTimeToBuy}`,
        confidence: prediction.confidence,
        targetPrice: prediction.nextMonthRange.min,
        timeFrame: prediction.bestTimeToBuy
      };
    }

    return {
      action: "monitor",
      rationale: `Uncertain market. Avg price ₹${averagePrice}.`,
      confidence: 50,
      targetPrice: averagePrice,
    };
  }
}
