# Wanderly — LangChain Travel Agent

A conversational travel assistant built with LangChain JS (`createAgent`), Google Gemini
(`gemini-3.1-flash-lite`), Tavily web search and wttr.in weather lookups.
React + Vite frontend, Express backend.

## Features
- Chat UI with Markdown replies and badges showing which tools were used
- **web_search** (Tavily): used for any travel-related question
- **weather_lookup** (wttr.in, no key needed): current conditions + 3-day forecast for a city
- **In-memory checkpointer** (`MemorySaver`): each chat is a `thread_id`; the agent remembers
  preferences you share (budget, diet, travel style…) for the rest of that conversation.
  State lives in server memory and is cleared on restart or via **New chat**.

## Setup
Requires Node.js 20+.

```bash
npm run install:all
cp server/.env.example server/.env   # then add GOOGLE_API_KEY and TAVILY_API_KEY
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` to the backend)
- Backend: http://localhost:3001

Get keys at https://aistudio.google.com/apikey and https://app.tavily.com.

## API
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{ status: "ok" }` |
| POST | `/api/chat` | `{ message, threadId? }` | `{ reply, threadId, toolsUsed }` |
| POST | `/api/reset` | `{ threadId }` | `{ ok: true }` |

## Project structure
```
server/src/
  index.js          # loads .env, starts the server
  app.js            # Express app (exported for tests)
  agent.js          # Gemini model, MemorySaver checkpointer, createAgent + system prompt
  tools/search.js   # Tavily web_search tool
  tools/weather.js  # wttr.in weather_lookup tool
client/src/
  App.jsx           # chat state, thread id (persisted in localStorage)
  components/       # ChatWindow, MessageBubble, ChatInput
```
