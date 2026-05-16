# Project Structure --- AI Developer Second Brain

## 1. Introduction
This document defines the folder structure and naming conventions for the AI Developer Second Brain project. We use a structured layout to manage the frontend and backend components.

## 2. Folder Structure

Since the project is in its early stages, we propose a clean separation between the frontend and backend, with a modular backend to handle the different AI services.

```text
developer-second-brain/
├── apps/
│   ├── frontend/             # React + TypeScript Web App
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI components (Chat, RepoList, etc.)
│   │   │   ├── pages/        # Page views (Dashboard, Chat View)
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   └── services/     # API clients for backend communication
│   │   └── package.json
│   │
│   └── backend/              # Node.js Services
│       ├── src/
│       │   ├── services/     # Core business logic
│       │   │   ├── parser/   # Tree-sitter parsing logic
│       │   │   ├── chunker/  # Code chunking algorithms
│       │   │   ├── embedding/# Embedding generation
│       │   │   └── chat/     # RAG and LLM interaction
│       │   ├── api/          # Express routes and controllers
│       │   ├── config/       # Database and environment configuration
│       │   ├── models/       # Database models (if using an ORM)
│       │   └── index.ts      # Application entry point
│       └── package.json
│
├── docs/                     # Project documentation
│   ├── product/              # Product requirements, vision, user stories
│   ├── design/               # Architecture, database, API specs, pipeline
│   └── engineering/          # Engineering guidelines and structure
│
├── .github/                  # GitHub actions and workflows
├── .gitignore
├── LICENSE
├── README.md
└── package.json              # Root package.json (for workspaces if needed)
```

## 3. Naming Conventions

### 3.1 Files and Folders
- **Directories:** `kebab-case` (e.g., `code-chunks`, `api-gateway`).
- **React Components:** `PascalCase` (e.g., `ChatWindow.tsx`, `Sidebar.tsx`).
- **TypeScript/JavaScript Files:** `camelCase` (e.g., `authService.ts`, `chunker.ts`).
- **Documentation:** `UPPER_CASE.md` for main specs (e.g., `VISION.md`, `SRS.md`) and `kebab-case.md` for supporting docs.

### 3.2 Code
- **Variables and Functions:** `camelCase` (e.g., `getEmbedding()`).
- **Classes and Interfaces:** `PascalCase` (e.g., `ChunkerService`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_CHUNK_SIZE`).

## 4. Package Organization
- We will use **npm workspaces** to manage the `apps/frontend` and `apps/backend` packages from the root.
- Shared types and utilities will be placed in a `packages/common` directory if the codebase grows and requires sharing code between frontend and backend.
