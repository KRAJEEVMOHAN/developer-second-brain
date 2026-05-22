import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export class EmbeddingService {
  private geminiModel: any = null;
  private openaiClient: OpenAI | null = null;
  private provider: 'gemini' | 'openai' | 'mock' = 'mock';

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      this.geminiModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      this.provider = 'gemini';
      console.log('EmbeddingService initialized with Google Gemini (text-embedding-004)');
    } else if (openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
      this.provider = 'openai';
      console.log('EmbeddingService initialized with OpenAI (text-embedding-3-small)');
    } else {
      this.provider = 'mock';
      console.warn('WARNING: No GEMINI_API_KEY or OPENAI_API_KEY detected. EmbeddingService will run in MOCK mode with simulated vectors.');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.provider === 'gemini') {
      try {
        const result = await this.geminiModel.embedContent(text);
        if (result.embedding && result.embedding.values) {
          return result.embedding.values;
        }
        throw new Error('Invalid response structure from Gemini Embedding API');
      } catch (err: any) {
        console.error('Gemini embedding generation failed:', err.message || err);
        throw err;
      }
    } else if (this.provider === 'openai') {
      try {
        const response = await this.openaiClient!.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });
        if (response.data && response.data[0] && response.data[0].embedding) {
          return response.data[0].embedding;
        }
        throw new Error('Invalid response structure from OpenAI Embedding API');
      } catch (err: any) {
        console.error('OpenAI embedding generation failed:', err.message || err);
        throw err;
      }
    } else {
      // Fallback/mock mode: 1536 dimension (matching default PG setup)
      const dimension = 1536;
      const vector: number[] = [];
      const seed = text.length;
      for (let i = 0; i < dimension; i++) {
        vector.push(Math.sin(seed + i));
      }
      return vector;
    }
  }
}
