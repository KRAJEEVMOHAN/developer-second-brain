import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || 'postgres',
});

// Determine active provider and vector dimension
const useGemini = !!process.env.GEMINI_API_KEY;
const vectorDimension = useGemini ? 768 : 1536;

async function getExistingVectorDimension(client: any, tableName: string): Promise<number | null> {
  try {
    const tableExistsResult = await client.query(
      "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = $1);",
      [tableName]
    );
    if (!tableExistsResult.rows[0].exists) {
      return null;
    }

    const result = await client.query(`
      SELECT format_type(atttypid, atttypmod) AS type 
      FROM pg_attribute 
      WHERE attrelid = $1::regclass AND attname = 'embedding';
    `, [tableName]);

    if (result.rows.length > 0) {
      const typeStr = result.rows[0].type;
      const match = typeStr.match(/vector\((\d+)\)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  } catch (err) {
    console.error(`Failed to get vector dimension for table ${tableName}:`, err);
  }
  return null;
}

export async function initDb() {
  const client = await pool.connect();
  try {
    // Enable vector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    // Dynamic schema migration checks
    const currentChunksDim = await getExistingVectorDimension(client, 'chunks');
    const currentMemoriesDim = await getExistingVectorDimension(client, 'team_memories');

    if (
      (currentChunksDim !== null && currentChunksDim !== vectorDimension) ||
      (currentMemoriesDim !== null && currentMemoriesDim !== vectorDimension)
    ) {
      console.log(`Vector dimension mismatch detected (database chunks=${currentChunksDim}, memories=${currentMemoriesDim}; requested=${vectorDimension}). Migrating database...`);
      await client.query('DROP TABLE IF EXISTS chunks;');
      await client.query('DROP TABLE IF EXISTS team_memories;');
      console.log('Old tables dropped successfully.');
    }
    
    // Create repositories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repositories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create chunks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id SERIAL PRIMARY KEY,
        repo_id VARCHAR(50) REFERENCES repositories(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        embedding vector(${vectorDimension})
      );
    `);
    
    // Create symbols table
    await client.query(`
      CREATE TABLE IF NOT EXISTS symbols (
        id SERIAL PRIMARY KEY,
        repo_id VARCHAR(50) REFERENCES repositories(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        kind VARCHAR(50) NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        length INTEGER NOT NULL DEFAULT 0,
        parameter_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create relationships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS relationships (
        id SERIAL PRIMARY KEY,
        repo_id VARCHAR(50) REFERENCES repositories(id) ON DELETE CASCADE,
        source_file TEXT NOT NULL,
        target_file TEXT NOT NULL,
        symbol_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create team_memories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_memories (
        id SERIAL PRIMARY KEY,
        repo_id VARCHAR(50) REFERENCES repositories(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        embedding vector(${vectorDimension}),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Migration: Add new columns to symbols table if they don't exist
    await client.query(`
      ALTER TABLE symbols ADD COLUMN IF NOT EXISTS length INTEGER NOT NULL DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE symbols ADD COLUMN IF NOT EXISTS parameter_count INTEGER
    `);
    
    console.log(`Database initialized successfully (using vector dimension = ${vectorDimension})`);
  } catch (err) {
    console.error('Failed to initialize database:', err);
  } finally {
    client.release();
  }
}

export default pool;
