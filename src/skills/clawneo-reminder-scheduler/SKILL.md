---
name: clawneo-reminder-scheduler
description: Use when the user asks to create, view, or cancel reminder-style scheduled tasks in ClawNeo through natural language, such as "remind me in 20 minutes" or "every day at 8". Convert the request into a fixed, machine-checkable structure before calling the scheduling tools.
---

# ClawNeo Reminder Scheduler

当用户要求通过自然语言创建、查看或取消提醒型定时任务时，使用这个 skill。

这个 skill 只处理“提醒型任务”，不处理定时执行任意 shell 命令、安装包、代码修改或其他高风险自动化。

## 范围

支持的任务类型：

- 一次性提醒
  - 例如：`20 分钟后提醒我检查日志`
  - 例如：`明天早上 9 点提醒我开会`
- 周期性提醒
  - 例如：`每天 8 点提醒我打卡`
  - 例如：`每周一 10 点提醒我周会`
- 查看提醒
  - 例如：`我有哪些提醒`
- 取消提醒
  - 例如：`取消刚才那个提醒`
  - 例如：`取消 id 为 xxx 的提醒`

## 规则

- 不要自己模拟定时任务。
- 不要口头说“我记住了”而不调用系统工具。
- 不要用 `bash`、`sleep`、`setTimeout` 或其他临时方式实现提醒。
- 先把用户意图规整成固定结构，再调用系统工具。
- 如果时间表达有歧义，先追问，不要猜。
- 如果任务不是“提醒型任务”，不要使用这个 skill。

## 固定结构

创建任务时，先把用户意图规整成以下其中一种结构。

### 一次性提醒

```json
{
  "kind": "once",
  "scheduleType": "at",
  "runAt": "2026-03-08T20:30:00+08:00",
  "timezone": "Asia/Shanghai",
  "reminderText": "检查部署日志"
}
```

### 周期性提醒

```json
{
  "kind": "recurring",
  "scheduleType": "cron",
  "cronExpr": "0 8 * * *",
  "timezone": "Asia/Shanghai",
  "reminderText": "打卡"
}
```

## 工具使用约定

当系统提供这些工具时，使用它们，而不是自己实现调度逻辑：

- `create_scheduled_task`
- `list_scheduled_tasks`
- `cancel_scheduled_task`

### 创建提醒

先规整成固定结构，再调用 `create_scheduled_task`。

### 查看提醒

当用户询问已有提醒时，调用 `list_scheduled_tasks`。

### 取消提醒

当用户要求取消提醒时，优先调用 `cancel_scheduled_task`。
如果用户没有提供足够信息定位目标任务，先追问。

## 追问规则

遇到这些情况必须先追问：

- `明天提醒我`
  - 缺少具体时间
- `下周提醒我处理一下`
  - 缺少具体日期或时间
- `取消那个提醒`
  - 如果当前上下文不足以唯一定位任务

## 不要做的事

- 不要创建“定时执行 bash”的任务
- 不要创建“定时安装软件”的任务
- 不要把一般自动化任务伪装成提醒
- 不要在没有明确时间的情况下自动补全为某个默认时间
