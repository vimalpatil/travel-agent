import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { getAgent, checkpointer } from "./agent.js";

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.type === "text" ? part.text : ""))
      .join("");
  }
  return "";
}

export function createApp({ agentFactory = getAgent } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/chat", async (req, res, next) => {
    try {
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
      if (!message) return res.status(400).json({ error: "`message` must be a non-empty string." });

      const threadId =
        typeof req.body?.threadId === "string" && req.body.threadId.trim()
          ? req.body.threadId.trim()
          : randomUUID();

      const result = await agentFactory().invoke(
        { messages: [{ role: "user", content: message }] },
        { configurable: { thread_id: threadId } }
      );

      // Only look at messages produced in this turn (after the latest human message).
      const messages = result.messages ?? [];
      let start = messages.length - 1;
      while (start >= 0 && messages[start].type !== "human" && messages[start]._getType?.() !== "human") {
        start--;
      }
      const turn = messages.slice(start + 1);

      const toolsUsed = [
        ...new Set(turn.flatMap((m) => (m.tool_calls ?? []).map((tc) => tc.name)).filter(Boolean)),
      ];
      const last = turn.at(-1) ?? messages.at(-1);
      const reply = textOf(last?.content) || "Sorry, I couldn't come up with a response.";

      res.json({ reply, threadId, toolsUsed });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/reset", async (req, res, next) => {
    try {
      const threadId = req.body?.threadId;
      if (typeof threadId !== "string" || !threadId.trim()) {
        return res.status(400).json({ error: "`threadId` must be a non-empty string." });
      }
      await checkpointer.deleteThread(threadId.trim());
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  return app;
}

export const app = createApp();
