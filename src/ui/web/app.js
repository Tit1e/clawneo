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

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAccessMode(mode) {
  switch (mode) {
    case "unrestricted":
      return "不限制";
    case "users_only":
      return "仅限制用户";
    case "guilds_only":
      return "仅限制服务器";
    case "users_and_guilds":
      return "限制用户和服务器";
    default:
      return "-";
  }
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

function renderSkillsDirStats(items) {
  const container = document.getElementById("skills-dir-stats");
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const stats = Array.isArray(items) && items.length > 0 ? items : [];
  if (stats.length === 0) {
    const div = document.createElement("div");
    div.className = "log-line muted";
    div.textContent = "（暂无技能目录信息）";
    container.appendChild(div);
    return;
  }
  for (const item of stats) {
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = `${item.path}  ·  ${item.skillsCount} 个技能`;
    container.appendChild(div);
  }
}

function render(snapshot) {
  setText("app-version", snapshot.app.version);
  setText("app-node-version", snapshot.app.nodeVersion);
  setText("app-platform", snapshot.app.platform);

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
  setText("discord-access-mode", formatAccessMode(snapshot.discord.accessMode));

  setText("runtime-pid-file", snapshot.runtime.pidFile);
  setText("runtime-log-file", snapshot.runtime.logFile);
  setText("runtime-state-dir", snapshot.runtime.stateDir);
  setText("runtime-config-path", snapshot.runtime.configPath);
  setText("runtime-db-path", snapshot.runtime.dbPath);
  setText("runtime-transcripts", snapshot.runtime.transcriptDir);
  setText("runtime-db-size", formatBytes(snapshot.runtime.dbSizeBytes));
  setText("runtime-log-size", formatBytes(snapshot.runtime.logSizeBytes));
  setText("runtime-transcript-files", String(snapshot.runtime.transcriptFileCount));
  setText("runtime-skills-count", String(snapshot.runtime.skillsCount));
  renderSkillsDirStats(snapshot.runtime.skillsDirStats);

  setText("model-name", snapshot.model.model);
  setText("model-default-profile", snapshot.model.defaultProfileId ?? "-");
  badgeState(document.getElementById("model-auth-usable"), snapshot.model.authUsable);
  badgeState(document.getElementById("model-token-expired"), snapshot.model.tokenExpired);
  setText("model-credential-type", snapshot.model.credentialType ?? "-");
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
    console.error("Failed to refresh ClawNeo UI", error);
    setText("updated-at", "更新时间：刷新失败");
  }
}

await tick();
setInterval(() => {
  void tick();
}, 5000);
