# Coding Guidelines --- AI Developer Second Brain

## 1. Introduction
This document outlines the coding standards and best practices for the AI Developer Second Brain project. Adhering to these guidelines ensures code readability, maintainability, and consistency across the codebase.

## 2. Naming Conventions

### 2.1 General Rules
- Use meaningful and descriptive names. Avoid single-letter variables except in loops.
- Use English for all code identifiers and comments.

### 2.2 Specific Conventions
- **Variables and Functions:** `camelCase` (e.g., `getUserData`, `chunkSize`).
- **Classes and Interfaces:** `PascalCase` (e.g., `ParserService`, `IChunkMetadata`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_TOKENS`, `DEFAULT_LANGUAGE`).
- **React Components:** `PascalCase` (e.g., `ChatWindow`, `RepositoryList`).
- **Files:** Match the name of the main export. `PascalCase` for React components, `camelCase` for utilities and services.

## 3. Code Style (TypeScript)

### 3.1 Types
- Always prefer strict typing. Avoid `any` whenever possible. Use `unknown` if the type is truly dynamic.
- Use `interface` for object shapes and `type` for unions or aliases.

### 3.2 Variables
- Use `const` by default. Use `let` only when variable reassignment is necessary. Avoid `var`.

### 3.3 Functions
- Use arrow functions for inline callbacks and small utilities.
- Use `async/await` for asynchronous operations. Avoid chaining `.then()`.

## 4. Formatting Standards
We use **Prettier** to enforce consistent formatting. Key rules include:

- **Tab Width:** 2 spaces.
- **Semicolons:** Always use semicolons.
- **Quotes:** Single quotes for strings (`'hello'`), unless double quotes are necessary.
- **Trailing Commas:** Use trailing commas where valid in ES5 (objects, arrays, etc.).
- **Line Length:** Maximum 100 characters.

## 5. Best Practices

### 5.1 React
- Use functional components with hooks. Avoid class components.
- Keep components small and focused on a single responsibility.
- Extract complex logic into custom hooks.

### 5.2 Node.js / Express
- Always handle errors. Use `try/catch` blocks in async functions or centralized error-handling middleware.
- Validate all incoming request data (e.g., using a library like `Zod`).
- Avoid blocking the event loop with heavy synchronous operations; offload them if necessary.

### 5.3 Git
- Write clear, descriptive commit messages (prefer Conventional Commits style).
- Create small, focused pull requests that do one thing well.
