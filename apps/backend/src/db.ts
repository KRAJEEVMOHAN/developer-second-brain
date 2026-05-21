import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5433, // Changed to 5433 due to port conflict on 5432
  user: 'postgres',
  password: 'secret',
  database: 'postgres', // Using default database
});

export async function initDb() {
  const client = await pool.connect();
  try {
    // Enable vector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
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
        repo_id VARCHAR(50) REFERENCES repositories(id),
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        embedding vector(1536)
      );
    `);
    
    // Create symbols table
    await client.query(`
      CREATE TABLE IF NOT EXISTS symbols (
        id SERIAL PRIMARY KEY,
        repo_id VARCHAR(50) REFERENCES repositories(id),
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
        repo_id VARCHAR(50) REFERENCES repositories(id),
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
        embedding vector(1536),
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
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  } finally {
    client.release();
  }
}

export default pool;
