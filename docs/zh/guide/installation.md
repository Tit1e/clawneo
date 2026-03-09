# 安装

本页介绍安装 ClawNeo 的最快支持方式，以及如何确认 CLI 已正常工作。

## 环境要求

- Node.js `>= 22`
- npm
- 推荐 macOS
- Linux 可作为实验性目标使用
- Windows 暂不支持工具执行

## 通过 npm 安装

```bash
npm install -g clawneo
```

安装后，验证命令是否可用：

```bash
clawneo --version
clawneo --help
```

## 安装后会得到什么

CLI 命令为：

```text
clawneo
```

ClawNeo 默认将运行时状态存放在：

```text
~/.clawneo
```

常见文件与目录包括：

```text
~/.clawneo/
  clawneo.json
  clawneo.db
  auth-profiles.json
  transcripts/
  workspace/
    USER.md
  skills/
```

## 首次运行流程

首次启动时，ClawNeo 会引导你完成必要设置：

- OpenAI Codex OAuth 授权
- Discord Bot Token 配置
- Discord 允许列表配置

使用以下命令启动服务：

```bash
clawneo start
```

如果你想稍后手动配置，也可以先执行：

```bash
clawneo config
```

## 升级

通过 npm 升级到最新发布版本：

```bash
npm install -g clawneo@latest
```

升级后，如果服务已经在运行，可重启服务：

```bash
clawneo restart
```

## 基础服务命令

```bash
clawneo start
clawneo stop
clawneo restart
clawneo status
clawneo ui
```

## 本地状态 UI

你可以使用以下命令打开本地状态页面：

```bash
clawneo ui
```

默认地址：

```text
http://127.0.0.1:3210
```

## 故障排查

### `clawneo: command not found`

可能原因：

- npm 全局 bin 目录不在 `PATH` 中
- 安装失败
- Node.js 版本过低

可检查：

```bash
npm config get prefix
node -v
npm -v
```

### Node.js 版本不受支持

ClawNeo 要求：

```text
Node.js >= 22
```

### Linux 可运行但工具行为不同

ClawNeo 更偏好使用 Unix shell 执行工具。Shell 的解析顺序为：

1. `CLAWNEO_SHELL`
2. `zsh`
3. `bash`
4. `sh`

如有需要，可在启动 ClawNeo 前显式指定 shell 路径。

## 下一步

- 继续阅读 [配置说明](/zh/guide/configuration)
- 或跳转到 [快速开始](/zh/guide/quick-start)
