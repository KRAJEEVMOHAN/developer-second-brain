import express, { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import pool, { initDb } from './db';
import { ParserService } from './services/parserService';
import { ChunkingService } from './services/chunkingService';
import { EmbeddingService } from './services/embeddingService';
import { StructureService } from './services/structureService';
import { GitService } from './services/gitService';
import { GraphService } from './services/graphService';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let geminiClient: any = null;
let openaiClient: OpenAI | null = null;
let llmProvider: 'gemini' | 'openai' | 'mock' = 'mock';

const geminiKey = process.env.GEMINI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (geminiKey) {
  geminiClient = new GoogleGenerativeAI(geminiKey);
  llmProvider = 'gemini';
  console.log('LLM Chat initialized with Google Gemini (gemini-1.5-flash)');
} else if (openaiKey) {
  openaiClient = new OpenAI({ apiKey: openaiKey });
  llmProvider = 'openai';
  console.log('LLM Chat initialized with OpenAI (gpt-4o)');
} else {
  console.warn('WARNING: No GEMINI_API_KEY or OPENAI_API_KEY detected. LLM Chat will run in MOCK mode.');
}

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
const graphService = new GraphService();

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

// Get Circular Dependencies in Repository
app.get('/api/v1/repositories/:id/circular-dependencies', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const cycles = await graphService.findCircularDependencies(id);
    res.json(cycles);
  } catch (err) {
    console.error('Failed to fetch circular dependencies:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch circular dependencies' }
    });
  }
});

// Suggest Refactoring for a Circular Dependency Cycle
app.post('/api/v1/repositories/:id/circular-dependencies/refactor', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { path: cyclePath } = req.body;

  if (!cyclePath || !Array.isArray(cyclePath) || cyclePath.length === 0) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Cycle path array is required' }
    });
  }

  try {
    const reposDir = path.resolve(__dirname, '../repos');
    const repoPath = path.resolve(reposDir, id);

    const contents: Array<{ filePath: string; content: string }> = [];
    for (const filePath of cyclePath) {
      const fullPath = path.resolve(repoPath, filePath);
      if (!fullPath.startsWith(repoPath)) {
        continue; // security boundary check
      }
      if (fs.existsSync(fullPath)) {
        // Read file contents, capping at 500 lines for prompt safety
        const fileLines = fs.readFileSync(fullPath, 'utf-8').split('\n');
        const cappedContent = fileLines.slice(0, 500).join('\n');
        contents.push({ filePath, content: cappedContent });
      }
    }

    if (contents.length === 0) {
      return res.status(404).json({
        error: { code: 'RESOURCE_NOT_FOUND', message: 'No valid files from the cycle path were found' }
      });
    }

    const systemPrompt = `You are Antigravity, a senior software architect and AI coding assistant.
You are helping the user resolve a circular dependency loop in their codebase.
Analyze the provided files that form a cycle, explain why the cycle occurs, and propose a concrete step-by-step refactoring solution (e.g. extracting a shared interface, introducing an event-driven model, or merging components).
Provide code snippets showing the original code and the recommended changes.
Format your response in Markdown.`;

    const userMessage = `The following files form a circular dependency cycle:
${cyclePath.join(' -> ')}

Here is the content of the files in the cycle (each file is capped at the first 500 lines):

${contents.map(c => `File: ${c.filePath}\n\`\`\`\n${c.content}\n\`\`\``).join('\n\n')}

Please suggest a refactoring solution to break this cycle.`;

    let suggestion = '';
    if (llmProvider === 'gemini') {
      try {
        const model = geminiClient.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt
        });
        const chatResult = await model.generateContent(userMessage);
        suggestion = chatResult.response.text();
      } catch (err: any) {
        console.error('Failed to generate response from Gemini:', err);
        throw err;
      }
    } else if (llmProvider === 'openai') {
      try {
        const response = await openaiClient!.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        });
        suggestion = response.choices[0]?.message?.content || '';
      } catch (err: any) {
        console.error('Failed to generate response from OpenAI:', err);
        throw err;
      }
    } else {
      suggestion = `### Refactoring Analysis for Cycle: ${cyclePath.map(p => p.split(/[\\\/]/).pop()).join(' → ')}

#### Why the Cycle Occurs
The circular relationship happens because:
1. **${cyclePath[0].split(/[\\\/]/).pop()}** imports symbols from **${cyclePath[1]?.split(/[\\\/]/).pop()}** (creating a tight coupling).
2. **${cyclePath[1]?.split(/[\\\/]/).pop()}** references components back in **${cyclePath[0].split(/[\\\/]/).pop()}**.

