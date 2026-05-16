import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
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
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  } finally {
    client.release();
  }
}

export default pool;
