# AI Pipeline Specification --- AI Developer Second Brain

## 1. Introduction
This document details the AI pipeline for the Developer Second Brain project, covering code parsing, chunking, embedding generation, retrieval, and ranking.

## 2. Parsing Workflow
The parsing workflow extracts structural information from source code to enable semantic understanding.

1. **Language Detection:** Identify the programming language of the file based on extension and content.
2. **AST Generation:** Load the appropriate Tree-sitter grammar and parse the file into an Abstract Syntax Tree (AST).
3. **Node Extraction:** Query the AST to find specific node types:
   - Functions and Methods
   - Classes and Interfaces
   - Module Imports and Dependencies
4. **Output:** A JSON stream of code blocks with attached metadata (line numbers, file path).

## 3. Chunking Strategy
Instead of fixed-size character chunking, we use a **syntax-aware chunking strategy** to preserve code context.

- **Unit of Chunking:** Functions and classes are the preferred units.
- **Size Constraints:** Target chunk size is approximately 512 tokens.
- **Handling Large Functions:**
  - If a function exceeds the target size, it is split at internal boundaries (e.g., empty lines or block boundaries).
  - A fallback to character splitting with overlap is used if no logical boundary is found.
- **Context Enrichment:** Chunks are prefixed with minimal context (e.g., `// File: src/auth.js`) before embedding.

## 4. Embedding Generation
- **Model:** OpenAI `text-embedding-3-small` (or equivalent open-source model).
- **Dimensions:** 1536.
- **Process:**
  1. Chunks are collected and batched.
  2. Batches are sent to the embedding service.
  3. Returned vectors are stored in the `code_chunks` table in PostgreSQL.

## 5. Retrieval Pipeline (RAG)
The retrieval pipeline fetches relevant context for user queries to power the chat system.

1. **Query Embedding:** The user's natural language query is converted into a vector using the same embedding model.
2. **Vector Search:** A similarity search is performed in `pgvector` using cosine distance.
   - **Query:** `SELECT content, 1 - (embedding <=> $1) AS similarity FROM code_chunks WHERE repository_id = $2 ORDER BY embedding <=> $1 LIMIT 5;`
3. **Context Assembly:** The top 5 chunks are retrieved and formatted as context for the LLM prompt.

## 6. Ranking Logic
- **Primary Rank:** Based on Cosine Similarity score from the vector search.
- **Future Enhancements:**
  - **Recency Boost:** Boost scores for chunks from recently modified files.
  - **Keyword Match Boost:** Combine vector search with BM25 keyword search (Hybrid Search) to ensure exact terms are matched.

## 7. Citation Generation
To ensure the answers are trustworthy and verifiable, the system generates citations for the source code used.
1. **Metadata Tracking:** Each code chunk is stored with its file path and line number range.
2. **Context Tagging:** When injected into the prompt, each chunk is prefixed with its source (e.g., `[File: src/auth.js:10-25]`).
3. **LLM Instruction:** The LLM is instructed to use these tags to reference the sources in its response.
4. **Extraction:** The backend parses the LLM response to extract citations and returns them in a structured array alongside the message.