#### Recommended Solution
We can break this cycle by extracting shared types, interfaces, or functions into a new, dedicated utility or interface file.

##### Step 1: Extract Shared Interfaces
Create a new file \`sharedTypes.ts\`:
\`\`\`typescript
export interface ISharedInterface {
  // Move shared interface definitions here to break the circular dependency
}
\`\`\`

##### Step 2: Refactor Imports
Update both files to import from the new \`sharedTypes.ts\` instead of importing from each other directly:
\`\`\`diff
- import { Something } from './${cyclePath[1]?.split(/[\\\/]/).pop()?.replace(/\.[jt]sx?$/, '')}';
+ import { ISharedInterface } from './sharedTypes';
\`\`\`

By decoupling these modules, they now form a Directed Acyclic Graph (DAG) instead of a cycle.`;
    }

    res.json({ suggestion });
  } catch (err) {
    console.error('Failed to generate refactoring suggestion:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to generate refactoring suggestion' }
    });
  }
});

// Get Dead Code & Unused Symbols
app.get('/api/v1/repositories/:id/dead-code', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // 1. Fetch all JS/TS files in the repository
    const filesResult = await pool.query(
      `SELECT DISTINCT file_path 
       FROM chunks 
       WHERE repo_id = $1 
         AND (file_path LIKE '%.ts' OR file_path LIKE '%.tsx' OR file_path LIKE '%.js' OR file_path LIKE '%.jsx')`,
      [id]
    );

    // 2. Fetch all files that are targets of relationships (i.e. used/imported)
    const referencedFilesResult = await pool.query(
      `SELECT DISTINCT target_file 
       FROM relationships 
       WHERE repo_id = $1`,
      [id]
    );

    const referencedFiles = new Set(referencedFilesResult.rows.map(r => r.target_file));

    // Helper to check if a file path is a typical entry point
    const isEntryPoint = (filePath: string) => {
      const filename = path.basename(filePath);
      return /^(index|main|app)\.[jt]sx?$/i.test(filename);
    };

    // Filter unused files: not referenced, and not entry points
    const unusedFiles = filesResult.rows
      .map(r => r.file_path)
      .filter(filePath => !referencedFiles.has(filePath) && !isEntryPoint(filePath));

    // 3. Fetch all unused symbols: defined in symbols but not referenced in relationships
    const unusedSymbolsResult = await pool.query(
      `SELECT s.name, s.file_path as "filePath", s.kind 
       FROM symbols s
       WHERE s.repo_id = $1
         AND NOT EXISTS (
           SELECT 1 
           FROM relationships r 
           WHERE r.repo_id = $1 
             AND r.symbol_name = s.name 
             AND r.target_file = s.file_path
         )`,
      [id]
    );

    // Filter out symbols defined in entry point files
    const unusedSymbols = unusedSymbolsResult.rows.filter(
      sym => !isEntryPoint(sym.filePath)
    );

    res.json({
      unusedFiles,
      unusedSymbols
    });
  } catch (err) {
    console.error('Failed to analyze dead code:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to analyze dead code' }
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

// Semantic Search
app.get('/api/v1/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const repoId = req.query.repo_id as string;
  const limit = parseInt(req.query.limit as string || '5', 10);

  if (!query || !repoId) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Query (q) and repo_id are required' }
    });
  }

  try {
    const embedding = await embeddingService.generateEmbedding(query);
    const vectorStr = `[${embedding.join(',')}]`;
    const result = await pool.query(
      `SELECT file_path, content, start_line, end_line, 
              (embedding <=> $2) as distance 
       FROM chunks 
       WHERE repo_id = $1 
       ORDER BY distance ASC 
       LIMIT $3`,
      [repoId, vectorStr, limit]
    );

    const searchResults = result.rows.map(row => ({
      content: row.content,
      file: row.file_path,
      start_line: row.start_line,
      end_line: row.end_line,
      score: 1 - row.distance // Cosine similarity
    }));

    res.json(searchResults);
  } catch (err) {
    console.error('Failed to perform semantic search:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to perform semantic search' }
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

    // Assemble RAG context for prompt
    let contextStr = '';
    
    // Add memory context
    if (memoriesResult.rows.length > 0) {
      contextStr += '### TEAM MEMORIES / TECHNICAL DECISIONS:\n';
      memoriesResult.rows.forEach(mem => {
        contextStr += `--- START TEAM MEMORY ---\n`;
        contextStr += `Source: [Memory: ${mem.type.toUpperCase()}: ${mem.title}]\n`;
        contextStr += `Content: ${mem.content}\n`;
        contextStr += `--- END TEAM MEMORY ---\n\n`;
      });
    }

    // Add code chunk context
    if (result.rows.length > 0) {
      contextStr += '### RELEVANT CODE SNIPPETS:\n';
      result.rows.forEach(chunk => {
        contextStr += `--- START CODE CHUNK ---\n`;
        contextStr += `Source: [File: ${chunk.file_path}:${chunk.start_line}-${chunk.end_line}]\n`;
        contextStr += `Content:\n${chunk.content}\n`;
        contextStr += `--- END CODE CHUNK ---\n\n`;
      });
    }

    const systemPrompt = `You are an expert software engineering assistant. Your task is to answer the user's question about the repository using the provided relevant code snippets and team memories context.

Rules:
1. Provide a direct, technically accurate, and concise answer.
2. Rely ONLY on the provided context. If the context does not contain enough information to answer, state that clearly. Do not assume or invent information.
3. You MUST cite your sources in-text. Use the EXACT source format tags from the context header, such as "[File: <path>:<start>-<end>]" or "[Memory: <TYPE>: <title>]". E.g., "...as shown in the auth check function [File: src/auth.ts:10-25]..." or "...due to the transition to PostgreSQL [Memory: MIGRATION: Migration to Postgres]..."
4. Keep citations exactly as formatted in the context headers. Do not modify paths or titles.`;

    const userMessage = `Context:\n${contextStr}\nQuestion: ${message}`;

    let replyText = '';
    if (llmProvider === 'gemini') {
      try {
        const model = geminiClient.getGenerativeModel({ 
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt
        });
        const chatResult = await model.generateContent(userMessage);
        replyText = chatResult.response.text();
      } catch (err: any) {
        console.error('Failed to generate response from Gemini:', err);
        throw err;
      }
    } else if (llmProvider === 'openai') {
      try {
        const response = await openaiClient!.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        });
        replyText = response.choices[0]?.message?.content || '';
      } catch (err: any) {
        console.error('Failed to generate response from OpenAI:', err);
        throw err;
      }
    } else {
      replyText = `[MOCK MODE] You asked: "${message}". \n\nBased on your codebase context, it looks like this is where repository code and decisions are handled.\n\nRefer to [File: ${result.rows[0]?.file_path || 'src/index.ts'}:1-10] and [Memory: DECISION: Mock Decision] for details.`;
    }

    // Parse citations from LLM response text using regexes
    const fileRegex = /\[File:\s*([^:]+):(\d+)-(\d+)\]/g;
    const memoryRegex = /\[Memory:\s*([^:]+):\s*([^\]]+)\]/g;
    
    const citationMap = new Map<string, any>();
    
    let match;
    // Extract file citations
    while ((match = fileRegex.exec(replyText)) !== null) {
      const filePath = match[1];
      const startLine = match[2];
      const endLine = match[3];
      const key = `file:${filePath}:${startLine}-${endLine}`;
      
      const origSnippet = result.rows.find(row => 
        row.file_path === filePath && 
        String(row.start_line) === startLine && 
        String(row.end_line) === endLine
      );
      
      citationMap.set(key, {
        file: filePath,
        lines: `${startLine}-${endLine}`,
        content: origSnippet ? origSnippet.content : 'Source code snippet.'
      });
    }

    // Extract memory citations
    while ((match = memoryRegex.exec(replyText)) !== null) {
      const memType = match[1];
      const memTitle = match[2].trim();
      const key = `memory:${memType}:${memTitle}`;

      const origMemory = memoriesResult.rows.find(row => 
        row.type.toLowerCase() === memType.toLowerCase() && 
        row.title.trim().toLowerCase() === memTitle.toLowerCase()
      );

      citationMap.set(key, {
        file: `[Memory] ${memType.toUpperCase()}: ${memTitle}`,
        lines: '1-1',
        content: origMemory ? origMemory.content : 'Archived team memory.'
      });
    }

    let citations = Array.from(citationMap.values());

    // Fallback: if no citations are found, output default ones to keep context visual panel populated
    if (citations.length === 0) {
      citations = [...symbolCitations, ...memoryCitations, ...vectorCitations].slice(0, 5);
    }

    const conversation_id = Math.random().toString(36).substr(2, 9);
    
    res.json({
      response: replyText,
      conversation_id,
      citations: citations
    });
  } catch (err) {
    console.error('Failed to search chunks or generate response:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to answer repository chat' }
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
