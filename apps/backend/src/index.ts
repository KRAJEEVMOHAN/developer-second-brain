import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import pool, { initDb } from './db';
import { ParserService } from './services/parserService';
import { ChunkingService } from './services/chunkingService';
import { EmbeddingService } from './services/embeddingService';
import { StructureService } from './services/structureService';
import { GitService } from './services/gitService';

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
app.get('/api/v1/repositories', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM repositories ORDER BY created_at DESC');
    
    // Add a default language since the schema doesn't store it yet
    const repos = result.rows.map(row => ({
      ...row,
      language: 'TypeScript'
    }));
    
    res.json(repos);
  } catch (err) {
    console.error('Failed to fetch repositories:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch repositories' }
    });
  }
});

const parserService = new ParserService();
const chunkingService = new ChunkingService();
const embeddingService = new EmbeddingService();
const structureService = new StructureService();
const gitService = new GitService();

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
    console.log('Inserting repo:', { id, name, url });
    // Insert into repositories table
    await pool.query(
      'INSERT INTO repositories (id, name, url, status) VALUES ($1, $2, $3, $4)',
      [id, name.substring(0, 255), url.substring(0, 255), 'processing']
    );

    const repoPath = path.resolve(__dirname, '../repos', id);
    console.log(`Starting clone & parse for ${name} at ${repoPath}`);
    
    // Run cloning and then parsing in the background
    gitService.cloneRepository(url, repoPath, branch)
      .then(() => parserService.parseRepository(repoPath))
      .then(async files => {
        console.log(`Parsed ${files.length} files for ${name}`);
        
        let totalChunks = 0;
        
        for (const file of files) {
          let symbols: any[] = [];
          
          // Extract symbols for Architecture Intelligence (only for TS/JS files)
          const ext = path.extname(file.file);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            try {
              symbols = structureService.extractSymbols(file.file, file.content);
              if (symbols.length > 0) {
                console.log(`Found ${symbols.length} symbols in ${file.file}:`, symbols.map(s => `${s.kind} ${s.name}`));
                
                // Save symbols to database
                for (const symbol of symbols) {
                  await pool.query(
                    'INSERT INTO symbols (repo_id, file_path, name, kind, start_line, end_line, length, parameter_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [id, file.file, symbol.name, symbol.kind, symbol.startLine, symbol.endLine, symbol.length, symbol.parameterCount || null]
                  );
                }
              }
            } catch (err) {
              console.error(`Failed to extract symbols from ${file.file}:`, err);
            }
          }

          // Now chunk the file, passing the symbols!
          const chunks = chunkingService.chunkFile(file.file, file.content, symbols);
          totalChunks += chunks.length;
          
          for (const chunk of chunks) {
            try {
              const embedding = await embeddingService.generateEmbedding(chunk.content);
              
              // Format vector for pgvector (string representation of array)
              const vectorStr = `[${embedding.join(',')}]`;
              
              await pool.query(
                'INSERT INTO chunks (repo_id, file_path, content, start_line, end_line, embedding) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, chunk.file, chunk.content.replace(/\0/g, ''), chunk.startLine, chunk.endLine, vectorStr]
              );
            } catch (err) {
              console.error(`Failed to insert chunk for file ${chunk.file}:`, err);
              // Continue with next chunk
            }
          }
        }
        
        // Pass 2: Find relationships between files based on symbols
        console.log(`Starting relationship scan for ${files.length} files...`);
        
        // Fetch all symbols for this repo to have them in memory
        const symbolsResult = await pool.query(
          'SELECT name, file_path FROM symbols WHERE repo_id = $1',
          [id]
        );
        const allSymbols = symbolsResult.rows;
        
        if (allSymbols.length > 0) {
          let relCount = 0;
          for (const file of files) {
            const ext = path.extname(file.file);
            if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;
            
            for (const sym of allSymbols) {
              // Don't link a file to itself
              if (sym.file_path === file.file) continue;
              
              // Simple regex to find the symbol name as a word
              const regex = new RegExp(`\\b${sym.name}\\b`);
              if (regex.test(file.content)) {
                await pool.query(
                  'INSERT INTO relationships (repo_id, source_file, target_file, symbol_name) VALUES ($1, $2, $3, $4)',
                  [id, file.file, sym.file_path, sym.name]
                );
                relCount++;
              }
            }
          }
          console.log(`Relationship scan completed. Found ${relCount} relationships.`);
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
app.get('/api/v1/repositories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM repositories WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'Repository not found' }
      });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch repository:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch repository' }
    });
  }
});

// List Files in Repository
app.get('/api/v1/repositories/:id/files', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT DISTINCT file_path FROM chunks WHERE repo_id = $1 ORDER BY file_path',
      [id]
    );
    const files = result.rows.map(row => row.file_path);
    console.log(`Found ${files.length} files for repo ${id}:`, files);
    res.json(files);
  } catch (err) {
    console.error('Failed to fetch files:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch files' }
    });
  }
});

// List Symbols in Repository
app.get('/api/v1/repositories/:id/symbols', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT name, kind, file_path, start_line, length, parameter_count FROM symbols WHERE repo_id = $1 ORDER BY name',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch symbols:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch symbols' }
    });
  }
});

// List Relationships in Repository
app.get('/api/v1/repositories/:id/relationships', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT source_file, target_file, symbol_name FROM relationships WHERE repo_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch relationships:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch relationships' }
    });
  }
});

