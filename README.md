# ClawNeo

ClawNeo 是一个个人 AI 助手 CLI + Discord bridge。

它支持：
- 通过 Discord 和助手对话
- 使用 OpenAI Codex OAuth 登录
- 调用 `read` / `ls` / `grep` / `bash` 工具
- 保存用户偏好
- 提供本地状态 UI 和基础运维命令

当前 CLI 命令名仍然是 `clawneo`。

## 平台支持

- macOS：支持
- Linux：实验性支持
- Windows：暂不支持

## 安装

```bash
npm install
```

## 登录

```bash
npm run auth:login
```

这会打开浏览器完成 OpenAI Codex OAuth 登录。

## 配置

```bash
npm run cli -- config
```

或者全局安装后：

```bash
clawneo config
```

主配置文件默认位于：

```text
~/.clawneo/clawneo.json
```

## 启动与停止

开发环境下：

```bash
npm run cli -- start
npm run cli -- stop
npm run cli -- restart
npm run cli -- status
npm run cli -- ui
```

如果后续通过 npm 全局安装成功，则可直接使用：

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

当前支持：

```text
/help
/status
/restart
/stop
```

说明：
- 这些命令不经过模型
- `/stop` 后 bot 会离线
- 停止后需要通过 CLI 再次执行 `clawneo start`

## 技能目录

ClawNeo 会从以下目录加载 skills：

- `~/.clawneo/skills`
- `~/.agents/skills`

示例结构：

```text
~/.clawneo/skills/
  github-projects/
    SKILL.md
```

## 开发

类型检查：

```bash
npm run typecheck
```

构建：

```bash
npm run build
```

打包验证：

```bash
npm pack
```

## 更多说明

详细设计见：
- [ARCHITECTURE.md](./ARCHITECTURE.md)
