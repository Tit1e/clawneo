# Commands

This page collects the main commands you will use when running ClawNeo locally and from Discord.

## CLI service commands

| Command | Description |
| --- | --- |
| `clawneo start` | Start the local ClawNeo service |
| `clawneo stop` | Stop the running service |
| `clawneo restart` | Restart the service |
| `clawneo status` | Show service status |
| `clawneo ui` | Open the local status UI |
| `clawneo config` | Open interactive configuration |

## Basic CLI flags

| Command | Description |
| --- | --- |
| `clawneo -h` | Show help |
| `clawneo --help` | Show help |
| `clawneo -v` | Show version |
| `clawneo --version` | Show version |

## Discord system commands

ClawNeo supports both plain-text `/xxx` messages and native Discord slash commands.

| Command | Description |
| --- | --- |
| `/help` | Show available system commands |
| `/status` | Check service or bot status |
| `/cancel` | Abort the current running task in the current Discord session |
| `/update` | Update ClawNeo in the background and restart the service |
| `/restart` | Restart the service |
| `/stop` | Take the bot offline until you start it again |

## Command boundaries

This page focuses on user-facing commands.

If you want:

- built-in model tools such as `read`, `grep`, or `bash`, see [Tools](/guide/tools)
- installation and runtime setup details, see [Configuration](/guide/configuration)
- a minimal getting-started flow, see [Quick Start](/guide/quick-start)
