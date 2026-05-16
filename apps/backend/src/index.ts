import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import pool, { initDb } from './db';
import { ParserService } from './services/parserService';
import { ChunkingService } from './services/chunkingService';
import { EmbeddingService } from './services/embeddingService';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory store for mock data
const mockRepos = [
  { id: '1', name: 'developer-second-brain', status: 'indexed', language: 'TypeScript' },
  { id: '2', name: 'backend-service', status: 'processing', language: 'Go' },
  { id: '3', name: 'legacy-app', status: 'failed', language: 'JavaScript' }
];

app.get('/', (req: Request, res: Response) => {
  res.send('AI Developer Second Brain API is running!');
});

// List Repositories
app.get('/api/v1/repositories', (req: Request, res: Response) => {
  res.json(mockRepos);
});

const parserService = new ParserService();
const chunkingService = new ChunkingService();
const embeddingService = new EmbeddingService();

// Import Repository
app.post('/api/v1/repositories', async (req: Request, res: Response) => {
  const { url, branch } = req.body;
  
  if (!url) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Git URL is required' }
    });
  }

  const name = url.split('/').pop()?.replace('.git', '') || 'new-repo';
  const id = Math.random().toString(36).substr(2, 9);
  
  try {
    // Insert into repositories table
    await pool.query(
      'INSERT INTO repositories (id, name, url, status) VALUES ($1, $2, $3, $4)',
      [id, name, url, 'processing']
    );

    // Simulate background processing
    const repoPath = path.resolve(__dirname, '../../..'); // Root of workspace
    console.log(`Starting parse for ${name} at ${repoPath}`);
    
    parserService.parseRepository(repoPath)
      .then(async files => {
        console.log(`Parsed ${files.length} files for ${name}`);
        
        let totalChunks = 0;
        
        for (const file of files) {
          const chunks = chunkingService.chunkFile(file.file, file.content);
          totalChunks += chunks.length;
          
          for (const chunk of chunks) {
            const embedding = await embeddingService.generateEmbedding(chunk.content);
            
            // Format vector for pgvector (string representation of array)
            const vectorStr = `[${embedding.join(',')}]`;
            
            await pool.query(
              'INSERT INTO chunks (repo_id, file_path, content, start_line, end_line, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
              [id, chunk.file, chunk.content, chunk.startLine, chunk.endLine, vectorStr]
            );
          }
        }
        
        // Update repo status to indexed
        await pool.query(
          'UPDATE repositories SET status = $1 WHERE id = $2',
          ['indexed', id]
        );
        
        console.log(`Generated and saved ${totalChunks} chunks for ${name}`);
      })
      .catch(async err => {
        console.error(`Failed to parse repo ${name}:`, err);
        // Update repo status to failed
        await pool.query(
          'UPDATE repositories SET status = $1 WHERE id = $2',
          ['failed', id]
        );
      });
    
    res.status(202).json({
      id,
      status: 'pending',
      message: 'Repository import started'
    });
  } catch (err) {
    console.error('Failed to create repository record:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create repository record' }
    });
  }
});

// Get Repository Status
app.get('/api/v1/repositories/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const repo = mockRepos.find(r => r.id === id);
  
  if (!repo) {
    return res.status(404).json({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Repository not found' }
    });
  }
  
  res.json(repo);
});

// Repository Chat
app.post('/api/v1/chat', (req: Request, res: Response) => {
  const { message, repo_id } = req.body;
  
  if (!message || !repo_id) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Message and repo_id are required' }
    });
  }

  const conversation_id = Math.random().toString(36).substr(2, 9);
  
  res.json({
    response: `I received your message: "${message}". I am analyzing the repository ${repo_id}.`,
    conversation_id,
    citations: [
      { file: 'src/index.ts', lines: '1-10' }
    ]
  });
});

// Initialize Database
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to start server due to DB error:', err);
});
