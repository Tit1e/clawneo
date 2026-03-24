import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { collectStatusSnapshot } from "../cli/status.js";
import { ensureClawneoConfigFile } from "../config/paths.js";
import { isServiceRunning, restartService } from "../cli/service-manager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "web");

type MutableConfig = Record<string, unknown> & {
  agent?: Record<string, unknown>;
};

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
  };
  try {
    payload = JSON.parse(await readRequestBody(req)) as {
      apiKey?: unknown;
      clearApiKey?: unknown;
      baseUrl?: unknown;
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
