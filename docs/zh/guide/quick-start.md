# 快速开始

## 安装

```bash
npm install -g clawneo
```

## 升级

```bash
npm install -g clawneo@latest
clawneo restart
```

## 基础 CLI 命令

```bash
clawneo -h
clawneo --help
clawneo -v
clawneo --version
clawneo config
clawneo start
clawneo stop
clawneo restart
clawneo status
clawneo ui
```

## 本地状态 UI

服务启动后，打开：

```text
http://127.0.0.1:3210
```

## Discord 系统命令

ClawNeo 同时支持普通文本 `/xxx` 消息和原生 Discord 斜杠命令。

```text
/help
/status
/cancel
/update
/restart
/stop
```

说明：

- `/cancel` 会中止当前 Discord 会话里正在执行的任务
- `/update` 会在后台更新 ClawNeo 并重启服务
- `/stop` 会让机器人离线，直到你再次启动它

## 提醒任务

示例：

```text
20 分钟后提醒我检查日志
每天 8 点提醒我打卡
我有哪些提醒
取消最近一个提醒
```
