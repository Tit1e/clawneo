# Installation

This page covers the fastest supported way to install ClawNeo and verify that the CLI is working.

## Requirements

- Node.js `>= 22`
- npm
- macOS recommended
- Linux available as an experimental target
- Windows is not supported yet for tool execution

## Install from npm

```bash
npm install -g clawneo
```

After installation, verify that the binary is available:

```bash
clawneo --version
clawneo --help
```

## What gets installed

The CLI command is:

```text
clawneo
```

ClawNeo stores its runtime state under:

```text
~/.clawneo
```

Typical files and directories include:

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

## First-run flow

On first start, ClawNeo guides you through the required setup steps:

- OpenAI Codex OAuth authorization
- Discord bot token configuration
- Discord allowlist configuration

Start the service with:

```bash
clawneo start
```

If you prefer to configure things manually later, you can also use:

```bash
clawneo config
```

## Upgrade

Upgrade to the latest published version with npm:

```bash
npm install -g clawneo@latest
```

After upgrading, restart the service if it is already running:

```bash
clawneo restart
```

## Basic service commands

```bash
clawneo start
clawneo stop
clawneo restart
clawneo status
clawneo ui
```

## Local status UI

You can open the local status UI with:

```bash
clawneo ui
```

Default address:

```text
http://127.0.0.1:3210
```

## Troubleshooting

### `clawneo: command not found`

Possible causes:

- npm global bin directory is not in `PATH`
- installation failed
- Node.js version is too old

Check:

```bash
npm config get prefix
node -v
npm -v
```

### Node.js version is unsupported

ClawNeo requires:

```text
Node.js >= 22
```

### Linux works but tools behave differently

ClawNeo prefers a Unix shell for tool execution. Shell resolution order is:

1. `CLAWNEO_SHELL`
2. `zsh`
3. `bash`
4. `sh`

If needed, set an explicit shell path before starting ClawNeo.

## Next step

- Continue to [Configuration](/guide/configuration.html)
- Or jump to [Quick Start](/guide/quick-start.html)
