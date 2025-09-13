import { GoogleGenAI } from '@google/genai';

export const GEMINI_CONFIG = {
  apiKey: process.env.GEMINI_API_KEY!,
  model: "gemini-2.5-flash-lite",
  
  tools: [
    {
      googleSearch: {}
    }
  ],
  
  defaultConfig: {
    thinkingConfig: {
      thinkingBudget: 0, 
    },
  },

  requestsPerMinute: 60,
  requestsPerDay: 1000,
  
  maxRetries: 3,
  retryDelay: 1000, 
};

export const validateGeminiConfig = (): boolean => {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is required');
    return false;
  }
  
  if (process.env.GEMINI_API_KEY.length < 20) {
    console.error('GEMINI_API_KEY appears to be invalid');
    return false;
  }
  
  return true;
};

export const initializeGeminiAI = (): GoogleGenAI => {
  if (!validateGeminiConfig()) {
    throw new Error('Invalid Gemini configuration');
  }
  
  return new GoogleGenAI({
    apiKey: GEMINI_CONFIG.apiKey,
  });
};

export const getConfiguredAI = () => {
  const ai = initializeGeminiAI();
  
  const config = {
    ...GEMINI_CONFIG.defaultConfig,
    tools: GEMINI_CONFIG.tools,
  };
  
  return { ai, config, model: GEMINI_CONFIG.model };
};


export const makeStreamingRequest = async (
  ai: GoogleGenAI,
  model: string,
  config: any,
  contents: any[],
  maxRetries: number = GEMINI_CONFIG.maxRetries
): Promise<string> => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });
      
      let fullText = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullText += chunk.text;
        }
      }
      
      return fullText;
    } catch (error) {
      lastError = error;
      console.warn(`Gemini streaming request attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        const delay = GEMINI_CONFIG.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Gemini streaming request failed after ${maxRetries} attempts: ${lastError}`);
};
class RateLimiter {
  private requests: number = 0;
  private dailyRequests: number = 0;
  private lastReset: Date = new Date();
  private dailyReset: Date = new Date();

  canMakeRequest(): boolean {
    const now = new Date();
    
    if (now.getTime() - this.lastReset.getTime() >= 60000) {
      this.requests = 0;
      this.lastReset = now;
    }
    
    if (now.getDate() !== this.dailyReset.getDate()) {
      this.dailyRequests = 0;
      this.dailyReset = now;
    }
    
    return this.requests < GEMINI_CONFIG.requestsPerMinute && 
           this.dailyRequests < GEMINI_CONFIG.requestsPerDay;
  }
  
  recordRequest(): void {
    this.requests++;
    this.dailyRequests++;
  }
  
  getRemainingRequests(): { perMinute: number; perDay: number } {
    return {
      perMinute: Math.max(0, GEMINI_CONFIG.requestsPerMinute - this.requests),
      perDay: Math.max(0, GEMINI_CONFIG.requestsPerDay - this.dailyRequests)
    };
  }
}

export const rateLimiter = new RateLimiter();