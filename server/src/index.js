import "dotenv/config";
import { app } from "./app.js";
import { MODEL_NAME } from "./agent.js";

for (const key of ["GOOGLE_API_KEY", "TAVILY_API_KEY"]) {
  if (!process.env[key]) console.warn(`⚠️  ${key} is not set — add it to server/.env`);
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Travel agent API listening on http://localhost:${port} (model: ${MODEL_NAME})`);
});
