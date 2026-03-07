# MiniClaw 架构方案

## 当前实现状态

截至当前版本，下面这些部分已经完成：

- 已完成：TypeScript 项目骨架
- 已完成：`SQLite` 初始化与基础表
- 已完成：Discord 连接、消息接收、按 `guild/user` allowlist 放行
- 已完成：`sessionKey` 生成与 transcript 持久化
- 已完成：Discord 超长回复自动分片发送
- 已完成：OpenAI Codex OAuth 浏览器授权、`localhost:1455` 回调、auth store 落盘
- 已完成：运行时优先读取项目 auth profile，并在过期时自动 refresh
- 已完成：auth store 使用显式 `defaultProfileId` 选择当前默认 OAuth profile，避免旧 `openai-codex:default` 抢占
- 已完成：基于 `pi-coding-agent` 的 Codex 对话链路
- 已完成：`read` / `ls` / `grep` / `bash` 工具接入
- 已完成：工具开始/结束日志记录
- 已完成：结构化偏好存储与显式偏好更新
- 已完成：`SQLite + USER.md` 联合注入 prompt
- 已完成：基础危险命令硬封禁

下面这些仍未完成，或者只完成了部分：

- 未完成：`USER.md` 双向同步
- 未完成：统一的工具输出摘要策略
- 未完成：会话取消 / 中断
- 未完成：轻量 fact 抽取
- 部分完成：错误呈现已经比初版清晰，但还没有系统化的审计视图

## 目标

构建一个精简版、可用的 OpenClaw 风格个人助手，聚焦单一主路径：

- 只使用 OpenAI 认证
- 只接入 Discord
- 使用支持 Codex 风格能力的模型运行时
- 支持在对话中执行命令
- 持久化用户偏好
- 保留轻量记忆能力，但不复制 OpenClaw 的完整复杂度

这个项目不应该照搬 OpenClaw 的全部范围，而应该只保留真正影响使用体验的部分，并且明确排除多渠道、插件生态、移动节点、浏览器自动化和复杂沙箱编排。

## 产品范围

### 第一版包含

- 接收并回复 Discord 消息
- 维护按用户或线程隔离的连续会话
- 使用 OpenAI Codex OAuth 认证后的模型访问能力
- 支持工具调用，尤其是受控命令执行
- 跨会话持久化用户偏好
- 持久化对话 transcript
- 在后续轮次中注入稳定偏好

### 第一版不包含

- Telegram、Slack、WhatsApp、WebChat 或任何非 Discord 渠道
- 多 agent 路由
- 插件市场或扩展运行时
- 浏览器控制
- Canvas 或 UI host
- 移动设备节点
- 向量记忆与语义检索
- 分布式 worker
- 完整的 OpenClaw 容器沙箱体系

## 核心设计原则

MiniClaw 应该是一个单进程应用，但内部边界要非常清楚：

1. `Discord 适配层`
2. `会话服务`
3. `会话存储`
4. `Agent 运行器`
5. `工具执行器`
6. `偏好存储`
7. `Transcript 存储`

Discord 层只负责消息输入输出，不负责记忆、Prompt 拼装或工具编排。

## 高层架构

```text
Discord 消息
  -> Discord 适配层
  -> InboundMessage
  -> 会话服务
  -> 会话锁
  -> 读取会话 + 偏好 + 最近 transcript
  -> Agent 运行器
      -> OpenAI/Codex 模型
      -> 可选工具调用
      -> 工具执行器
      -> 工具结果回填模型
  -> 最终回复
  -> 持久化 transcript
  -> 抽取或更新偏好
  -> 回发 Discord
```

## 为什么它会比 OpenClaw 小很多

OpenClaw 本质上是一个本地 gateway / control plane，支持：

- 多渠道
- 多 provider / 多认证路径
- 多种工具类型
- 多会话模式
- 插件 hook
- 记忆索引
- 远程节点

MiniClaw 只需要一条窄路径：

`Discord -> session -> Codex -> 命令工具 -> 回复 -> 持久化偏好`

