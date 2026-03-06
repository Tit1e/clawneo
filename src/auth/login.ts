import { loadConfig } from "../config/load-config.js";
import { loginWithOpenAICodexOAuth } from "./openai-codex-oauth.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await loginWithOpenAICodexOAuth(config);
}

main().catch((error: unknown) => {
  console.error("OpenAI Codex OAuth login failed.");
  console.error(error);
  process.exitCode = 1;
});
