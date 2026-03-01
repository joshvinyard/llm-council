# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Prerequisites
- Node.js with npm
- OpenRouter API key in `.env` file: `OPENROUTER_API_KEY=sk-or-v1-...`

### Install Dependencies
```bash
npm install
```

### Run the App
```bash
npm run dev   # Starts on http://localhost:5173
```

### Production Build
```bash
npm run build   # Builds frontend to frontend/dist/
npm start       # Serves production build
```

### Lint
```bash
npm run lint   # ESLint for frontend
```

### No test suite exists. There are no automated tests.

## Architecture

LLM Bullpen is a single Node.js full-stack app that queries multiple LLMs via OpenRouter, has them anonymously peer-review each other's responses, then synthesizes a final answer. Express serves both the API and the React frontend (via Vite dev middleware in dev, static files in production).

### 3-Stage Pipeline (core logic in `server/council.js`)

1. **Stage 1 - First Opinions**: User query sent to all council models in parallel (`Promise.all`). Individual responses collected.
2. **Stage 2 - Peer Review**: Each model receives anonymized responses (labeled "Response A", "Response B", etc.) and ranks them. A `labelToModel` mapping tracks de-anonymization. Rankings are parsed from a strict "FINAL RANKING:" format via regex.
3. **Stage 3 - Synthesis**: The Chairman model receives all responses + rankings and produces a final synthesized answer.

### Backend (`server/`, Express + Node.js)
- **`config.js`** - `COUNCIL_MODELS` list, `CHAIRMAN_MODEL`, and `OPENROUTER_API_KEY` from `.env` via `dotenv`
- **`openrouter.js`** - `queryModel()` and `queryModelsParallel()` using `fetch()`. Returns null on failure (graceful degradation).
- **`council.js`** - Orchestrates the 3-stage pipeline. Also generates conversation titles via Gemini 2.5-flash.
- **`storage.js`** - JSON file persistence in `data/conversations/` using `fs/promises`. Metadata (labelToModel, aggregateRankings) is ephemeral and NOT persisted.
- **`index.js`** - Express app entry point. API routes + Vite dev middleware (dev) or static file serving (production). SSE streaming via `res.write()`.

### Frontend (`frontend/src/`, React 19 + Vite)
- **`api.js`** - API client. Uses same-origin requests (empty base URL). Streaming uses `ReadableStream` to process SSE events.
- **`App.jsx`** - Root component. Manages conversations state and streaming message handler with progressive UI updates.
- **Components**: `ChatInterface.jsx` (main chat + input), `Sidebar.jsx` (conversation list), `Stage1.jsx` (tabbed individual responses), `Stage2.jsx` (tabbed rankings with client-side de-anonymization), `Stage3.jsx` (chairman's final answer).
- All markdown rendered via `react-markdown`, wrapped in `<div className="markdown-content">` (styled in `index.css`).

### Key Design Decisions

- **Single process**: Express serves both API and frontend — no CORS needed, one command to run.
- **Anonymization**: Models see "Response A/B/C" not model names, preventing favoritism. De-anonymization is client-side only for display.
- **Graceful degradation**: If some models fail, the pipeline continues with successful responses.
- **Streaming**: SSE events (`stage1_start`, `stage1_complete`, `stage2_start`, etc.) enable progressive UI updates during the multi-minute council process.

## Port Configuration
- Single server on **5173**
- To change the port, edit the `PORT` constant in `server/index.js`

## Model Configuration
Models are in `server/config.js`. Edit `COUNCIL_MODELS` and `CHAIRMAN_MODEL` to change which models participate. Uses OpenRouter model identifiers (e.g., `openai/gpt-5.1`, `google/gemini-3-pro-preview`).
