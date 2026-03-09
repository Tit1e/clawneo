---
home: true
heroImage: /assets/clawneo-hero.jpg
heroText: ClawNeo
tagline: Personal AI assistant CLI for Discord-first workflows
actions:
  - text: Get Started
    link: /guide/installation.html
    type: primary
  - text: Quick Start
    link: /guide/quick-start.html
    type: secondary
  - text: GitHub
    link: https://github.com/Tit1e/clawneo
    type: secondary
features:
  - title: Discord-first interaction
    details: Use ClawNeo from Discord as the main interface, with support for both plain-text system commands and native slash commands.
  - title: Codex-powered local work
    details: Combine OpenAI Codex OAuth with practical built-in tools for reading files, searching code, and running shell commands.
  - title: Persistent user context
    details: Keep stable preferences and profile data across sessions through structured storage and a human-editable USER.md file.
  - title: Lightweight operations and reminders
    details: Manage the local service, open a status UI, and create reminder-style scheduled tasks directly from Discord.
footer: MIT Licensed | Copyright © 2026 Tit1e
---

## What is ClawNeo?

ClawNeo is a personal AI assistant CLI focused on a narrow, practical path:

- Discord as the primary interaction channel
- OpenAI Codex OAuth for model access
- local tools for files, code search, and shell execution
- persistent preferences, transcripts, and profile context
- a lightweight local status UI and service commands

Instead of trying to be a large multi-channel agent platform, ClawNeo stays optimized for a single workflow that is easy to operate and easy to reason about.

## Why ClawNeo

### Fast path from install to daily use

You can go from npm install to a working Discord-connected assistant with a small number of steps:

1. install the CLI
2. authorize OpenAI
3. configure a Discord bot token
4. start the service
5. chat with ClawNeo in Discord

### Practical built-in tools

ClawNeo includes a compact toolset for real local work:

- `read`
- `ls`
- `grep`
- `bash`
- `install_skill`
- reminder scheduling tools

### Persistent memory with simple files

ClawNeo combines structured local storage with a human-editable profile file:

- SQLite for structured runtime state
- transcript storage for conversation history
- `USER.md` for durable user preferences and profile context

## 30-second quick start

Install:

```bash
npm install -g clawneo
```

Open configuration:

```bash
clawneo config
```

Start the service:

```bash
clawneo start
```

Open the local status UI if needed:

```text
http://127.0.0.1:3210
```

Then continue with the full guides:

- [Installation](/guide/installation.html)
- [Configuration](/guide/configuration.html)
- [Quick Start](/guide/quick-start.html)

## Documentation map

### Guide

- [Installation](/guide/installation.html)
- [Configuration](/guide/configuration.html)
- [Quick Start](/guide/quick-start.html)

### Reference

- [Command Reference](/reference/commands.html)
- [Tools Reference](/reference/tools.html)

### Architecture

- [Architecture Overview](/architecture.html)

## Core capabilities

### Discord system commands

ClawNeo supports these Discord-side system commands:

```text
/help
/status
/cancel
/update
/restart
/stop
```

### Reminder tasks

Example requests:

```text
20 minutes later remind me to check the logs
every day at 8 remind me to clock in
what reminders do I have
cancel the latest reminder
```

### Skills

ClawNeo loads skills from:

- `~/.clawneo/skills`
- `~/.agents/skills`

Default installs go to `~/.clawneo/skills`. Global installs should only be used when explicitly requested.

## Platform support

- macOS: supported
- Linux: experimental
- Windows: not supported yet

## Repository

- GitHub: [Tit1e/clawneo](https://github.com/Tit1e/clawneo)
- Package manager examples in this documentation use `npm`
