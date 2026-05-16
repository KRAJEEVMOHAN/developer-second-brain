# UI Specification --- AI Developer Second Brain

## 1. Introduction
This document outlines the user interface specification for the AI Developer Second Brain web application. The design focuses on a developer-centric, clean, and highly functional interface.

## 2. Design Aesthetics
- **Theme:** Dark mode by default (sleek, premium feel).
- **Typography:** Modern sans-serif font (e.g., *Inter* or *Outfit*).
- **Color Palette:** Curated harmonious palette with vibrant accents for highlights (e.g., deep blue/indigo for primary actions, subtle gray for borders).
- **Layout:** Responsive grid and flexbox layouts ensuring usability across screen sizes.

## 3. Key Views

### 3.1 Dashboard (Repository List)
The landing page after authentication.
- **Sidebar:** Navigation links (Repositories, Settings, Help).
- **Main Area:**
  - **Header:** Title and "Import Repository" button.
  - **Grid/List:** Display of indexed repositories.
    - Card contains: Repo Name, Language icon, Status badge (Indexed/Processing/Failed), Last updated date.
- **Import Modal:** Triggered by "Import Repository". Contains input for Git URL, branch dropdown, and "Start Import" button.

### 3.2 Repository View & Chat Interface
The main workspace for interacting with a specific repository.
- **Layout:** Three-column layout.
- **Left Column (File Explorer):** A tree view of the repository files. Clicking a file shows its details or opens it in the chat context.
- **Center Column (Chat Workspace):**
  - **Message List:** Displays the conversation history.
    - User messages: Right-aligned, distinct background.
    - AI responses: Left-aligned, markdown rendered, with inline citations (e.g., `[src/auth.js:10-20]`).
  - **Input Area:** Text area with auto-resize, "Send" button, and options to clear history.
- **Right Column (Context & Citations):**
  - Shows the code snippets retrieved for the last query.
  - Clicking a citation in the chat scrolls this view to the specific snippet.

## 4. Interactions and Animations
- **Hover Effects:** Subtle scale or color change on repository cards and buttons.
- **Loading States:** Shimmer effect on repository cards during processing. Typing indicator for AI chat responses.
- **Transitions:** Smooth slide-in for sidebars and modals.