这条路径必须保持简单且可解释。

## 会话模型

会话模型是整个系统的骨架。每一条进入的 Discord 消息，都必须先被解析成稳定的内部 `sessionKey`。

### 建议的 Session Key 规则

- 私聊 DM: `discord:dm:<userId>`
- 服务器频道: `discord:guild:<guildId>:channel:<channelId>`
- 线程: `discord:guild:<guildId>:thread:<threadId>`

### 基本规则

- 一个 `sessionKey` 对应一个串行执行通道
- 同一时间一个 `sessionKey` 只能有一个活动 run
- 同一会话的新消息要么排队，要么取消当前 run，但第一版建议只做排队
- 第一版不要做复杂的抢占和中断策略

## 数据存储策略

采用混合存储：

- `SQLite` 保存结构化状态
- `JSONL` 保存 append-only transcript
- `USER.md` 保存可人工编辑的用户资料上下文

这是在可维护性和简单性之间最合适的平衡。

### 当前实现对应关系

- 已完成：`SQLite` 作为会话、消息和偏好存储
- 已完成：transcript append-only 持久化
- 已完成：`USER.md` 作为补充上下文参与 prompt 构建
- 未完成：将稳定偏好自动回写到 `USER.md`

## 为什么不能把所有偏好都放进 USER.md

`USER.md` 很适合放人类可读资料，但不适合做权威结构化状态：

- 很难安全更新
- 很难做冲突覆盖
- 很难按 key 查询
- 很容易累计互相矛盾的自然语言描述

因此，结构化偏好应当放在 `SQLite` 里，而 `USER.md` 作为补充的人类可读上下文。

## 偏好模型

### 定义

结构化偏好是指那些稳定、可建模、适合用明确键值表示的用户设置，而不是一大段自由文本总结。

### 适合存的偏好

- `response_language = zh-CN`
- `answer_style = concise`
- `package_manager = pnpm`
- `shell = zsh`
- `edit_policy = ask_before_modify`
- `reply_format = short_paragraph`
- `risk_tolerance = conservative`

### 不适合存的内容

- 模糊印象
- 长段自然语言总结
- 临时任务上下文
- 当下情绪
- 重复的自由文本笔记

## USER.md + SQLite 混合方案

### USER.md 负责保存

- 用户资料说明
- 长期沟通习惯
- 人工维护的稳定规则
- 更适合直接给模型读的自然语言上下文

### SQLite 负责保存

- 权威结构化偏好
- 更新时间
- 偏好来源
- 置信度
- 机器可读值

### 运行时真相来源

- 结构化偏好的权威来源是 `SQLite`
- `USER.md` 是补充上下文，不是权威状态

### 同步规则

- 显式偏好更新先写入 `SQLite`
- 稳定偏好可以定期同步渲染到 `USER.md`
- Prompt 构建时优先使用 `SQLite` 中的值

## 建议的目录结构

```text
miniclaw/
  package.json
  ARCHITECTURE.md
  USER.md
  data/
    miniclaw.db
    transcripts/
  src/
    discord/
      client.ts
      message-handler.ts
      outbound.ts
    core/
      conversation-service.ts
      session-manager.ts
      prompt-builder.ts
      types.ts
    agent/
      agent-runner.ts
      model-client.ts
      tool-loop.ts
    tools/
      bash-tool.ts
      preference-tool.ts
      types.ts
    preferences/
      preference-store.ts
      preference-extractor.ts
      user-profile-sync.ts
    transcripts/
      transcript-store.ts
    store/
      db.ts
      migrations.ts
    auth/
      openai-auth.ts
      token-store.ts
```

说明：上面是目标结构，不是当前文件树的逐字镜像。当前已经实际存在的关键目录主要是：

- `src/discord`
- `src/core`
- `src/agent`
- `src/auth`
- `src/tools`
- `src/preferences`
- `src/transcripts`
- `src/store`

## 数据库表结构

### sessions

