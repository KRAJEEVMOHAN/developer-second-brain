# Database Design --- AI Developer Second Brain

## 1. Introduction
This document defines the database schema for the AI Developer Second Brain project. The system uses PostgreSQL with the `pgvector` extension for storing relational data and vector embeddings.

## 2. Tables

### 2.1 repositories
Stores information about the imported Git repositories.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `name` | VARCHAR(255) | NOT NULL | Repository name |
| `url` | VARCHAR(1024) | NOT NULL | Git URL |
| `language` | VARCHAR(50) | | Detected primary language |
| `status` | VARCHAR(20) | DEFAULT 'pending' | Status: pending, processing, indexed, failed |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 2.2 files
Stores file paths within a repository.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `repository_id` | UUID | FOREIGN KEY REFERENCES repositories(id) ON DELETE CASCADE | Parent repository |
| `path` | TEXT | NOT NULL | File path relative to repo root |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

### 2.3 code_chunks
Stores the chunked code content and its vector embedding.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `file_id` | UUID | FOREIGN KEY REFERENCES files(id) ON DELETE CASCADE | Parent file |
| `content` | TEXT | NOT NULL | The actual code snippet |
| `embedding` | vector(1536) | | Vector embedding (e.g., 1536 dimensions for OpenAI) |
| `start_line` | INTEGER | | Line number where chunk starts |
| `end_line` | INTEGER | | Line number where chunk ends |

### 2.4 chat_histories
Stores user chat interactions for context.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `repository_id` | UUID | FOREIGN KEY REFERENCES repositories(id) ON DELETE CASCADE | Context repo |
| `question` | TEXT | NOT NULL | User's question |
| `response` | TEXT | NOT NULL | AI's response |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Timestamp |

### 2.5 memories
Stores team decisions, notes, and architectural context.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `repository_id` | UUID | FOREIGN KEY REFERENCES repositories(id) ON DELETE CASCADE | Context repo |
| `title` | VARCHAR(255) | NOT NULL | Title of the memory/note |
| `content` | TEXT | NOT NULL | Detailed content |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Timestamp |

## 3. Relationships
- **Repositories to Files:** One-to-Many (`repositories.id` -> `files.repository_id`).
- **Files to CodeChunks:** One-to-Many (`files.id` -> `code_chunks.file_id`).
- **Repositories to ChatHistories:** One-to-Many (`repositories.id` -> `chat_histories.repository_id`).
- **Repositories to Memories:** One-to-Many (`repositories.id` -> `memories.repository_id`).

## 4. Indexes

### 4.1 Standard Indexes
- `idx_files_repository_id` ON `files(repository_id)` (B-tree) - For fast lookups of files in a repo.
- `idx_code_chunks_file_id` ON `code_chunks(file_id)` (B-tree) - For fast lookups of chunks in a file.
- `idx_chat_histories_repository_id` ON `chat_histories(repository_id)` (B-tree) - For fetching history by repo.

### 4.2 Vector Indexes
- `idx_code_chunks_embedding` ON `code_chunks USING hnsw (embedding vector_cosine_ops)` - HNSW index for fast approximate nearest neighbor search using cosine distance.

## 5. Constraints
- **Foreign Keys:** All foreign keys use `ON DELETE CASCADE` to ensure referential integrity and cleanup.
- **Required Fields:** Critical fields like `url`, `path`, `content`, `question`, and `response` are marked `NOT NULL`.
