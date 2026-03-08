import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { collectStatusSnapshot } from "../cli/status.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(__dirname, "web");

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
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(snapshot, null, 2));
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
