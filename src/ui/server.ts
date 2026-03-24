import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { completeSimple, type Api, type Model } from "@mariozechner/pi-ai";
import { collectStatusSnapshot } from "../cli/status.js";
import { ensureClawneoConfigFile } from "../config/paths.js";
import { isServiceRunning, restartService } from "../cli/service-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "web");

type MutableConfig = Record<string, unknown> & {
  agent?: Record<string, unknown>;
};

const DEFAULT_BASE_URL = "https://chatgpt.com/backend-api";
const DEFAULT_CONTEXT_TOKENS = 272000;

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
}

function resolveWebPath(urlPath: string): string {
  const normalized = urlPath === "/" ? "/index.html" : urlPath;
  const candidate = path.normalize(path.join(WEB_ROOT, normalized));
  if (!candidate.startsWith(WEB_ROOT)) {
    return path.join(WEB_ROOT, "index.html");
  }
  return candidate;
}

function serveStaticFile(filePath: string, res: http.ServerResponse): void {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentTypeFor(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function readConfigDocument(): { configPath: string; document: MutableConfig } {
  const configPath = ensureClawneoConfigFile(process.env);
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return { configPath, document: {} };
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`ClawNeo config at ${configPath} must be a JSON object.`);
  }

  return {
    configPath,
    document: parsed as MutableConfig,
  };
}

function writeConfigDocument(configPath: string, document: MutableConfig): void {
  fs.writeFileSync(configPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
}

function ensureObjectSection(
  document: MutableConfig,
  key: "agent",
): Record<string, unknown> {
  const current = document[key];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    document[key] = {};
  }
  return document[key] as Record<string, unknown>;
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function resolveString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function resolveModelId(rawModel: string): { provider: string; modelId: string } {
  const trimmed = rawModel.trim();
  if (!trimmed) {
    return { provider: "openai", modelId: "gpt-5.4" };
  }
  const separatorIndex = trimmed.indexOf("/");
  if (separatorIndex <= 0) {
    return { provider: "openai", modelId: trimmed };
  }
  return {
    provider:
      trimmed.slice(0, separatorIndex).trim() === "openai-codex"
        ? "openai"
        : trimmed.slice(0, separatorIndex).trim() || "openai",
    modelId: trimmed.slice(separatorIndex + 1).trim() || "gpt-5.4",
  };
}

function createCodexModel(rawModel: string, baseUrl: string): Model<Api> {
  const { provider, modelId } = resolveModelId(rawModel);
  if (provider !== "openai") {
    throw new Error(`Unsupported provider "${provider}". API Key test currently only supports openai.`);
  }

  return {
    id: modelId,
    name: modelId,
    api: "openai-responses",
    provider,
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_TOKENS,
    maxTokens: DEFAULT_CONTEXT_TOKENS,
  };
}

async function handleOpenAiConfigUpdate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    sendJson(res, 415, { error: "content-type must be application/json" });
    return;
  }

  let payload: {
    apiKey?: unknown;
    clearApiKey?: unknown;
    baseUrl?: unknown;
    prompt?: unknown;
  };
  try {
    payload = JSON.parse(await readRequestBody(req)) as {
      apiKey?: unknown;
      clearApiKey?: unknown;
      baseUrl?: unknown;
      prompt?: unknown;
    };
  } catch {
    sendJson(res, 400, { error: "invalid json body" });
    return;
  }

  const { configPath, document } = readConfigDocument();
  const agent = ensureObjectSection(document, "agent");
  const currentConfig = collectStatusSnapshot();

  const clearApiKey = payload.clearApiKey === true;
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
  const rawBaseUrl = typeof payload.baseUrl === "string" ? payload.baseUrl.trim() : "";

  if (clearApiKey) {
    delete agent.apiKey;
  } else if (apiKey) {
    agent.apiKey = apiKey;
  }

  if (rawBaseUrl && rawBaseUrl !== "https://chatgpt.com/backend-api") {
    agent.baseUrl = rawBaseUrl;
  } else {
    delete agent.baseUrl;
  }

  writeConfigDocument(configPath, document);

  const serviceWasRunning = isServiceRunning();
  if (serviceWasRunning) {
    restartService();
  }

  sendJson(res, 200, {
    ok: true,
    restarted: serviceWasRunning,
    message: serviceWasRunning ? "配置已保存，服务已自动重启。" : "配置已保存。",
    snapshot: collectStatusSnapshot(),
    previousBaseUrl: currentConfig.model.baseUrl,
  });
}