```sql
CREATE TABLE sessions (
  session_key TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  user_id TEXT,
  guild_id TEXT,
  channel_id TEXT,
  thread_id TEXT,
  active_run_id TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### messages

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_key TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls_json TEXT,
  created_at TEXT NOT NULL
);
```

### user_preferences

```sql
CREATE TABLE user_preferences (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  source TEXT,
  confidence REAL DEFAULT 1.0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
```

### user_facts

这是可选的 v1.5 能力，第一版不是必须。

```sql
CREATE TABLE user_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fact_text TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL
);
```

## USER.md 模板建议

```md
# User Profile

- Preferred language: Simplified Chinese
- Preferred answer style: concise
- Preferred package manager: pnpm
- Shell: zsh
- Edit policy: ask before modifying files
- Current project: MiniClaw
- Goal: build a minimal OpenClaw-like Discord assistant
```

这个文件应当保持短、小、高信号。

## Discord 接入设计

### Discord 层的职责

Discord 适配层只负责：

- 连接 Discord
- 接收消息
- 把事件标准化成内部消息对象
- 把结果和状态更新回发给 Discord

### InboundMessage 建议结构

```ts
type InboundMessage = {
  messageId: string;
  platform: "discord";
  userId: string;
  guildId?: string;
  channelId: string;
  threadId?: string;
  sessionKey: string;
  text: string;
  createdAt: string;
};
```

### Discord 第一版策略

- 先支持 DM
- 可选支持一个配置好的 guild 或 channel allowlist
- 忽略 bot 消息
- 第一版先忽略纯附件无文本消息
- 第一版不做 slash commands

### 当前实现状态

- 已完成：`messageCreate` 入站
- 已完成：机器人自身消息忽略
- 已完成：按 `DISCORD_ALLOWED_USER_IDS` 放行
- 已完成：按 `DISCORD_ALLOWED_GUILD_IDS` 放行
- 已完成：在支持的 channel 上发送 typing 状态，并做兼容保护
- 已完成：回复自动分片，避免 Discord `2000` 字符限制
- 未完成：slash commands
- 未完成：附件处理
- 未完成：语音

## 会话服务

会话服务是应用真正的核心。

### 职责

- 接收标准化后的入站消息
- 获取会话锁
- 读取偏好
- 读取最近 transcript
- 构建 prompt 输入
- 调用 agent 运行器
- 持久化结果
- 触发偏好抽取
- 通过 Discord 适配层发送回复

### 建议接口

```ts
type ConversationService = {
  handleMessage(input: InboundMessage): Promise<void>;
};
```

### 处理步骤

1. 解析 `sessionKey`
2. 获取会话锁
3. 确保 session 行存在
4. 读取最近 transcript
5. 按 `userId` 读取结构化偏好
6. 如存在则读取 `USER.md`
7. 构建 prompt 输入
8. 执行 agent
9. 如有工具调用则执行工具
10. 持久化 assistant 输出
11. 如有需要则更新偏好
12. 回发 Discord

## Prompt 构建方式

Prompt 输入必须由多个小块组成，而不是一整坨大字符串。

### 建议的 Prompt 层级

1. system base prompt
2. tool policy prompt
3. 结构化偏好摘要
4. 可选的 `USER.md` 摘要
5. 最近 transcript
6. 当前用户消息

### 结构化偏好渲染示例

```text
User preferences:
- Reply in Simplified Chinese.
- Keep answers concise.
- Prefer pnpm over npm when suggesting commands.
- Ask before modifying files.
```

这段内容应该由 SQLite 中的偏好动态生成，而不是人工硬编码。

## OpenAI 认证与 Codex 运行时

### 基本假设

MiniClaw 使用一个 OpenAI 认证 profile，并通过该 profile 获得兼容 Codex 风格能力的模型访问。

### 第一版建议规则

- 只支持一个 auth profile
- 本地保存 token 元数据
- 请求前检查是否过期
- 如可刷新则自动 refresh
- auth 无效时直接报出清晰错误
- 第一版不做 provider 轮换和 fallback

