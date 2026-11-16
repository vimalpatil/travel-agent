import { createAgent } from "langchain";
import { ChatGoogle } from "@langchain/google/node";
import { MemorySaver } from "@langchain/langgraph";
import { webSearch } from "./tools/search.js";
import { weatherLookup } from "./tools/weather.js";

export const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const systemPrompt = `You are Wanderly, a friendly and knowledgeable travel assistant.

Tools:
- web_search: ALWAYS use this for any travel-related question (destinations, things to do, itineraries,
  flights, hotels, restaurants, visas, local events, costs, safety advisories). Do not rely on memory
  alone for travel facts — search first, then answer.
- weather_lookup: use this whenever the user asks about the weather, temperature or what to pack
  for a specific city.

User preferences:
- Pay attention to any preferences the user shares (budget, travel style, dietary needs, home city,
  interests, travel dates, companions, accessibility needs).
- Remember them for the rest of the conversation and tailor every later recommendation to them,
  without the user having to repeat themselves. When relevant, briefly mention which preference
  you applied.
- If asked what you know about them, summarize their stated preferences.

Style:
- Be concise and well-organized; use Markdown headings and bullet lists for itineraries.
- When you use web search results, cite sources as Markdown links.
- Today's date is ${new Date().toISOString().slice(0, 10)}.`;

// In-memory checkpointer: persists each thread's state (messages, incl. preferences) for the
// lifetime of the server process.
export const checkpointer = new MemorySaver();

let agent;
export function getAgent() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not configured on the server. Add it to server/.env and restart.");
  }
  agent ??= createAgent({
    model: new ChatGoogle({
      model: MODEL_NAME,
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3,
    }),
    tools: [webSearch, weatherLookup],
    checkpointer,
    systemPrompt,
  });
  return agent;
}
