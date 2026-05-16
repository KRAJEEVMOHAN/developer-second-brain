# Test Plan --- AI Developer Second Brain

## 1. Introduction
This document outlines the testing strategy for the AI Developer Second Brain project. It covers unit testing, integration testing, and performance testing to ensure system reliability and performance.

## 2. Unit Tests
Unit tests focus on testing individual components or functions in isolation.

- **Framework:** **Vitest** or **Jest** for both Frontend (React) and Backend (Node.js).
- **Focus Areas:**
  - **Chunking Algorithm:** Verify that files are split correctly at logical boundaries and metadata is attached.
  - **Parser Extraction:** Verify that Tree-sitter queries correctly extract functions and classes from sample code snippets.
  - **UI Components:** Test individual React components with mock props to ensure they render correctly.
- **Guidelines:**
  - Mock all external dependencies (e.g., database calls, LLM APIs).
  - Aim for high coverage in core algorithmic files (parser and chunker).

## 3. Integration Tests
Integration tests verify that different components or services work together correctly.

- **Tools:** **Supertest** for testing API endpoints.
- **Focus Areas:**
  - **Database Integration:** Verify that data is correctly written to and read from PostgreSQL/pgvector.
  - **API Endpoints:** Test the full request-response cycle for `/search` and `/chat` using a mock database state.
  - **Queue Processing:** Verify that submitting a repository triggers the parsing job in the background (using a test Redis instance).

## 4. Performance Tests
Performance tests ensure that the system meets the non-functional requirements defined in the SRS.

- **Tools:** **k6** or **Autocannon**.
- **Focus Areas:**
  - **Search Latency:** Ensure that semantic search queries return results in less than 2 seconds under a load of multiple concurrent users.
  - **Indexing Speed:** Measure the time taken to clone, parse, and embed a standard small repository, aiming for less than 30 seconds.
  - **Memory Usage:** Monitor memory consumption of the Parser service when processing large repositories to prevent OOM (Out of Memory) kills.
