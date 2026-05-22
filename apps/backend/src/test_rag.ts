import { initDb } from './db';
import { EmbeddingService } from './services/embeddingService';

async function runTest() {
  console.log('--- STARTING DIAGNOSTIC TEST ---');
  
  // 1. Check active environment variables
  console.log('Env variables read check:');
  console.log('GEMINI_API_KEY set:', !!process.env.GEMINI_API_KEY);
  console.log('OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY);
  
  // 2. Initialize database
  console.log('\nInitializing database...');
  try {
    await initDb();
    console.log('Database initialization check completed.');
  } catch (err) {
    console.error('Database initialization check failed:', err);
  }

  // 3. Initialize EmbeddingService
  console.log('\nInitializing EmbeddingService...');
  try {
    const embeddingService = new EmbeddingService();
    console.log('EmbeddingService instance created.');

    console.log('\nTesting embedding generation...');
    const text = 'How to connect to PostgreSQL database?';
    const embedding = await embeddingService.generateEmbedding(text);
    console.log('Embedding generated successfully.');
    console.log('Embedding vector dimension size:', embedding.length);
    console.log('Preview of vector (first 5 elements):', embedding.slice(0, 5));
  } catch (err) {
    console.error('Embedding test failed:', err);
  }
  
  console.log('\n--- DIAGNOSTIC TEST COMPLETED ---');
  process.exit(0);
}

runTest();
