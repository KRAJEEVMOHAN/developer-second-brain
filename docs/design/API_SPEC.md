# API Specification --- AI Developer Second Brain

## 1. Introduction
This document defines the REST API specification for the AI Developer Second Brain project. All request and response bodies use JSON format unless specified otherwise.

## 2. Base URL
`http://localhost:3000/api/v1` (Default development URL)

## 3. Endpoints

### 3.1 Repository Management

#### 3.1.1 Import Repository
Import a new Git repository for indexing.

- **URL:** `/repositories`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "url": "https://github.com/user/repo.git",
    "branch": "main"
  }
  ```
- **Success Response:**
  - **Code:** 202 Accepted
  - **Body:**
    ```json
    {
      "id": "uuid-v4-string",
      "status": "pending",
      "message": "Repository import started"
    }
    ```

#### 3.1.2 Get Repository Status
Check the indexing status of a repository.

- **URL:** `/repositories/:id`
- **Method:** `GET`
- **Success Response:**
  - **Code:** 200 OK
  - **Body:**
    ```json
    {
      "id": "uuid-v4-string",
      "name": "repo",
      "url": "https://github.com/user/repo.git",
      "status": "indexed",
      "language": "JavaScript",
      "created_at": "2026-05-16T12:00:00Z"
    }
    ```

### 3.2 Search & Chat

#### 3.2.1 Semantic Search
Search for code or concepts within a repository.

- **URL:** `/search`
- **Method:** `GET`
- **Query Parameters:**
  - `q` (string, required): The search query.
  - `repo_id` (uuid, required): The repository to search in.
  - `limit` (int, optional): Max results to return (default 5).
- **Success Response:**
  - **Code:** 200 OK
  - **Body:**
    ```json
    [
      {
        "content": "function authenticate() { ... }",
        "file": "src/auth.js",
        "start_line": 10,
        "end_line": 20,
        "score": 0.95
      }
    ]
    ```

#### 3.2.2 Repository Chat
Ask a question about the repository and get a contextual answer.

- **URL:** `/chat`
- **Method:** `POST`
- **Request Body:**
  ```json
  {
    "message": "How does the authentication flow work?",
    "repo_id": "uuid-v4-string",
    "conversation_id": "optional-uuid"
  }
  ```
- **Success Response:**
  - **Code:** 200 OK
  - **Body:**
    ```json
    {
      "response": "The authentication flow starts in `src/auth.js`...",
      "conversation_id": "uuid-v4-string",
      "citations": [
        {
          "file": "src/auth.js",
          "lines": "10-20"
        }
      ]
    }
    ```

## 4. Error Handling

### 4.1 Error Response Structure
All errors return a standard JSON structure.

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### 4.2 Common Error Codes
- **400 Bad Request:** `INVALID_INPUT` - Missing or invalid parameters.
- **401 Unauthorized:** `UNAUTHORIZED` - Missing or invalid auth token.
- **404 Not Found:** `RESOURCE_NOT_FOUND` - Repository or file not found.
- **500 Internal Server Error:** `INTERNAL_ERROR` - Something went wrong on the server.
