# 配置说明

本页介绍让 ClawNeo 在实际使用中可用所需的最小配置。

## 主配置文件

主要配置文件位于：

```text
~/.clawneo/clawneo.json
```

如果该文件尚不存在，ClawNeo 会自动创建。

## 推荐配置方式

最简单的配置方式是：

```bash
clawneo config
```

交互式配置流程可帮助你管理：

- OpenAI 授权
- Discord Bot Token
- 允许的 Discord 用户 ID
- 允许的 Discord 服务器 ID
- 模型选择
- 工具工作目录

## 最小可用清单

要得到一个可正常连接 Discord 的助手，你至少需要：

1. 一个已授权的 OpenAI Codex 配置
2. 一个 Discord Bot Token
3. 至少一个 Discord 访问范围
   - 允许的用户 ID，或
   - 允许的服务器 ID

## 配置示例

一个最小示例如下：

```json
{
  "discord": {
    "token": "YOUR_DISCORD_BOT_TOKEN",
    "allowedUserIds": ["123456789012345678"],
    "allowedGuildIds": []
  },
  "agent": {
    "model": "gpt-5-codex"
  },
  "runtime": {
    "note": "Primary ClawNeo config file."
  }
}
```

## OpenAI 授权

ClawNeo 使用 OpenAI Codex OAuth。

在 CLI 中运行：

```bash
clawneo config
```

然后选择：

```text
OpenAI Settings -> Authorize OpenAI
```

相关本地文件：

```text
~/.clawneo/auth-profiles.json
```

## Discord 配置

必填字段：

- `discord.token`

可选访问控制：

- `discord.allowedUserIds`
- `discord.allowedGuildIds`

行为说明：

- 如果两个 allowlist 都为空，ClawNeo 会在当前 Bot 范围内视为开放访问
- 如果设置了 allowlist，则仅允许匹配的用户或服务器访问

## Agent 配置

常见字段：

- `agent.model`
- `agent.workspaceRoot`
- `agent.toolCwd`

默认值：

- model：`gpt-5-codex`
- workspace root：`~/.clawneo/workspace`
- tool cwd：当前用户主目录

### `workspaceRoot`

这是 ClawNeo 用于持久化助手文件的托管工作区，其中包括：

```text
~/.clawneo/workspace/USER.md
```

### `toolCwd`

这是 `read`、`ls`、`grep` 和 `bash` 等工具默认使用的工作目录，除非任务明确要求其他路径。

## 运行时路径

默认情况下，ClawNeo 会在 `~/.clawneo` 下派生多个运行时路径：

- `clawneo.json`
- `clawneo.db`
- `auth-profiles.json`
- `transcripts/`
- `workspace/`
- `skills/`

## 环境变量覆盖

ClawNeo 支持通过环境变量覆盖常见路径和运行时行为。

### 状态与配置

- `CLAWNEO_STATE_DIR`
- `CLAWNEO_CONFIG_PATH`
- `CLAWNEO_DB_PATH`
- `CLAWNEO_TRANSCRIPT_DIR`
- `CLAWNEO_AUTH_STORE_PATH`
- `CLAWNEO_WORKSPACE_ROOT`
- `CLAWNEO_TOOL_CWD`

### Agent 与 Shell

- `CLAWNEO_MODEL`
- `CLAWNEO_SHELL`
- `CLAWNEO_UI_NO_OPEN=1`

### Discord

- `DISCORD_TOKEN`
- `DISCORD_ALLOWED_USER_IDS`
- `DISCORD_ALLOWED_GUILD_IDS`

## USER.md 用户资料

ClawNeo 将可人工编辑的用户资料文件存放在：

```text
~/.clawneo/workspace/USER.md
```

该文件用于保存稳定偏好和其他需要跨会话持久化的上下文信息。

## 架构概览 {#architecture-overview}

ClawNeo 有意保持比通用多智能体平台更轻量。它的核心执行路径是：

```text
Discord -> Session -> Codex -> Tools -> Reply -> Persistent context
```

### 核心模块

- **Discord 适配层**：接收并发送 Discord 消息
- **Session 服务**：将消息映射到稳定的 `sessionKey`，并保证串行执行
- **Agent 运行器**：驱动 Codex 对话循环与工具调用
- **工具执行器**：执行 `read`、`grep`、`bash` 等内置工具
- **持久化层**：存储 SQLite 状态、JSONL transcript 与 `USER.md`
- **提醒调度器**：处理提醒式定时任务

### Session 模型

推荐的 session key 形式：

- DM：`discord:dm:<userId>`
- 服务器频道：`discord:guild:<guildId>:channel:<channelId>`
- 线程：`discord:guild:<guildId>:thread:<threadId>`

### 存储策略

ClawNeo 使用混合持久化方案：

- `SQLite`：结构化状态
- `JSONL`：追加式 transcript
- `USER.md`：可人工编辑的用户资料上下文

默认状态根目录：

```text
~/.clawneo
```

### 提醒路径

提醒投递走一条专门的系统链路：

```text
自然语言提醒 -> reminder skill -> scheduled task tools -> SQLite -> in-process scheduler -> Discord reminder
```

若需更详细、更新更及时的实现记录，请查看：

- [GitHub 上的 ARCHITECTURE.md](https://github.com/Tit1e/clawneo/blob/main/ARCHITECTURE.md)

## 验证配置

常用检查命令：

```bash
clawneo status
clawneo ui
```

如果服务尚未启动，请先执行：

```bash
clawneo start
```

## 下一步

- 继续阅读 [快速开始](/zh/guide/quick-start)
- 查看 [命令参考](/zh/reference/commands)
