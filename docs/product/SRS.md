# Software Requirements Specification (SRS) --- AI Developer Second Brain

## 1. Introduction
This document outlines the software requirements for the AI Developer Second Brain project. It builds upon the Project Vision to provide a detailed specification of functional and non-functional requirements.

## 2. Functional Requirements

### 2.1 Repository Management (FR-REP)
- **FR-REP-1:** The system shall allow users to import a repository using a Git URL.
- **FR-REP-2:** The system shall support branch selection during repository import.
- **FR-REP-3:** The system shall provide a repository refresh mechanism to pull updates.
- **FR-REP-4:** The system shall automatically detect the primary programming languages of the repository.
- **FR-REP-5:** The system shall provide a dashboard to view indexed repositories.

### 2.2 Parsing Engine (FR-PAR)
- **FR-PAR-1:** The system shall use Tree-sitter to parse source code.
- **FR-PAR-2:** The system shall extract functions, classes, and interfaces from the source code.
- **FR-PAR-3:** The system shall identify dependencies, imports, and APIs used in the code.
- **FR-PAR-4:** The system shall extract database models and schemas.

### 2.3 Chunking Service (FR-CHK)
- **FR-CHK-1:** The system shall perform function-level chunking of code.
- **FR-CHK-2:** The system shall perform class-level chunking of code.
- **FR-CHK-3:** The system shall attach metadata (file, module, language, repository) to chunks.
- **FR-CHK-4:** The system shall avoid fixed character chunking to preserve code context.

### 2.4 Embedding Service (FR-EMB)
- **FR-EMB-1:** The system shall generate vector embeddings for code chunks.
- **FR-EMB-2:** The system shall store embeddings in a vector database (pgvector).
- **FR-EMB-3:** The system shall support replacing the embedding model without full re-indexing.

### 2.5 Semantic Search (FR-SEA)
- **FR-SEA-1:** The system shall support natural language search queries.
- **FR-SEA-2:** The system shall rank search results based on relevance.
- **FR-SEA-3:** The system shall allow filtering of search results by file, module, or language.
- **FR-SEA-4:** The system shall provide citations/links to the source files in search results.

### 2.6 Repository Chat (FR-CHT)
- **FR-CHT-1:** The system shall allow users to ask questions about the repository.
- **FR-CHT-2:** The system shall maintain conversation history.
- **FR-CHT-3:** The system shall retrieve relevant context (code chunks) to answer questions.
- **FR-CHT-4:** The system shall provide references to files used to generate the answer.

### 2.7 Architecture Intelligence (FR-ARC)
- **FR-ARC-1:** The system shall generate dependency graphs.
- **FR-ARC-2:** The system shall create maps of APIs and modules.
- **FR-ARC-3:** The system shall detect circular dependencies.

### 2.8 Team Memory (FR-MEM)
- **FR-MEM-1:** The system shall store architectural decisions and notes.
- **FR-MEM-2:** The system shall store reasons for migrations or refactoring.
- **FR-MEM-3:** The system shall allow ingestion of meeting summaries related to technical decisions.

## 3. Non-functional Requirements (NFR)

### 3.1 Performance (NFR-PERF)
- **NFR-PERF-1:** Indexing of a small repository (< 100 files) shall take less than 30 seconds.
- **NFR-PERF-2:** Search queries shall return results in less than 2 seconds.

### 3.2 Scalability (NFR-SCAL)
- **NFR-SCAL-1:** The system shall support indexing and searching across multiple repositories.
- **NFR-SCAL-2:** Heavy processing (parsing, embedding) shall run in the background.

### 3.3 Security (NFR-SEC)
- **NFR-SEC-1:** The system shall authenticate users before accessing repositories.
- **NFR-SEC-2:** The system shall securely handle access tokens for private repositories.
- **NFR-SEC-3:** Token data must be encrypted at rest.

### 3.4 Reliability (NFR-REL)
- **NFR-REL-1:** The system shall handle parsing or network retries gracefully.
- **NFR-REL-2:** The system shall use a queue processing mechanism for background tasks.

## 4. User Stories
- **US-1:** As a developer new to the project, I want to ask natural language questions about the codebase so that I can understand how the authentication flow works without reading all the code.
- **US-2:** As a developer, I want to search for "database connection handling" using natural language so that I can find the relevant files even if I don't know the exact function names.
- **US-3:** As a team lead, I want to store the reason why we switched from MongoDB to PostgreSQL in the system so that future developers understand the context of that decision.
- **US-4:** As an open-source maintainer, I want the system to automatically generate module maps so that contributors can see the high-level architecture easily.

## 5. Constraints
- **CON-1:** The parsing engine must use Tree-sitter.
- **CON-2:** The database must use PostgreSQL with the pgvector extension.
- **CON-3:** The backend must be built using Go.
- **CON-4:** The frontend must use React, TypeScript, and Tailwind CSS.

## 6. Assumptions
- **ASM-1:** Repositories are accessible via Git (HTTPS or SSH).
- **ASM-2:** Users have access to an LLM API (or a local model) for generating embeddings and answers.
- **ASM-3:** The codebases are in languages supported by Tree-sitter.

## 7. Acceptance Criteria
- **AC-REP-1:** Importing a valid Git URL should result in a list of files visible in the dashboard within 1 minute.
- **AC-PAR-1:** For a supported language, functions and classes should be identifiable with >90% accuracy compared to manual code review.
- **AC-SEA-1:** Searching for a concept (e.g., "how to log errors") should return files containing error logging logic in the top 5 results.
- **AC-CHT-1:** The chat response should include at least one file reference or citation for the source of the information.
