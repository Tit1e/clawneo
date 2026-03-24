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

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  if (document.activeElement === element) {
    return;
  }
  element.value = value ?? "";
}

function setStatusMessage(message, isError = false) {
  const element = document.getElementById("openai-config-status");
  if (!element) {
    return;
  }
  element.textContent = message;
  element.style.color = isError ? "var(--bad)" : "var(--muted)";
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
    const wrapper = document.createElement("div");
    wrapper.className = "log-line";

    const pathLine = document.createElement("div");
    pathLine.textContent = `${item.path}  ·  ${item.skillsCount} 个技能`;
    wrapper.appendChild(pathLine);

    const namesLine = document.createElement("div");
    namesLine.className = "muted";
    namesLine.textContent = Array.isArray(item.skillNames) && item.skillNames.length > 0
      ? item.skillNames.join(", ")
      : "（无技能）";
    wrapper.appendChild(namesLine);

    container.appendChild(wrapper);
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
  setText("model-base-url", snapshot.model.baseUrl);
  setText("model-auth-source", snapshot.model.authSourceLabel);
  setText("model-auth-summary", snapshot.model.authSummary);
  setText("model-default-profile", snapshot.model.defaultProfileId ?? "-");
  badgeState(document.getElementById("model-auth-usable"), snapshot.model.authUsable);
  badgeState(document.getElementById("model-token-expired"), snapshot.model.tokenExpired);
  setText("model-credential-type", snapshot.model.credentialType ?? "-");
  setText("model-profiles", String(snapshot.model.oauthProfileCount));
  setText("model-auth-store", snapshot.model.authStore);
  setInputValue("openai-base-url-input", snapshot.model.baseUrl);

  renderLogs(snapshot.logs);
  setText("updated-at", `更新时间：${new Date().toLocaleString()}`);
}

async function saveOpenAiConfig(event) {
  event.preventDefault();

  const saveButton = document.getElementById("openai-config-save");
  const apiKeyInput = document.getElementById("openai-api-key-input");
  const baseUrlInput = document.getElementById("openai-base-url-input");
  const clearApiKeyInput = document.getElementById("openai-clear-api-key-input");

  if (!saveButton || !apiKeyInput || !baseUrlInput || !clearApiKeyInput) {
    return;
  }

  saveButton.disabled = true;
  setStatusMessage("正在保存...");

  try {
    const response = await fetch("/api/openai-config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        apiKey: apiKeyInput.value,
        baseUrl: baseUrlInput.value,
        clearApiKey: clearApiKeyInput.checked,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    apiKeyInput.value = "";
    clearApiKeyInput.checked = false;
    setStatusMessage(payload.message || "配置已保存。");
    if (payload.snapshot) {
      render(payload.snapshot);
    } else {
      await refresh();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatusMessage(`保存失败：${message}`, true);
  } finally {
    saveButton.disabled = false;
  }
}

async function testOpenAiConfig() {
  const saveButton = document.getElementById("openai-config-save");
  const testButton = document.getElementById("openai-config-test");
  const apiKeyInput = document.getElementById("openai-api-key-input");
  const baseUrlInput = document.getElementById("openai-base-url-input");
  const clearApiKeyInput = document.getElementById("openai-clear-api-key-input");
  const promptInput = document.getElementById("openai-test-prompt-input");

  if (!testButton || !apiKeyInput || !baseUrlInput || !clearApiKeyInput || !promptInput) {
    return;
  }

  testButton.disabled = true;
  if (saveButton) {
    saveButton.disabled = true;
  }
  setStatusMessage("正在测试连通性...");

  try {
    const response = await fetch("/api/openai-config/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        apiKey: apiKeyInput.value,
        baseUrl: baseUrlInput.value,
        clearApiKey: clearApiKeyInput.checked,
        prompt: promptInput.value,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    if (payload.ok) {
      const reply = payload.responseText ? ` 返回：${payload.responseText}` : "";
      setStatusMessage(`${payload.message}${reply}`);
      return;
    }

    setStatusMessage(`${payload.message} ${payload.error || ""}`.trim(), true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatusMessage(`测试失败：${message}`, true);
  } finally {
    testButton.disabled = false;
    if (saveButton) {
      saveButton.disabled = false;
    }
  }
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
const configForm = document.getElementById("openai-config-form");
if (configForm) {
  configForm.addEventListener("submit", (event) => {
    void saveOpenAiConfig(event);
  });
}
const testButton = document.getElementById("openai-config-test");
if (testButton) {
  testButton.addEventListener("click", () => {
    void testOpenAiConfig();
  });
}
setInterval(() => {
  void tick();
}, 5000);
