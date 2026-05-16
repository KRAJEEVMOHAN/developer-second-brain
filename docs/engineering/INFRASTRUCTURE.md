# Infrastructure Guide --- AI Developer Second Brain

## 1. Introduction
This document outlines the infrastructure setup for the AI Developer Second Brain project, covering local development with Docker, database configuration, and deployment architecture.

## 2. Docker Setup (Local Development)
We use Docker Compose to spin up the required backing services for local development. This ensures that all developers work with the same versions of Postgres and Redis.

### Sample `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16 # Postgres with pgvector pre-installed
    container_name: second_brain_db
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-second_brain}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: second_brain_redis
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

To start the infrastructure, run:
```bash
docker-compose up -d
```

## 3. PostgreSQL
PostgreSQL serves as our source of truth for relational data and our vector store.

- **Version:** PostgreSQL 16 (via the `pgvector` image).
- **Extension:** The `pgvector` extension must be enabled on the database to support vector types and similarity search.
  - Run `CREATE EXTENSION IF NOT EXISTS vector;` during database initialization.
- **Usage:** Stores repository metadata, file paths, code chunks, and their high-dimensional vector embeddings.

## 4. Redis
Redis is used for two primary purposes in the backend:

1. **Caching:** Storing session data and frequently accessed search results.
2. **Message Queue:** Managing background processing jobs (like heavy parsing and embedding generation) using a library like `BullMQ` for Node.js.

- **Version:** Redis 7.

## 5. Deployment Architecture
The system is designed to be deployable via container orchestration:

- **Small Scale:** A single VPS running Docker Compose containing the frontend, backend, Postgres, and Redis.
- **Large Scale:**
  - **Compute:** Frontend (Static hosting like Vercel or S3), Backend services deployed on Kubernetes or AWS ECS.
  - **Database:** Managed PostgreSQL with pgvector support (e.g., AWS RDS).
  - **Cache/Queue:** Managed Redis (e.g., AWS ElastiCache).