// List or Search Team Memories
app.get('/api/v1/repositories/:id/memories', async (req: Request, res: Response) => {
  const { id } = req.params;
  const query = req.query.q as string;

  try {
    if (query) {
      const embedding = await embeddingService.generateEmbedding(query);
      const vectorStr = `[${embedding.join(',')}]`;
      const result = await pool.query(
        `SELECT id, title, content, type, created_at,
                (embedding <=> $2) as distance
         FROM team_memories
         WHERE repo_id = $1
         ORDER BY distance ASC
         LIMIT 10`,
        [id, vectorStr]
      );
      res.json(result.rows);
    } else {
      const result = await pool.query(
        'SELECT id, title, content, type, created_at FROM team_memories WHERE repo_id = $1 ORDER BY created_at DESC',
        [id]
      );
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Failed to fetch memories:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch memories' }
    });
  }
});

// Create Team Memory
app.post('/api/v1/repositories/:id/memories', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, type } = req.body;

  if (!title || !content || !type) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Title, content, and type are required' }
    });
  }

  try {
    const textToEmbed = `${title} ${content}`;
    const embedding = await embeddingService.generateEmbedding(textToEmbed);
    const vectorStr = `[${embedding.join(',')}]`;

    const result = await pool.query(
      'INSERT INTO team_memories (repo_id, title, content, type, embedding) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, content, type, created_at',
      [id, title, content, type, vectorStr]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create memory:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create memory' }
    });
  }
});

// Delete Team Memory
app.delete('/api/v1/repositories/:id/memories/:memoryId', async (req: Request, res: Response) => {
  const { id, memoryId } = req.params;

  try {
    await pool.query(
      'DELETE FROM team_memories WHERE repo_id = $1 AND id = $2',
      [id, memoryId]
    );
    res.json({ message: 'Memory deleted successfully' });
  } catch (err) {
    console.error('Failed to delete memory:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete memory' }
    });
  }
});

// Get File Content
app.get('/api/v1/repositories/:id/file', async (req: Request, res: Response) => {
  const { id } = req.params;
  const filePath = req.query.path as string;
  
  if (!filePath) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'File path is required' }
    });
  }
  
  try {
    const reposDir = path.resolve(__dirname, '../repos');
    const repoPath = path.resolve(reposDir, id);
    const fullPath = path.resolve(repoPath, filePath);
    
    if (!fullPath.startsWith(repoPath)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'File not found' }
      });
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content });
  } catch (err) {
    console.error('Failed to read file:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to read file' }
    });
  }
});

// Repository Chat
app.post('/api/v1/chat', async (req: Request, res: Response) => {
  const { message, repo_id } = req.body;
  
  if (!message || !repo_id) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Message and repo_id are required' }
    });
  }

  try {
    // 1. Check if the message mentions any symbol name exactly
    // Split message into words and find matching symbols
    const words = message.split(/\W+/).filter((w: string) => w.length > 2);
    let symbolCitations: any[] = [];
    
    if (words.length > 0) {
      const symbolsResult = await pool.query(
        `SELECT name, kind, file_path, start_line, end_line 
         FROM symbols 
         WHERE repo_id = $1 AND name = ANY($2)
         LIMIT 3`,
        [repo_id, words]
      );
      
      if (symbolsResult.rows.length > 0) {
        console.log(`Found ${symbolsResult.rows.length} matching symbols for query.`);
        symbolCitations = symbolsResult.rows.map(row => ({
          file: row.file_path,
          lines: `${row.start_line}-${row.end_line}`,
          content: `[Symbol] ${row.kind} '${row.name}' is defined here.`
        }));
      }
    }

    // 2. Generate embedding for the question and do vector search
    const embedding = await embeddingService.generateEmbedding(message);
    const vectorStr = `[${embedding.join(',')}]`;

    // Search for similar memories using pgvector
    const memoriesResult = await pool.query(
      `SELECT title, content, type,
              (embedding <=> $2) as distance
       FROM team_memories
       WHERE repo_id = $1
       ORDER BY distance ASC
       LIMIT 3`,
      [repo_id, vectorStr]
    );

    const memoryCitations = memoriesResult.rows
      .filter(row => row.distance < 1.6) // Only include memories that are reasonably close
      .map(row => ({
        file: `[Memory] ${row.type.toUpperCase()}: ${row.title}`,
        lines: '1-1',
        content: row.content
      }));

    // Search for similar chunks using pgvector
    const result = await pool.query(
      `SELECT file_path, content, start_line, end_line, 
              (embedding <=> $2) as distance 
       FROM chunks 
       WHERE repo_id = $1 
       ORDER BY distance ASC 
       LIMIT 3`,
      [repo_id, vectorStr]
    );

    const vectorCitations = result.rows.map(row => ({
      file: row.file_path,
      lines: `${row.start_line}-${row.end_line}`,
      content: row.content
    }));

    // Combine citations: symbols, then memories, then code snippets
    const citations = [...symbolCitations, ...memoryCitations, ...vectorCitations].slice(0, 5);

    const conversation_id = Math.random().toString(36).substr(2, 9);
    
    res.json({
      response: `I found ${symbolCitations.length} matching symbols, ${memoryCitations.length} relevant memories, and ${result.rows.length} relevant snippets.`,
      conversation_id,
      citations: citations
    });
  } catch (err) {
    console.error('Failed to search chunks:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to search repository' }
    });
  }
});

// Initialize Database
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to start server due to DB error:', err);
});