### 认证层职责

- 读取 auth 状态
- 检查有效期
- 必要时刷新 token
- 为模型层返回 bearer token 或可用凭证

### 当前 auth store 约定

- auth store 保存在 `data/auth-profiles.json`
- 每次成功登录后，会把该 profile 记录为 `defaultProfileId`
- 运行时优先读取 `defaultProfileId` 指向的 profile，而不是按文件内键名字典序挑选
- 对旧格式 auth store 保持兼容
- 旧的 `openai-codex:default` 只作为兼容遗留项，不再应当成为默认选择依据

### 模型层职责

- 向 OpenAI/Codex 兼容接口发起 chat/tool 请求
- 支持流式输出
- 支持工具调用输出
- 支持工具结果回填后的续跑

### 当前实现状态

- 已完成：OpenAI Codex OAuth 浏览器登录与本地回调
- 已完成：auth profile 持久化到项目自己的 auth store
- 已完成：profile 过期后自动 refresh
- 已完成：基于 `openai-codex-responses` 的运行时路径
- 未完成：多 profile 管理

## Agent 运行器

Agent 运行器负责一轮完整执行：

- 发起模型调用
- 处理工具循环
- 产生最终答案
- 统一错误格式

### 必须具备的能力

- 同一 session 串行执行
- 支持流式 partial text
- 支持工具调用
- 支持工具结果续跑
- 支持取消
- 支持硬超时

### 建议接口

```ts
type AgentRunRequest = {
  sessionKey: string;
  userId: string;
  message: string;
  transcript: Array<{ role: string; content: string }>;
  preferences: Record<string, unknown>;
  userProfileMarkdown?: string;
};

type AgentRunResult = {
  reply: string;
  toolEvents: ToolEvent[];
  preferenceUpdates: PreferenceUpdate[];
};
```

## 工具执行设计

第一版最重要的工具就是受控 shell 执行。

### v1 工具集

- `bash`
- `remember_preference`

### bash 工具输入

```ts
type BashToolInput = {
  command: string;
  cwd?: string;
};
```

### bash 工具约束

- 第一版不支持交互式 TTY
- 默认 30 秒超时
- 收集 stdout 和 stderr
- 大输出自动截断
- 所有命令执行都要记日志
- 对明显危险命令做拦截
- 工具工作目录应可配置，而不是写死在 `workspaceRoot`

### 初始拒绝规则

至少要阻止：

- `rm -rf /`
- 超出工作目录范围的递归删除
- 直接提权路径
- 任意后台守护进程

### 当前实现状态

- 已完成：`bash` 工具接入
- 已完成：工具执行开始/结束日志
- 已完成：极高风险命令硬封禁
- 已完成：`toolCwd` 可配置，不再强制锁定 `workspaceRoot`
- 当前策略：高风险但非硬封禁操作，由 AI 在自然语言层主动确认
- 未完成：统一的工具输出摘要策略

### 命令结果结构

```ts
type BashToolResult = {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
};
```

## 为什么第一版不做完整沙箱

OpenClaw 的完整安全体系之所以复杂，是因为它必须支持多主机、多工具类型和更广泛的风险面。

MiniClaw 第一版只做：

- workspace 路径检查
- 命令超时
- 命令日志
- 输出截断
- denylist 或 allowlist

如果产品被验证有价值，再增加更强的进程隔离。

## Transcript 持久化

每轮对话建议保存两份：

- `SQLite` 中的结构化消息记录
- `JSONL` 中的 append-only 原始 transcript

### 保留 JSONL 的原因

- 调试方便
- 重放方便
- 人工查看方便
- 追加写简单

### Transcript 示例

```json
{"role":"user","content":"帮我看一下 package.json","createdAt":"2026-03-06T15:00:00Z"}
{"role":"assistant","content":"我先确认当前项目结构。","createdAt":"2026-03-06T15:00:02Z"}
{"role":"tool","name":"bash","input":{"command":"ls -la"},"output":{"exitCode":0,"stdout":"..."}}
{"role":"assistant","content":"当前目录只有 package.json。","createdAt":"2026-03-06T15:00:04Z"}
```

