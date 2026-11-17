import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { createApp } from "../src/app.js";
import { checkpointer } from "../src/agent.js";

/** Builds a fake agent whose invoke() resolves to `{ messages }` (or whatever `impl` returns). */
function fakeAgent(impl) {
  const invoke = vi.fn(impl);
  return { invoke, factory: vi.fn(() => ({ invoke })) };
}

function replyWith(...messages) {
  return fakeAgent(async () => ({ messages }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("sends CORS headers", async () => {
    const res = await request(createApp()).get("/api/health").set("Origin", "http://example.com");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});

describe("POST /api/chat", () => {
  let errorSpy;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("returns the agent's reply, a generated threadId and no tools", async () => {
    const agent = replyWith(new HumanMessage("Hi"), new AIMessage("Hello, traveler!"));
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Hi" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Hello, traveler!");
    expect(res.body.threadId).toMatch(UUID_RE);
    expect(res.body.toolsUsed).toEqual([]);
  });

  it("passes the trimmed message and threadId to the agent", async () => {
    const agent = replyWith(new HumanMessage("Hi"), new AIMessage("ok"));
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "  Plan a trip to Kyoto  ", threadId: "  thread-123  " });

    expect(res.status).toBe(200);
    expect(res.body.threadId).toBe("thread-123");
    expect(agent.invoke).toHaveBeenCalledOnce();
    expect(agent.invoke).toHaveBeenCalledWith(
      { messages: [{ role: "user", content: "Plan a trip to Kyoto" }] },
      { configurable: { thread_id: "thread-123" } }
    );
  });

  it("generates a new threadId when the provided one is blank", async () => {
    const agent = replyWith(new HumanMessage("Hi"), new AIMessage("ok"));
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Hi", threadId: "   " });

    expect(res.body.threadId).toMatch(UUID_RE);
  });

  it("reports unique tools used in the current turn only", async () => {
    const agent = replyWith(
      // Previous turn — its tool calls must not be reported.
      new HumanMessage("Weather in Paris?"),
      new AIMessage({ content: "", tool_calls: [{ id: "old", name: "weather_lookup", args: { city: "Paris" } }] }),
      new ToolMessage({ content: "Sunny", tool_call_id: "old" }),
      new AIMessage("It's sunny in Paris."),
      // Current turn.
      new HumanMessage("Things to do in Rome?"),
      new AIMessage({
        content: "",
        tool_calls: [
          { id: "a", name: "web_search", args: { query: "Rome attractions" } },
          { id: "b", name: "web_search", args: { query: "Rome food" } },
        ],
      }),
      new ToolMessage({ content: "results", tool_call_id: "a" }),
      new ToolMessage({ content: "results", tool_call_id: "b" }),
      new AIMessage("Visit the Colosseum.")
    );

    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Things to do in Rome?" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Visit the Colosseum.");
    expect(res.body.toolsUsed).toEqual(["web_search"]);
  });

  it("joins text parts of array content and skips non-text parts", async () => {
    const agent = replyWith(
      new HumanMessage("Hi"),
      new AIMessage({
        content: [
          { type: "text", text: "Hello " },
          { type: "image_url", image_url: "http://x/y.png" },
          { type: "text", text: "world" },
        ],
      })
    );
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Hi" });

    expect(res.body.reply).toBe("Hello world");
  });

  it("falls back to an apology when the agent produces no text", async () => {
    const agent = replyWith(new HumanMessage("Hi"), new AIMessage(""));
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Hi" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Sorry, I couldn't come up with a response.");
  });

  it("handles a result with no messages", async () => {
    const agent = fakeAgent(async () => ({}));
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Hi" });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe("Sorry, I couldn't come up with a response.");
    expect(res.body.toolsUsed).toEqual([]);
  });

  it.each([
    ["missing", {}],
    ["empty", { message: "" }],
    ["whitespace-only", { message: "   " }],
    ["non-string", { message: 42 }],
  ])("rejects a %s message with 400", async (_label, body) => {
    const agent = replyWith(new AIMessage("never"));
    const res = await request(createApp({ agentFactory: agent.factory })).post("/api/chat").send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "`message` must be a non-empty string." });
    expect(agent.factory).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await request(createApp())
      .post("/api/chat")
      .set("Content-Type", "application/json")
      .send('{"message": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON body." });
  });

  it("rejects bodies over the 100kb limit", async () => {
    const res = await request(createApp())
      .post("/api/chat")
      .send({ message: "x".repeat(110 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "request entity too large" });
  });

  it("returns 500 with the error message when the agent throws", async () => {
    const agent = fakeAgent(async () => {
      throw new Error("model exploded");
    });
    const res = await request(createApp({ agentFactory: agent.factory }))
      .post("/api/chat")
      .send({ message: "Hi" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "model exploded" });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns 500 when the agent factory itself throws (e.g. missing API key)", async () => {
    const original = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    try {
      // Default factory = real getAgent(), which refuses to start without a key.
      const res = await request(createApp()).post("/api/chat").send({ message: "Hi" });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/GOOGLE_API_KEY is not configured/);
    } finally {
      if (original !== undefined) process.env.GOOGLE_API_KEY = original;
    }
  });
});

describe("POST /api/reset", () => {
  it("deletes the thread's checkpoints from the shared checkpointer", async () => {
    const threadId = "reset-me";
    const config = { configurable: { thread_id: threadId, checkpoint_ns: "" } };
    await checkpointer.put(
      config,
      { v: 1, id: "cp-1", ts: new Date().toISOString(), channel_values: {}, channel_versions: {}, versions_seen: {} },
      { source: "input", step: -1, parents: {} },
      {}
    );
    expect(await checkpointer.getTuple(config)).toBeDefined();

    const res = await request(createApp()).post("/api/reset").send({ threadId: `  ${threadId}  ` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(await checkpointer.getTuple(config)).toBeUndefined();
  });

  it("succeeds for an unknown thread", async () => {
    const res = await request(createApp()).post("/api/reset").send({ threadId: "does-not-exist" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it.each([
    ["missing", {}],
    ["empty", { threadId: "" }],
    ["whitespace-only", { threadId: "  " }],
    ["non-string", { threadId: 123 }],
  ])("rejects a %s threadId with 400", async (_label, body) => {
    const res = await request(createApp()).post("/api/reset").send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "`threadId` must be a non-empty string." });
  });
});

describe("unknown routes", () => {
  it.each([
    ["get", "/api/nope"],
    ["post", "/api/nope"],
    ["get", "/api/chat"],
  ])("%s %s returns 404 JSON", async (method, path) => {
    const res = await request(createApp())[method](path);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
