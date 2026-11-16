import { tool } from "langchain";
import { TavilySearch } from "@langchain/tavily";
import { z } from "zod";

let tavily;
function getTavily() {
  // Lazily constructed so the server can boot (and tests can run) without a key.
  tavily ??= new TavilySearch({
    maxResults: 5,
    topic: "general",
    tavilyApiKey: process.env.TAVILY_API_KEY,
  });
  return tavily;
}

export const webSearch = tool(
  async ({ query }) => {
    try {
      const result = await getTavily().invoke({ query });
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      return `Web search failed: ${err.message}`;
    }
  },
  {
    name: "web_search",
    description:
      "Search the web for up-to-date travel information: destinations, attractions, " +
      "itineraries, flights, hotels, restaurants, visas, local events, costs and travel advisories. " +
      "Returns results with titles, URLs and content snippets.",
    schema: z.object({
      query: z.string().describe("A focused search query, e.g. 'best things to do in Kyoto in spring'"),
    }),
  }
);
