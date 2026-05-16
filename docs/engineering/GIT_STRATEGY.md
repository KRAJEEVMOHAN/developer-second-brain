# Git Strategy --- AI Developer Second Brain

## 1. Introduction
This document outlines the Git branching strategy, commit message conventions, and pull request workflow for the AI Developer Second Brain project.

## 2. Branching Strategy
We use a lightweight, branch-based workflow (similar to **GitHub Flow**).

- **`main`**: The stable branch that contains production-ready code. Direct commits to `main` are discouraged for non-trivial changes.
- **Feature Branches (`feature/`)**: Used for developing new features (e.g., `feature/parser-tree-sitter`).
- **Bugfix Branches (`fix/` or `bugfix/`)**: Used for fixing bugs (e.g., `fix/search-latency`).
- **Documentation Branches (`docs/`)**: Used for updating documentation (e.g., `docs/git-strategy`).
- **Refactor Branches (`refactor/`)**: Used for code refactoring that does not change functionality.

### Workflow:
1. Branch off from `main`.
2. Make your changes and commit using Conventional Commits.
3. Push your branch to the remote repository.
4. Open a Pull Request (PR) against `main`.
5. Merge once reviewed and checks pass.

## 3. Commit Message Conventions
We follow the **Conventional Commits** specification. This makes the history readable and allows for automated changelog generation.

### Format
```text
<type>(<optional scope>): <description>
```

### Types
- **`feat`**: A new feature.
- **`fix`**: A bug fix.
- **`docs`**: Documentation changes only.
- **`style`**: Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.).
- **`refactor`**: A code change that neither fixes a bug nor adds a feature.
- **`test`**: Adding missing tests or correcting existing tests.
- **`chore`**: Changes to the build process or auxiliary tools and libraries.

### Examples
- `feat(chat): add support for streaming responses`
- `fix(parser): resolve null pointer in python parser`
- `docs: create git strategy document`

## 4. Pull Request Guidelines
- **Focus:** Keep PRs small and focused on a single issue or feature.
- **Description:** Provide a clear description of what the PR does and link relevant issues (e.g., `Closes #45`).
- **Review:** At least one team member should review the PR before merging (if applicable).
