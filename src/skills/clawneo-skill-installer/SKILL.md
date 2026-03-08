---
name: clawneo-skill-installer
description: Use when the user asks ClawNeo to install or add a skill. Default installs go to ~/.clawneo/skills. Only install to ~/.agents/skills when the user explicitly requests a global install.
---

# ClawNeo Skill Installer

当用户要求安装 skill 时，使用内置工具 `install_skill`，不要直接用 `bash` 手工下载和复制 skill。

## 规则

- 默认安装到 `~/.clawneo/skills`
- 只有当用户明确要求“全局安装”、“安装到 ~/.agents/skills”或“给所有 agent 使用”时，才允许安装到 `~/.agents/skills`
- 如果来源包含多个 skill，而用户没有明确指定 skill 名称，先要求澄清，或在工具参数里提供 `skillName`
- 除非用户明确要求覆盖，否则不要覆盖已存在的 skill

## 使用方式

- 本地安装默认使用：
  - `target: "local"`
- 全局安装只在用户明确要求时使用：
  - `target: "global"`

## 示例

- “帮我安装这个 skill”
  - 使用 `install_skill`，`target: "local"`
- “把这个 skill 全局安装到 ~/.agents/skills”
  - 使用 `install_skill`，`target: "global"`
