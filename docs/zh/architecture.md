# 架构概览

ClawNeo 有意保持比通用多智能体平台更轻量。它的核心执行路径是：

```text
Discord -> Session -> Codex -> Tools -> Reply -> Persistent context
```

## 核心模块

- **Discord 适配层**：接收并发送 Discord 消息
- **Session 服务**：将消息映射到稳定的 `sessionKey`，并保证串行执行
- **Agent 运行器**：驱动 Codex 对话循环与工具调用
- **工具执行器**：执行 `read`、`grep`、`bash` 等内置工具
- **持久化层**：存储 SQLite 状态、JSONL transcript 与 `USER.md`
- **提醒调度器**：处理提醒式定时任务

## Session 模型

推荐的 session key 形式：

- DM：`discord:dm:<userId>`
- 服务器频道：`discord:guild:<guildId>:channel:<channelId>`
- 线程：`discord:guild:<guildId>:thread:<threadId>`

## 存储策略

ClawNeo 使用混合持久化方案：

- `SQLite`：结构化状态
- `JSONL`：追加式 transcript
- `USER.md`：可人工编辑的用户资料上下文

默认状态根目录：

```text
~/.clawneo
```

## 提醒路径

提醒投递走一条专门的系统链路：

```text
自然语言提醒 -> reminder skill -> scheduled task tools -> SQLite -> in-process scheduler -> Discord reminder
```

## 当前状态

若需更详细、更新更及时的实现记录，请查看：

- [GitHub 上的 ARCHITECTURE.md](https://github.com/Tit1e/clawneo/blob/main/ARCHITECTURE.md)
