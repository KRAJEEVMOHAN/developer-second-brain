# Technical Design Document (TDD) --- AI Developer Second Brain

## 1. Introduction
This document provides the technical design details for the AI Developer Second Brain system. It covers service responsibilities, internal workflows, algorithms, and APIs.

## 2. Service Responsibilities

### 2.1 API Gateway
- **Auth:** Validates JWT tokens or API keys.
- **Routing:** Forwards requests to specific microservices (Search, Chat, Repo Management).
- **Rate Limiting:** Protects the system from abuse.

### 2.2 Parser Service
- **Cloning:** Clones Git repositories to a local temporary volume.
- **Parsing:** Uses `tree-sitter` with language-specific grammars to build Abstract Syntax Trees (AST).
- **Extraction:** Extracts functions, classes, methods, and imports.

### 2.3 Chunking Service
- **Logic:** Receives extracted code blocks and breaks them into chunks optimized for embeddings.
- **Context Preservation:** Ensures chunks contain complete functions or logical blocks when possible.
- **Metadata Tagging:** Attaches file path, repository ID, language, and line numbers to each chunk.

### 2.4 Embedding Service
- **Generation:** Sends chunks to an embedding model (e.g., OpenAI `text-embedding-3-small` or a local model).
- **Batching:** Batches requests to optimize API usage and speed.

### 2.5 Search & Chat Services
- **Search:** Performs vector similarity search using `pgvector` operators.
- **Chat:** Implements Retrieval-Augmented Generation (RAG). It fetches top-K relevant chunks, constructs a prompt for the LLM, and streams the response.

## 3. Internal Workflows

### 3.1 Repository Indexing Workflow (Major Workflow)
1. **Trigger:** User submits a repository URL.
2. **Step 1:** API Gateway receives request and publishes a `repo.import` event to Redis.
3. **Step 2:** Parser Service picks up the event, clones the repo, and runs Tree-sitter.
4. **Step 3:** Parser outputs a JSON stream of extracted code blocks to the Chunking Service.
5. **Step 4:** Chunking Service creates chunks and calls the Embedding Service.
6. **Step 5:** Embedding Service returns vectors.
7. **Step 6:** Chunking Service saves chunks and vectors to PostgreSQL.
8. **Step 7:** System updates repository status to `Indexed`.

### 3.2 Query & Chat Workflow (Major Workflow)
1. **Trigger:** User asks a question or performs a search.
2. **Step 1:** Chat Service receives the text query.
3. **Step 2:** Chat Service calls Embedding Service to generate an embedding for the user's query.
4. **Step 3:** Chat Service queries PostgreSQL using `pgvector` (e.g., `<=>` operator for cosine distance) to find the top 5 most similar chunks.
5. **Step 4:** Chat Service constructs a prompt combining the user's question and the retrieved chunks as context.
6. **Step 5:** Chat Service calls the LLM and streams the response back to the user.

## 4. Algorithms

### 4.1 Syntax-Aware Chunking Algorithm
To avoid breaking code context:
1. Identify function boundaries using Tree-sitter AST.
2. If a function is smaller than the max chunk size (e.g., 512 tokens), keep it as a single chunk.
3. If a function exceeds the max chunk size, split it at logical boundaries:
   - Priority 1: Inner class/method boundaries.
   - Priority 2: Empty lines or block boundaries (e.g., after a loop or conditional).
   - Priority 3: Fallback to fixed character splitting with overlap.

### 4.2 Vector Search
- **Metric:** Cosine Similarity.
- **Tool:** `pgvector` extension in PostgreSQL.
- **Query Example:** `SELECT content FROM chunks ORDER BY embedding <=> $1 LIMIT 5;`

## 5. APIs (Proposed)

### 5.1 Repository Management API
- `POST /api/v1/repositories`
  - Body: `{ "url": "string", "branch": "string" }`
  - Returns: `{ "id": "string", "status": "pending" }`
- `GET /api/v1/repositories/:id`
  - Returns: `{ "id": "string", "status": "indexed|processing|failed" }`

### 5.2 Search API
- `GET /api/v1/search`
  - Query Params: `q=query_string&repo_id=string`
  - Returns: `[ { "content": "string", "file": "string", "score": 0.95 } ]`

### 5.3 Chat API
- `POST /api/v1/chat`
  - Body: `{ "message": "string", "repo_id": "string", "history_id": "string" }`
  - Returns: Stream of chunks (SSE) or full JSON response.
