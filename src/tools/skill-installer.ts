import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { resolveClawneoSkillsDir, resolveGlobalAgentsSkillsDir } from "../config/paths.js";

const execFileAsync = promisify(execFile);

type SkillInstallTarget = "local" | "global";

type CreateInstallSkillToolParams = {
  latestUserPrompt: string;
};

type SkillCandidate = {
  dirPath: string;
  dirName: string;
  declaredName: string | null;
};

type InstallSkillParams = {
  source: string;
  skillName?: string;
  target?: SkillInstallTarget;
  overwrite?: boolean;
};

function normalizeSource(source: string): string {
  return source.trim();
}

function isGitLikeSource(source: string): boolean {
  return (
    source.startsWith("http://")
    || source.startsWith("https://")
    || source.startsWith("git@")
    || /^[^/\s]+\/[^/\s]+$/.test(source)
  );
}

function toGitCloneUrl(source: string): string {
  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("git@")) {
    return source;
  }
  return `https://github.com/${source.replace(/\.git$/, "")}.git`;
}

async function cloneRepository(source: string, signal?: AbortSignal): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawneo-skill-"));
  await execFileAsync(
    "git",
    ["clone", "--depth", "1", toGitCloneUrl(source), tempDir],
    {
      signal,
    },
  );
  return tempDir;
}

function resolveExistingPath(source: string): string | null {
  const expanded = source.startsWith("~")
    ? path.join(os.homedir(), source.slice(1))
    : source;
  const absolute = path.resolve(expanded);
  return fs.existsSync(absolute) ? absolute : null;
}

function resolveRepoNameFromSource(source: string): string | null {
  const trimmed = source.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }

  const scpLikeMatch = trimmed.match(/^[^@]+@[^:]+:(.+)$/);
  const normalized = scpLikeMatch ? scpLikeMatch[1]! : trimmed;
  const withoutGit = normalized.replace(/\.git$/i, "");
  const segments = withoutGit.split("/").filter(Boolean);
  const lastSegment = segments.at(-1)?.trim();
  return lastSegment || null;
}

function resolveLocalSourceName(sourcePath: string): string {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    return path.basename(sourcePath);
  }

  if (sourcePath.endsWith("SKILL.md")) {
    return path.basename(path.dirname(sourcePath));
  }

  return path.basename(path.dirname(sourcePath));
}

