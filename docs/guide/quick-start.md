# Quick Start

## Install

```bash
npm install -g clawneo
```

## Upgrade

```bash
npm install -g clawneo@latest
clawneo restart
```

## Basic CLI commands

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

## Local status UI

After the service starts, open:

```text
http://127.0.0.1:3210
```

## Discord system commands

ClawNeo supports both plain-text `/xxx` messages and native Discord slash commands.

```text
/help
/status
/cancel
/update
/restart
/stop
```

Notes:

- `/cancel` aborts the current running task in the current Discord session
- `/update` updates ClawNeo in the background and restarts the service
- `/stop` takes the bot offline until you start it again

## Reminder tasks

Examples:

```text
20 minutes later remind me to check the logs
every day at 8 remind me to clock in
what reminders do I have
cancel the latest reminder
```