async function handleOpenAiConnectivityTest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    sendJson(res, 415, { error: "content-type must be application/json" });
    return;
  }

  let payload: {
    apiKey?: unknown;
    clearApiKey?: unknown;
    baseUrl?: unknown;
    prompt?: unknown;
  };
  try {
    payload = JSON.parse(await readRequestBody(req)) as {
      apiKey?: unknown;
      clearApiKey?: unknown;
      baseUrl?: unknown;
      prompt?: unknown;
    };
  } catch {
    sendJson(res, 400, { error: "invalid json body" });
    return;
  }

  const { document } = readConfigDocument();
  const agent = ensureObjectSection(document, "agent");
  const clearApiKey = payload.clearApiKey === true;
  const inputApiKey = resolveString(payload.apiKey);
  const savedApiKey = resolveString(agent.apiKey);
  const apiKey = clearApiKey ? inputApiKey : inputApiKey || savedApiKey;
  const baseUrl = resolveString(payload.baseUrl, resolveString(agent.baseUrl, DEFAULT_BASE_URL));
  const modelName = resolveString(agent.model, "gpt-5-codex");
  const prompt = resolveString(payload.prompt, "Reply with exactly OK.");

  if (!apiKey) {
    sendJson(res, 400, { error: "没有可用的 API Key。请先输入 API Key，或先保存一个可用的 API Key。" });
    return;
  }

  const model = createCodexModel(modelName, baseUrl);
  const signal = AbortSignal.timeout(15000);

  try {
    const response = await completeSimple(
      model,
      {
        messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      },
      {
        apiKey,
        transport: "auto",
        signal,
      },
    );

    const text = response.content
      .filter((item) => item.type === "text")
      .map((item) => item.text.trim())
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!text) {
      sendJson(res, 200, {
        ok: false,
        message: "连通性测试失败。",
        error: "接口已连通，但没有返回文本内容。当前 Base URL 可能不兼容 openai-codex-responses。",
        responseText: "(empty response)",
        model: modelName,
        baseUrl,
        prompt,
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      message: "连通性测试成功。",
      responseText: text,
      model: modelName,
      baseUrl,
      prompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 200, {
      ok: false,
      message: "连通性测试失败。",
      error: message,
      model: modelName,
      baseUrl,
      prompt,
    });
  }
}

function tryOpenBrowser(url: string): void {
  if (process.env.CLAWNEO_UI_NO_OPEN === "1") {
    return;
  }

  let command: string | null = null;
  let args: string[] = [];

  if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else if (process.platform === "linux") {
    command = "xdg-open";
    args = [url];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  }

  if (!command) {
    return;
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // Best-effort only. The URL is still printed to the terminal.
  }
}

export async function runUiServer(port = 3210): Promise<void> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/api/status") {
      const snapshot = collectStatusSnapshot();
      sendJson(res, 200, snapshot);
      return;
    }

    if (url.pathname === "/api/openai-config" && req.method === "POST") {
      void handleOpenAiConfigUpdate(req, res).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, { error: message });
      });
      return;
    }

    if (url.pathname === "/api/openai-config/test" && req.method === "POST") {
      void handleOpenAiConnectivityTest(req, res).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, { error: message });
      });
      return;
    }

    serveStaticFile(resolveWebPath(url.pathname), res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const url = `http://127.0.0.1:${port}`;
  console.log(chalk.green(`ClawNeo UI listening on ${url}`));
  tryOpenBrowser(url);

  await new Promise<void>((resolve) => {
    const close = () => {
      server.close(() => resolve());
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });
}