function readDeclaredSkillName(skillDir: string): string | null {
  const skillFilePath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFilePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(skillFilePath, "utf8");
    const match = raw.match(/^---[\s\S]*?\nname:\s*["']?([^\n"']+)["']?/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

function discoverSkillCandidates(rootPath: string): SkillCandidate[] {
  const resolvedRoot = fs.statSync(rootPath).isDirectory() ? rootPath : path.dirname(rootPath);
  const candidates: SkillCandidate[] = [];

  const ownSkillFile = fs.statSync(rootPath).isDirectory()
    ? path.join(rootPath, "SKILL.md")
    : rootPath.endsWith("SKILL.md")
      ? rootPath
      : null;

  if (ownSkillFile && fs.existsSync(ownSkillFile)) {
    const dirPath = path.dirname(ownSkillFile);
    candidates.push({
      dirPath,
      dirName: path.basename(dirPath),
      declaredName: readDeclaredSkillName(dirPath),
    });
  }

  for (const entry of fs.readdirSync(resolvedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidateDir = path.join(resolvedRoot, entry.name);
    if (!fs.existsSync(path.join(candidateDir, "SKILL.md"))) {
      continue;
    }
    candidates.push({
      dirPath: candidateDir,
      dirName: entry.name,
      declaredName: readDeclaredSkillName(candidateDir),
    });
  }

  return candidates.filter(
    (candidate, index, all) =>
      all.findIndex((entry) => entry.dirPath === candidate.dirPath) === index,
  );
}

function pickSkillCandidate(candidates: SkillCandidate[], skillName?: string): SkillCandidate {
  if (candidates.length === 0) {
    throw new Error("No SKILL.md was found in the provided source.");
  }

  if (!skillName?.trim()) {
    if (candidates.length === 1) {
      return candidates[0]!;
    }
    throw new Error(
      `Multiple skills were found (${candidates.map((candidate) => candidate.dirName).join(", ")}). Provide skillName explicitly.`,
    );
  }

  const normalized = skillName.trim().toLowerCase();
  const matched = candidates.find(
    (candidate) =>
      candidate.dirName.toLowerCase() === normalized
      || candidate.declaredName?.toLowerCase() === normalized,
  );

  if (!matched) {
    throw new Error(`Skill "${skillName}" was not found in the provided source.`);
  }

  return matched;
}

function resolveInstallDir(target: SkillInstallTarget): string {
  if (target === "global") {
    return resolveGlobalAgentsSkillsDir();
  }
  return resolveClawneoSkillsDir();
}

function resolveInstalledSkillDirName(params: {
  source: string;
  sourceSkillDir: string;
  workingRoot: string;
  declaredName: string | null;
}): string {
  const declaredName = params.declaredName?.trim();
  if (declaredName) {
    return declaredName;
  }

  if (params.sourceSkillDir === params.workingRoot) {
    const existingPath = resolveExistingPath(params.source);
    if (existingPath) {
      return resolveLocalSourceName(existingPath);
    }

    const repoName = resolveRepoNameFromSource(params.source);
    if (repoName) {
      return repoName;
    }
  }

  return path.basename(params.sourceSkillDir);
}

function userExplicitlyRequestedGlobalInstall(userPrompt: string): boolean {
  const normalized = userPrompt.toLowerCase();
  return (
    normalized.includes("全局")
    || normalized.includes("global")
    || normalized.includes("all agents")
    || normalized.includes("~/.agents/skills")
    || normalized.includes(".agents/skills")
    || normalized.includes("共享")
  );
}

function installSkillDirectory(params: {
  sourceSkillDir: string;
  installDir: string;
  installedDirName: string;
  overwrite: boolean;
}): string {
  fs.mkdirSync(params.installDir, { recursive: true });
  const targetDir = path.join(params.installDir, params.installedDirName);

  if (fs.existsSync(targetDir)) {
    if (!params.overwrite) {
      throw new Error(`Target skill directory already exists: ${targetDir}. Set overwrite=true to replace it.`);
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  fs.cpSync(params.sourceSkillDir, targetDir, { recursive: true });
  return targetDir;
}

export function createInstallSkillTool(
  params: CreateInstallSkillToolParams,
): ToolDefinition {
  return {
    name: "install_skill",
    label: "Install Skill",
    description:
      "Install a skill into ClawNeo. Defaults to ~/.clawneo/skills. Use target=global only if the user explicitly requested global installation.",
    parameters: Type.Object({
      source: Type.String({
        description: "Local path, GitHub repo shorthand (owner/repo), or git URL containing the skill.",
      }),
      skillName: Type.Optional(
        Type.String({
          description: "Skill name or directory name to install when the source contains multiple skills.",
        }),
      ),
      target: Type.Optional(
        Type.Union([Type.Literal("local"), Type.Literal("global")], {
          description: "Installation target. Defaults to local.",
        }),
      ),
      overwrite: Type.Optional(
        Type.Boolean({
          description: "Whether to replace an existing installed skill with the same directory name.",
        }),
      ),
    }),
    execute: async (_toolCallId, rawParams, signal) => {
      const toolParams = rawParams as InstallSkillParams;
      const source = normalizeSource(toolParams.source);
      const target = (toolParams.target || "local") as SkillInstallTarget;
      const overwrite = Boolean(toolParams.overwrite);

      if (target === "global" && !userExplicitlyRequestedGlobalInstall(params.latestUserPrompt)) {
        throw new Error(
          "Global installation was requested without explicit user authorization. Ask the user to clearly say they want a global install or ~/.agents/skills.",
        );
      }

      let workingRoot: string | null = null;
      let cleanupRoot: string | null = null;

      try {
        const existingPath = resolveExistingPath(source);
        if (existingPath) {
          workingRoot = existingPath;
        } else if (isGitLikeSource(source)) {
          workingRoot = await cloneRepository(source, signal);
          cleanupRoot = workingRoot;
        } else {
          throw new Error(`Source not found: ${source}`);
        }

        const candidates = discoverSkillCandidates(workingRoot);
        const selected = pickSkillCandidate(candidates, toolParams.skillName);
        const installDir = resolveInstallDir(target);
        const installedDirName = resolveInstalledSkillDirName({
          source,
          sourceSkillDir: selected.dirPath,
          workingRoot,
          declaredName: selected.declaredName,
        });
        const installedPath = installSkillDirectory({
          sourceSkillDir: selected.dirPath,
          installDir,
          installedDirName,
          overwrite,
        });

        return {
          content: [
            {
              type: "text",
              text: [
                `Installed skill: ${selected.declaredName || selected.dirName}`,
                `Target: ${target}`,
                `Installed path: ${installedPath}`,
              ].join("\n"),
            },
          ],
          details: {
            target,
            installedPath,
            installedSkill: selected.declaredName || selected.dirName,
          },
        };
      } finally {
        if (cleanupRoot) {
          fs.rmSync(cleanupRoot, { recursive: true, force: true });
        }
      }
    },
  };
}