## 偏好更新策略

### 第一版建议

只支持“显式偏好捕获”。

例如：

- “以后用中文回答”
- “默认用 pnpm”
- “不要直接改文件，先问我”

这些语句应直接映射为结构化 key。

### 示例映射

- `以后用中文回答` -> `response_language = zh-CN`
- `默认用 pnpm` -> `package_manager = pnpm`
- `不要直接改文件，先问我` -> `edit_policy = ask_before_modify`

### 为什么第一版只做显式捕获

- 错误率更低
- 更容易调试
- 避免误记忆
- 用户信任成本更低

### v1.5 可选增强

每轮结束后加一个轻量抽取步骤，只在高置信度时提议更新稳定偏好。

## 偏好优先级

Prompt 构建时，偏好解析优先级建议如下：

1. `SQLite` 中最近一次显式更新的结构化偏好
2. 同步写入 `USER.md` 的稳定偏好
3. 配置默认值

如果 `USER.md` 与 `SQLite` 冲突，以 `SQLite` 为准。

## 最小配置面

后续可以再设计配置文件，但第一版配置面要尽量小。

建议配置字段：

```json
{
  "discord": {
    "token": "...",
    "allowedUserIds": ["1234567890"]
  },
  "openai": {
    "authMode": "oauth",
    "profile": "default"
  },
  "agent": {
    "model": "gpt-5-codex",
    "workspaceRoot": "./workspace"
  },
  "runtime": {
    "dbPath": "./data/miniclaw.db",
    "transcriptDir": "./data/transcripts"
  }
}
```

## 错误处理规则

- auth 错误必须直接对用户可见，且可操作
- 工具执行失败应作为工具结果回填给模型
- Discord 发送失败不能污染 session 状态
- run 崩溃后必须清掉活动锁

## 并发规则

- 同一 `sessionKey` 同时只允许一个活动 run
- 不同 session 可以并发执行
- 每个工具调用只属于一个 run
- session 锁必须在 `finally` 中释放

## 安全基线

### 最低安全默认值

- 默认只允许单用户或 allowlist
- 默认按 `guild/user` allowlist 控制接入
- 工具执行目录默认取 `MINICLAW_TOOL_CWD`，未配置时回退到 `HOME`
- 保留危险命令硬封禁
- 不允许 elevated execution
- 不允许远程挂载
- 不允许后台进程管理

### 审计日志至少记录

- 入站 message id
- session key
- 模型 request id（如可获得）
- 工具名
- 命令字符串
- exit code
- 回复时间

## 建议的实施阶段

### Phase 1

- [x] 项目骨架
- [x] SQLite 初始化
- [x] Discord 连接
- [x] session key 生成
- [x] transcript 持久化

### Phase 2

- [x] OpenAI Codex OAuth 集成
- [x] agent 运行器
- [x] 先跑通不带工具的基础回复链路

### Phase 3

- [x] bash 工具循环
- [x] 工具结果回填
- [x] Discord 回复分片
- [x] bash 超时控制
- [ ] 工具输出摘要

### Phase 4

- [x] 结构化偏好存储
- [x] 显式偏好更新
- [x] Prompt 偏好注入
- [ ] `USER.md` 同步

### Phase 5

- [ ] 取消 run
- [~] 更好的错误呈现
- [ ] 可选的轻量 fact 抽取

## 最终建议

正确的第一版方向不是“把 OpenClaw 每个部分都做小一点”，而是：

- 一个渠道
- 一条认证路径
- 一个主 agent 运行时
- 一个命令工具
- 一个结构化偏好系统

这里最关键的设计决定是偏好系统：

- 用 `SQLite` 作为结构化偏好的权威存储
- 用 `USER.md` 作为人类可读资料上下文
- transcript 单独保存

这样 MiniClaw 可以在不继承 OpenClaw 全量复杂度的情况下，得到一套干净、稳定、可扩展的基础。
