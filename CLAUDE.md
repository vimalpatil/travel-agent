# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Wanderly is a conversational travel agent: an Express backend (`server/`) that runs a LangChain JS `createAgent` on Google Gemini, with two tools (Tavily `web_search`, wttr.in `weather_lookup`), and a React + Vite chat UI (`client/`). The root `package.json` only orchestrates the two sub-packages, and each has its own `node_modules` and lockfile. Node.js 20+, ES modules throughout.

## Commands

```bash
npm run install:all                 # install root, server and client deps
npm run dev                         # server (node --watch, :3001) + client (vite, :5173) via concurrently
npm run build                       # builds the client only

npm --prefix server test            # vitest run (integration tests, no API keys needed)
npm --prefix server run test:watch
npm --prefix server test -- -t "reports unique tools"   # run a single test by name
npm --prefix client run lint        # oxlint (client only; the server has no linter)
```

Config lives in `server/.env` (copy from `server/.env.example`): `GOOGLE_API_KEY` and `TAVILY_API_KEY` are required, and `GEMINI_MODEL`, `PORT` and the `LANGSMITH_*` tracing vars are optional. Reading `.env` is denied in `.claude/settings.json`; use `.env.example` to see which variables exist.

## Architecture

- **Request flow:** the client posts `{ message, threadId }` to `/api/chat`. The Vite dev server proxies `/api` to `localhost:3001`, so the Vite proxy has to change if `PORT` changes. `app.js` calls `agent.invoke(...)` with `configurable.thread_id`, then returns `{ reply, threadId, toolsUsed }`.
- **Conversation memory:** `agent.js` exports a module-level `MemorySaver` checkpointer that is shared by the agent and by `/api/reset` (`checkpointer.deleteThread`). All conversation state, including user preferences, lives in server memory per `thread_id` and is lost when the server restarts. The client keeps the `threadId` and its own copy of the displayed messages in `localStorage`, so after a server restart the UI shows history the agent no longer has.
- **Per-turn extraction:** the agent returns the full thread history. `app.js` walks back to the latest human message and only uses messages after it to compute `toolsUsed` and the reply. `textOf` flattens Gemini's array-of-parts content into plain text.
- **Lazy construction:** `getAgent()` builds the agent the first time it's called and throws if `GOOGLE_API_KEY` is missing. The Tavily client is also built lazily. This lets the server boot, and the tests run, without keys.
- **Testability seam:** `createApp({ agentFactory })` takes an injectable factory. `server/test/api.test.js` passes fake agents that return LangChain `HumanMessage`/`AIMessage`/`ToolMessage` arrays, and uses the real shared `checkpointer` for the reset tests. `app.js` also exports a default `app` instance, which `index.js` starts after loading `dotenv`.
- **Tools** catch their own errors and return error strings, never throwing, so a failed search or weather lookup becomes something the model can respond to. Tool-selection rules (always search for travel questions, use weather for packing questions) and preference memory are driven by the system prompt in `agent.js`.
- **Error handling:** the final Express error middleware maps body-parser errors (invalid JSON → 400, too large → 413, with a 100kb limit) to JSON responses. Every other error becomes a 500 with `err.message`.
