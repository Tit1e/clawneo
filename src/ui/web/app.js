function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "-";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function badgeState(element, value, trueLabel = "是", falseLabel = "否") {
  element.classList.remove("ok", "bad", "neutral");
  if (value === null || value === undefined) {
    element.classList.add("neutral");
    element.textContent = "-";
    return;
  }
  if (value) {
    element.classList.add("ok");
    element.textContent = trueLabel;
    return;
  }
  element.classList.add("bad");
  element.textContent = falseLabel;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  element.textContent = value ?? "-";
}

function renderLogs(lines) {
  const logs = document.getElementById("logs");
  if (!logs) {
    return;
  }
  logs.innerHTML = "";
  const items = Array.isArray(lines) && lines.length > 0 ? lines : ["（暂无日志）"];
  for (const line of items) {
    const div = document.createElement("div");
    div.className = `log-line${line === "（暂无日志）" ? " muted" : ""}`;
    div.textContent = line;
    logs.appendChild(div);
  }
}

function render(snapshot) {
  badgeState(document.getElementById("process-running"), snapshot.process.running);
  setText("process-pid", snapshot.process.pid == null ? "-" : String(snapshot.process.pid));
  setText("process-uptime", snapshot.process.uptimeMs == null ? "-" : formatDuration(snapshot.process.uptimeMs));

  badgeState(
    document.getElementById("discord-token"),
    snapshot.discord.tokenConfigured,
    "已配置",
    "缺失",
  );
  setText("discord-users", String(snapshot.discord.allowedUsers));
  setText("discord-guilds", String(snapshot.discord.allowedGuilds));

  setText("runtime-pid-file", snapshot.runtime.pidFile);
  setText("runtime-log-file", snapshot.runtime.logFile);
  setText("runtime-db-path", snapshot.runtime.dbPath);
  setText("runtime-transcripts", snapshot.runtime.transcriptDir);

  setText("model-name", snapshot.model.model);
  setText("model-default-profile", snapshot.model.defaultProfileId ?? "-");
  badgeState(document.getElementById("model-auth-usable"), snapshot.model.authUsable);
  badgeState(document.getElementById("model-token-expired"), snapshot.model.tokenExpired);
  setText("model-profiles", String(snapshot.model.oauthProfileCount));
  setText("model-auth-store", snapshot.model.authStore);

  renderLogs(snapshot.logs);
  setText("updated-at", `更新时间：${new Date().toLocaleString()}`);
}

async function refresh() {
  const response = await fetch("/api/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const snapshot = await response.json();
  render(snapshot);
}

async function tick() {
  try {
    await refresh();
  } catch (error) {
    console.error("Failed to refresh MiniClaw UI", error);
    setText("updated-at", "更新时间：刷新失败");
  }
}

await tick();
setInterval(() => {
  void tick();
}, 5000);
