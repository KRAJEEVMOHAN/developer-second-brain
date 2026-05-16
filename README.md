# Developer Second Brain

<p align="center">
AI-powered persistent engineering memory and code intelligence platform for developers and teams.
</p>

---

## Overview

Developer Second Brain is an open-source platform designed to help developers understand, search, and retain software knowledge beyond source code.

Modern software projects accumulate information across multiple places:

- Source code
- Pull requests
- Documentation
- Architecture decisions
- Issues and discussions
- Team notes and historical context

As projects grow, important knowledge becomes difficult to discover and easy to lose.

Developer Second Brain aims to create a persistent knowledge layer that continuously learns from repositories and evolves with software systems.

---

## Problem Statement

Software teams frequently encounter:

- Slow onboarding of new developers
- Repeated questions across teams
- Missing or outdated documentation
- Difficulty understanding large codebases
- Architectural knowledge being lost over time
- Scattered information across multiple tools

Traditional keyword search and static documentation often do not provide sufficient context.

---

## Vision

Build an intelligent system that:

- Understands repositories
- Learns project structure
- Preserves engineering knowledge
- Provides semantic understanding
- Assists developers with contextual insights

The goal is not simply to chat with code.

The goal is to build a long-term engineering memory system.

---

## Core Features

### Repository Intelligence

- Import and analyze repositories
- Detect languages and frameworks
- Extract project metadata
- Track repository evolution

### Semantic Code Search

- Natural language search
- Context-aware retrieval
- Code citations
- Intelligent ranking

Examples:

```text
Where is authentication implemented?

Which APIs call UserService?

Show payment workflow
```

### Repository Chat

- Ask questions about codebases
- Explain implementation details
- Summarize modules
- Understand workflows

### Architecture Intelligence

- Dependency graphs
- Module relationships
- API maps
- Circular dependency detection

### Team Memory

- Architecture decisions
- Meeting notes
- Migration history
- Knowledge preservation

---

## Planned Architecture

```text
Frontend
    ↓
API Gateway
    ↓

--------------------------------

Repository Service
Parser Service
Embedding Service
Search Service
Chat Service
Memory Service

--------------------------------

    ↓

PostgreSQL
pgvector
Redis
```

---

## Technology Stack

### Frontend

- React
- TypeScript
- TailwindCSS

### Backend

- Node.js

### Database

- PostgreSQL
- pgvector

### Infrastructure

- Docker
- Redis

### AI Components

- Tree-sitter
- Embeddings
- Retrieval Pipeline
- LLM Integration

---

## Roadmap

### V1 — Repository Understanding

- Repository import
- Repository parsing
- Metadata extraction
- Semantic search
- Repository chat

### V2 — Architecture Intelligence

- Dependency graph generation
- Architecture summaries
- Knowledge graph support

### V3 — Team Memory

- Persistent project memory
- Decision records
- Collaboration features

---

## Project Structure

```text
developer-second-brain/

├── apps/
├── services/
├── packages/
├── infrastructure/
├── docs/
└── scripts/
```

---

## Current Status

Early development

The project is currently in the planning and architecture phase.

---

## Contributing

Contributions, discussions, feature requests, and ideas are welcome.

Contribution guidelines will be added soon.

---

## License

Apache License 2.0
