import "dotenv/config";
import { app } from "./app.js";
import { MODEL_NAME } from "./agent.js";

for (const key of ["GOOGLE_API_KEY", "TAVILY_API_KEY"]) {
  if (!process.env[key]) console.warn(`⚠️  ${key} is not set — add it to server/.env`);
}

if (process.env.LANGSMITH_TRACING === "true") {
  if (!process.env.LANGSMITH_API_KEY) {
    console.warn("⚠️  LANGSMITH_TRACING is on but LANGSMITH_API_KEY is not set — traces will fail to upload");
  } else {
    console.log(`LangSmith tracing enabled → project "${process.env.LANGSMITH_PROJECT || "default"}"`);
  }
}

const port =Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Travel agent API listening on http://localhost:${port} (model: ${MODEL_NAME})`);
});
