import fs from "node:fs";
import process from "node:process";
import chalk from "chalk";
import { confirm, input, password, select } from "@inquirer/prompts";
import { resolveOpenAICodexCredential } from "../auth/openai-codex-oauth.js";
import { ensureAuthStore, resolveDefaultOpenAICodexProfile } from "../auth/store.js";
import { loadConfig } from "../config/load-config.js";
import { ensureMiniclawConfigFile } from "../config/paths.js";

type ConfigObject = Record<string, unknown>;

type MutableConfig = ConfigObject & {
  discord?: ConfigObject;
  agent?: ConfigObject;
  runtime?: ConfigObject;
};

function assertInteractiveTerminal(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("The config command requires an interactive terminal.");
  }
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readConfigDocument(configPath: string): MutableConfig {
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`MiniClaw config at ${configPath} must be a JSON object.`);
  }
  return parsed as MutableConfig;
}

function writeConfigDocument(configPath: string, config: MutableConfig): void {
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function ensureSection(config: MutableConfig, key: "discord" | "agent" | "runtime"): ConfigObject {
  const current = config[key];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    config[key] = {};
  }
  return config[key] as ConfigObject;
}

function trimString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function maskToken(token: string | null): string {
  if (!token) {
    return "missing";
  }
  if (token.length <= 8) {
    return `${token.slice(0, 2)}***`;
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function printHeader(title: string, configPath: string): void {
  console.log("");
  console.log(chalk.bold.cyan(title));
  console.log(chalk.dim(configPath));
  console.log("");
}

function printMainSummary(configPath: string): void {
  const config = loadConfig();
  console.log(chalk.bold("Current configuration"));
  console.log(`${chalk.dim("-")} OpenAI model: ${config.agent.model}`);
  console.log(`${chalk.dim("-")} Tool cwd: ${config.agent.toolCwd}`);
  console.log(`${chalk.dim("-")} Discord token: ${maskToken(config.discord.token || null)}`);
  console.log(`${chalk.dim("-")} Allowed users: ${config.discord.allowedUserIds.length || "all"}`);
  console.log(`${chalk.dim("-")} Allowed guilds: ${config.discord.allowedGuildIds.length || "all"}`);
  console.log(`${chalk.dim("-")} Config file: ${configPath}`);
  console.log("");
}

async function promptStringField(
  label: string,
  currentValue: string | null,
  options?: { allowClear?: boolean; help?: string; secret?: boolean },
): Promise<{ changed: boolean; value?: string }> {
  console.log("");
  console.log(chalk.bold(label));
  console.log(`Current: ${currentValue ?? chalk.dim("not set")}`);
  if (options?.help) {
    console.log(chalk.dim(options.help));
  }

  const prompt = options?.secret ? password : input;
  const value = (await prompt({
    message: `${label}${options?.allowClear ? " (Enter keeps current, * clears)" : " (Enter keeps current)"}`,
  })).trim();

  if (!value) {
    return { changed: false };
  }
  if (value === "*" && options?.allowClear) {
    return { changed: true, value: "" };
  }
  return { changed: true, value };
}

async function promptListField(
  label: string,
  currentValues: string[],
): Promise<{ changed: boolean; value?: string[] }> {
  console.log("");
  console.log(chalk.bold(label));
  console.log(
    `Current: ${
      currentValues.length > 0 ? currentValues.join(", ") : chalk.dim("all allowed")
    }`,
  );
  console.log(chalk.dim("Enter comma-separated IDs. Enter * to allow all. Enter keeps current."));

  const raw = (await input({ message: label })).trim();
  if (!raw) {
    return { changed: false };
  }
  if (raw === "*") {
    return { changed: true, value: [] };
  }
  const next = Array.from(
    new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
  return { changed: true, value: next };
}

function setStringField(
  config: MutableConfig,
  sectionKey: "discord" | "agent",
  field: string,
  value: string,
): void {
  const section = ensureSection(config, sectionKey);
  if (!value) {
    delete section[field];
    return;
  }
  section[field] = value;
}

function setListField(
  config: MutableConfig,
  sectionKey: "discord",
  field: string,
  value: string[],
): void {
  const section = ensureSection(config, sectionKey);
  section[field] = value;
}

function isCredentialExpired(credential: { type: "oauth"; expires: number } | { type: "token"; expires?: number }): boolean | null {
  if (credential.type === "oauth") {
    return Date.now() >= credential.expires;
  }
  if (!credential.expires) {
    return null;
  }
  return Date.now() >= credential.expires;
}

function classifyOpenAiAuthReason(
  profile: ReturnType<typeof resolveDefaultOpenAICodexProfile>,
  error: unknown,
): string {
  if (!profile) {
    return "未找到授权信息";
  }

  const expired = isCredentialExpired(profile.credential);
  if (expired === true) {
    return "授权已失效";
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("expired") || normalized.includes("re-authenticate")) {
    return "授权已失效";
  }

  if (
    normalized.includes("invalid")
    || normalized.includes("missing")
    || normalized.includes("parse")
    || normalized.includes("malformed")
    || normalized.includes("credential")
  ) {
    return "授权信息无效";
  }

  return "授权信息读取失败";
}

async function runOpenAiAuthCheck(): Promise<void> {
  const config = loadConfig();

  console.log("");
  console.log(chalk.bold("OpenAI 登录状态"));
  console.log("");

  const initialStore = ensureAuthStore(config.runtime.authStorePath);
  const initialProfile = resolveDefaultOpenAICodexProfile(initialStore);

  try {
    await resolveOpenAICodexCredential(config);
    console.log(`${chalk.dim("-")} 已授权：${chalk.green("是")}`);
  } catch (error) {
    console.log(`${chalk.dim("-")} 已授权：${chalk.red("否")}`);
    console.log(
      `${chalk.dim("-")} 原因：${chalk.yellow(classifyOpenAiAuthReason(initialProfile, error))}`,
    );
  }

  console.log("");
  await input({ message: "按回车继续" });
}

async function runOpenAiMenu(draft: MutableConfig): Promise<void> {
  while (true) {
    const agentSection = ensureSection(draft, "agent");
    const choice = await select({
      message: "OpenAI 设置",
      choices: [
        { name: `模型（${trimString(agentSection.model) ?? "gpt-5-codex"}）`, value: "model" },
        {
          name: `工具工作目录（${trimString(agentSection.toolCwd) ?? "默认"}）`,
          value: "toolCwd",
        },
        {
          name: `工作区根目录（${trimString(agentSection.workspaceRoot) ?? "默认"}）`,
          value: "workspaceRoot",
        },
        {
          name: `用户配置文件路径（${trimString(agentSection.userProfilePath) ?? "默认"}）`,
          value: "userProfilePath",
        },
        { name: "验证登录状态", value: "validateLogin" },
        { name: "返回上一级", value: "back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "validateLogin") {
      await runOpenAiAuthCheck();
      continue;
    }

    if (choice === "model") {
      const result = await promptStringField("OpenAI 模型", trimString(agentSection.model));
      if (result.changed && result.value !== undefined) {
        setStringField(draft, "agent", "model", result.value);
      }
      continue;
    }

    if (choice === "toolCwd") {
      const result = await promptStringField(
        "工具工作目录",
        trimString(agentSection.toolCwd),
        { allowClear: true, help: "输入 * 可清除覆盖设置并恢复默认值。" },
      );
      if (result.changed && result.value !== undefined) {
        setStringField(draft, "agent", "toolCwd", result.value);
      }
      continue;
    }

    if (choice === "workspaceRoot") {
      const result = await promptStringField(
        "工作区根目录",
        trimString(agentSection.workspaceRoot),
        { allowClear: true, help: "输入 * 可清除覆盖设置并恢复默认值。" },
      );
      if (result.changed && result.value !== undefined) {
        setStringField(draft, "agent", "workspaceRoot", result.value);
      }
      continue;
    }

    const result = await promptStringField(
      "用户配置文件路径",
      trimString(agentSection.userProfilePath),
      { allowClear: true, help: "输入 * 可清除覆盖设置并恢复默认值。" },
    );
    if (result.changed && result.value !== undefined) {
      setStringField(draft, "agent", "userProfilePath", result.value);
    }
  }
}

async function runDiscordMenu(draft: MutableConfig): Promise<void> {
  while (true) {
    const discordSection = ensureSection(draft, "discord");
    const choice = await select({
      message: "Discord 设置",
      choices: [
        { name: `Bot Token（${maskToken(trimString(discordSection.token))}）`, value: "token" },
        {
          name: `允许的用户 ID（${readStringArray(discordSection.allowedUserIds).length || "全部"}）`,
          value: "allowedUserIds",
        },
        {
          name: `允许的服务器 ID（${readStringArray(discordSection.allowedGuildIds).length || "全部"}）`,
          value: "allowedGuildIds",
        },
        { name: "返回上一级", value: "back" },
      ],
    });

    if (choice === "back") {
      return;
    }

    if (choice === "token") {
      const result = await promptStringField(
        "Discord Bot Token",
        maskToken(trimString(discordSection.token)),
        {
          allowClear: true,
          help: "输入 * 可清空 Token，直接回车则保持当前值。",
          secret: true,
        },
      );
      if (result.changed && result.value !== undefined) {
        setStringField(draft, "discord", "token", result.value);
      }
      continue;
    }

    if (choice === "allowedUserIds") {
      const result = await promptListField(
        "允许的用户 ID",
        readStringArray(discordSection.allowedUserIds),
      );
      if (result.changed && result.value !== undefined) {
        setListField(draft, "discord", "allowedUserIds", result.value);
      }
      continue;
    }

    const result = await promptListField(
      "允许的服务器 ID",
      readStringArray(discordSection.allowedGuildIds),
    );
    if (result.changed && result.value !== undefined) {
      setListField(draft, "discord", "allowedGuildIds", result.value);
    }
  }
}

function printDraftPreview(draft: MutableConfig): void {
  console.log("");
  console.log(chalk.bold("当前配置草稿"));
  console.log(JSON.stringify(draft, null, 2));
  console.log("");
}

export async function runConfigCommand(): Promise<void> {
  assertInteractiveTerminal();
  const configPath = ensureMiniclawConfigFile(process.env);
  const original = readConfigDocument(configPath);
  const draft = cloneConfig(original);

  while (true) {
    printHeader("MiniClaw 配置", configPath);
    printMainSummary(configPath);
    const choice = await select({
      message: "主菜单",
      choices: [
        { name: "OpenAI 设置", value: "openai" },
        { name: "Discord 设置", value: "discord" },
        { name: "查看当前配置", value: "view" },
        { name: "保存并退出", value: "save" },
        { name: "直接退出", value: "exit" },
      ],
    });

    if (choice === "openai") {
      await runOpenAiMenu(draft);
      continue;
    }

    if (choice === "discord") {
      await runDiscordMenu(draft);
      continue;
    }

    if (choice === "view") {
      printDraftPreview(draft);
      continue;
    }

    if (choice === "save") {
      writeConfigDocument(configPath, draft);
      console.log(chalk.green(`Saved MiniClaw config to ${configPath}.`));
      return;
    }

    const hasChanges = JSON.stringify(draft) !== JSON.stringify(original);
    if (!hasChanges) {
      return;
    }

    const shouldSave = await confirm({
      message: "当前有未保存的更改，退出前是否保存？",
      default: true,
    });
    if (shouldSave) {
      writeConfigDocument(configPath, draft);
      console.log(chalk.green(`Saved MiniClaw config to ${configPath}.`));
    } else {
      console.log(chalk.yellow("已放弃未保存的更改。"));
    }
    return;
  }
}
