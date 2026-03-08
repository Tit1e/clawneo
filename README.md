[中文](./README.zh-CN.md)

# ClawNeo

ClawNeo is a personal AI assistant CLI with a Discord bridge.

It supports:
- chatting with the assistant through Discord
- OpenAI Codex OAuth
- `read` / `ls` / `grep` / `bash` tools
- structured user preferences
- a local status UI and basic service commands

The CLI command is `clawneo`.

## Platform Support

- macOS: supported
- Linux: experimental
- Windows: not supported yet

## Install

```bash
npm install -g clawneo
```

## Configure

```bash
clawneo config
```

The main config file is stored at:

```text
~/.clawneo/clawneo.json
```

## Start and Stop

On first start, ClawNeo will run an interactive onboarding flow to help you complete OpenAI authorization and the required Discord configuration.

```bash
clawneo start
clawneo stop
clawneo restart
clawneo status
clawneo ui
```

## Local Status UI

```bash
clawneo ui
```

Default address:

```text
http://127.0.0.1:3210
```

## Discord System Commands

Supported commands:

```text
/help
/status
/restart
/stop
```

Notes:
- these commands bypass the model
- `/stop` will take the bot offline
- after stopping, start it again with `clawneo start`

## Skills Directory

ClawNeo loads skills from:

- `~/.clawneo/skills`
- `~/.agents/skills`

Example layout:

```text
~/.clawneo/skills/
  github-projects/
    SKILL.md
```

## More

For architecture details, see:
- [ARCHITECTURE.md](./ARCHITECTURE.md)
