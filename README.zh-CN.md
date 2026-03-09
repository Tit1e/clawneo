![ClawNeo](./docs/assets/clawneo-hero.jpg)

# ClawNeo

[English](./README.md)

ClawNeo 是一个个人 AI 助手 CLI 与 Discord bridge。

它支持：
- 通过 Discord 和助手对话
- 使用 OpenAI Codex OAuth 登录
- 调用 `read` / `ls` / `grep` / `bash` 工具
- 在 Discord 中通过自然语言创建提醒类定时任务（实验性）
- 保存结构化用户偏好
- 提供本地状态 UI 和基础运维命令

当前 CLI 命令名是 `clawneo`。

## 平台支持

- macOS：支持
- Linux：实验性支持
- Windows：暂不支持

## 安装

```bash
npm install -g clawneo
```

## 升级

```bash
npm install -g clawneo@latest
clawneo restart
```

基础 CLI 帮助：

```bash
clawneo -h
clawneo --help
clawneo -v
clawneo --version
```

## 配置

```bash
clawneo config
```

如果你需要随时授权或重新授权 OpenAI，请进入 `clawneo config`，然后选择 `OpenAI 设置` -> `授权 OpenAI`。

主配置文件默认位于：

```text
~/.clawneo/clawneo.json
```

## 启动与停止

第一次启动时，ClawNeo 会进入交互式引导流程，帮助你完成 OpenAI 授权和必要的 Discord 配置。

```bash
clawneo start
clawneo stop
clawneo restart
clawneo status
clawneo ui
```

## 本地状态 UI

```bash
clawneo ui
```

默认地址：

```text
http://127.0.0.1:3210
```

## Discord 系统命令

ClawNeo 现在同时支持普通文本 `/xxx` 命令和 Discord 原生 slash commands。你在 Discord 输入 `/` 时，应该能直接看到这些命令及其内置说明。

当前支持：

```text
/help
/status
/cancel
/update
/restart
/stop
```

说明：
- 这些命令不经过模型
- `/cancel` 会取消当前 Discord 会话里正在运行的任务
- `/update` 会在后台执行 `npm install -g clawneo@latest`，完成后自动重启服务
- `/stop` 后 bot 会离线
- 停止后需要通过 CLI 再次执行 `clawneo start`

## 提醒任务

ClawNeo 已支持在 Discord 中通过自然语言创建提醒型定时任务。

示例：

```text
20 分钟后提醒我检查日志
每天 8 点提醒我打卡
我有哪些提醒
取消刚才那个提醒
```

说明：
- 这个功能目前仍是实验性能力
- 提醒投递目前按单实例运行的 ClawNeo 设计
- 如果你没有显式指定时区，系统会默认使用当前机器时区

## 技能目录

ClawNeo 会从以下目录加载 skills：

- `~/.clawneo/skills`
- `~/.agents/skills`

当 ClawNeo 帮你安装 skill 时，规则是：

- 默认安装到：`~/.clawneo/skills`
- 全局安装到：`~/.agents/skills`
- 只有当你明确要求“全局安装”时，ClawNeo 才会安装到 `~/.agents/skills`

示例结构：

```text
~/.clawneo/skills/
  github-projects/
    SKILL.md
```

## 更多说明

详细设计见：
- [ARCHITECTURE.md](./ARCHITECTURE.md)
