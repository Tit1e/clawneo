import fs from "node:fs";
import process from "node:process";
import chalk from "chalk";
import { confirm, input } from "@inquirer/prompts";
import { loginWithOpenAICodexOAuth, resolveOpenAICodexCredential } from "../auth/openai-codex-oauth.js";
import { loadConfig } from "../config/load-config.js";

type ConfigObject = Record<string, unknown>;

type MutableConfig = ConfigObject & {
  discord?: ConfigObject;
  agent?: ConfigObject;
  runtime?: ConfigObject;
};

type OnboardingCheck = {
  openAiAuthorized: boolean;
  needsDiscordToken: boolean;
  needsDiscordScope: boolean;
};

function assertInteractiveTerminal(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      [
        "ClawNeo 缺少首次启动所需配置，且当前不是交互终端。",
        "请先在交互终端中运行 `clawneo start` 完成首次引导，或使用 `clawneo config` 手动配置。",
      ].join(" "),
    );
  }
}

function readConfigDocument(configPath: string): MutableConfig {
  const raw = fs.readFileSync(configPath, "utf8").trim();
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`ClawNeo config at ${configPath} must be a JSON object.`);
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

function parseIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

async function collectChecks(): Promise<OnboardingCheck> {
  const config = loadConfig();

  let openAiAuthorized = false;
  try {
    await resolveOpenAICodexCredential(config);
    openAiAuthorized = true;
  } catch {
    openAiAuthorized = false;
  }

  return {
    openAiAuthorized,
    needsDiscordToken: !config.discord.token.trim(),
    needsDiscordScope:
      config.discord.allowedUserIds.length === 0 && config.discord.allowedGuildIds.length === 0,
  };
}

function needsOnboarding(checks: OnboardingCheck): boolean {
  return !checks.openAiAuthorized || checks.needsDiscordToken || checks.needsDiscordScope;
}

async function runOpenAiStep(): Promise<void> {
  const config = loadConfig();
  console.log("");
  console.log(chalk.bold("OpenAI 状态：未授权"));
  console.log(chalk.dim("ClawNeo 需要先完成 OpenAI Codex OAuth 登录。"));
  console.log(chalk.dim("继续后会打开浏览器进行授权。"));
  console.log("");

  const proceed = await confirm({
    message: "现在开始授权？",
    default: true,
  });

  if (!proceed) {
    throw new Error("已取消首次启动引导。");
  }

  console.log("");
  await loginWithOpenAICodexOAuth(config);
  console.log(chalk.green("OpenAI 授权成功。"));
}

async function runDiscordTokenStep(configPath: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("Discord Bot Token：未配置"));
  console.log(chalk.dim("请输入你的 Discord Bot Token。"));
  console.log(chalk.dim("如需取消本次引导，直接按回车。"));
  console.log("");

  const token = (await input({ message: "Discord Bot Token" })).trim();
  if (!token) {
    throw new Error("未填写 Discord Bot Token，已取消首次启动引导。");
  }

  const draft = readConfigDocument(configPath);
  const discord = ensureSection(draft, "discord");
  discord.token = token;
  writeConfigDocument(configPath, draft);

  console.log(chalk.green("Discord Bot Token 已保存。"));
}

async function runDiscordScopeStep(configPath: string): Promise<void> {
  console.log("");
  console.log(chalk.bold("Discord 访问范围：未配置"));
  console.log(chalk.dim("至少需要配置允许的用户 ID 或服务器 ID。"));
  console.log(chalk.dim("多个 ID 请使用英文逗号分隔。"));
  console.log("");

  const userIdsRaw = (await input({
    message: "Allowed User IDs（可留空）",
  })).trim();
  const guildIdsRaw = (await input({
    message: "Allowed Guild IDs（可留空）",
  })).trim();

  const allowedUserIds = parseIds(userIdsRaw);
  const allowedGuildIds = parseIds(guildIdsRaw);

  if (allowedUserIds.length === 0 && allowedGuildIds.length === 0) {
    throw new Error("未配置允许的 Discord 用户或服务器，已取消首次启动引导。");
  }

  const draft = readConfigDocument(configPath);
  const discord = ensureSection(draft, "discord");
  discord.allowedUserIds = allowedUserIds;
  discord.allowedGuildIds = allowedGuildIds;
  writeConfigDocument(configPath, draft);

  console.log(chalk.green("Discord 访问范围已保存。"));
}

function printSummary(): void {
  const config = loadConfig();
  console.log("");
  console.log(chalk.bold.cyan("基础配置完成"));
  console.log(`${chalk.dim("-")} OpenAI 已授权: ${chalk.green("是")}`);
  console.log(`${chalk.dim("-")} Discord Bot Token: ${chalk.green("已配置")}`);
  console.log(
    `${chalk.dim("-")} Allowed User IDs: ${
      config.discord.allowedUserIds.length > 0
        ? chalk.green(String(config.discord.allowedUserIds.length))
        : chalk.dim("0")
    }`,
  );
  console.log(
    `${chalk.dim("-")} Allowed Guild IDs: ${
      config.discord.allowedGuildIds.length > 0
        ? chalk.green(String(config.discord.allowedGuildIds.length))
        : chalk.dim("0")
    }`,
  );
  console.log("");
}

export async function ensureOnboardingBeforeStart(): Promise<void> {
  const initialChecks = await collectChecks();
  if (!needsOnboarding(initialChecks)) {
    return;
  }

  assertInteractiveTerminal();

  console.log("");
  console.log(chalk.bold.cyan("ClawNeo 首次启动引导"));
  console.log(chalk.dim("这一步会帮你完成基础配置："));
  console.log(chalk.dim("1. OpenAI 授权"));
  console.log(chalk.dim("2. Discord 机器人设置"));
  console.log("");

  if (!initialChecks.openAiAuthorized) {
    await runOpenAiStep();
  }

  const afterAuthChecks = await collectChecks();
  if (afterAuthChecks.needsDiscordToken) {
    await runDiscordTokenStep(loadConfig().runtime.configPath);
  }

  const afterTokenChecks = await collectChecks();
  if (afterTokenChecks.needsDiscordScope) {
    await runDiscordScopeStep(loadConfig().runtime.configPath);
  }

  const finalChecks = await collectChecks();
  if (needsOnboarding(finalChecks)) {
    throw new Error("首次启动引导未完成，缺少必要配置。");
  }

  printSummary();
}
