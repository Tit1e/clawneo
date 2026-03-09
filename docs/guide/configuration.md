# Configuration

This page explains the minimum configuration needed to make ClawNeo usable in practice.

## Main config file

The primary config file is stored at:

```text
~/.clawneo/clawneo.json
```

If the file does not exist yet, ClawNeo creates it automatically.

## Recommended configuration path

The easiest way to configure ClawNeo is:

```bash
clawneo config
```

The interactive config flow lets you manage:

- OpenAI authorization
- Discord bot token
- allowed Discord user IDs
- allowed Discord guild IDs
- model selection
- tool working directory

## Minimum setup checklist

To get a working Discord-connected assistant, you need:

1. an authorized OpenAI Codex profile
2. a Discord bot token
3. at least one Discord access scope
   - allowed user IDs, or
   - allowed guild IDs

## Example config

A minimal example looks like this:

```json
{
  "discord": {
    "token": "YOUR_DISCORD_BOT_TOKEN",
    "allowedUserIds": ["123456789012345678"],
    "allowedGuildIds": []
  },
  "agent": {
    "model": "gpt-5-codex"
  },
  "runtime": {
    "note": "Primary ClawNeo config file."
  }
}
```

## OpenAI authorization

ClawNeo uses OpenAI Codex OAuth.

From the CLI, open:

```bash
clawneo config
```

Then choose:

```text
OpenAI Settings -> Authorize OpenAI
```

Related local files:

```text
~/.clawneo/auth-profiles.json
```

## Discord configuration

Required field:

- `discord.token`

Optional access controls:

- `discord.allowedUserIds`
- `discord.allowedGuildIds`

Behavior notes:

- if both allowlists are empty, ClawNeo treats access as open within the current bot scope
- if you set allowlists, only matching users or guilds are accepted

## Agent configuration

Common fields:

- `agent.model`
- `agent.workspaceRoot`
- `agent.toolCwd`

Defaults:

- model: `gpt-5-codex`
- workspace root: `~/.clawneo/workspace`
- tool cwd: current user's home directory

### `workspaceRoot`

This is ClawNeo's managed workspace for persistent assistant files, including:

```text
~/.clawneo/workspace/USER.md
```

### `toolCwd`

This is the default working directory used by tools such as `read`, `ls`, `grep`, and `bash` unless a task explicitly requires another path.

## Runtime paths

ClawNeo derives several runtime paths under `~/.clawneo` by default:

- `clawneo.json`
- `clawneo.db`
- `auth-profiles.json`
- `transcripts/`
- `workspace/`
- `skills/`

## Environment variable overrides

ClawNeo supports environment-variable overrides for common paths and runtime behavior.

### State and config

- `CLAWNEO_STATE_DIR`
- `CLAWNEO_CONFIG_PATH`
- `CLAWNEO_DB_PATH`
- `CLAWNEO_TRANSCRIPT_DIR`
- `CLAWNEO_AUTH_STORE_PATH`
- `CLAWNEO_WORKSPACE_ROOT`
- `CLAWNEO_TOOL_CWD`

### Agent and shell

- `CLAWNEO_MODEL`
- `CLAWNEO_SHELL`
- `CLAWNEO_UI_NO_OPEN=1`

### Discord

- `DISCORD_TOKEN`
- `DISCORD_ALLOWED_USER_IDS`
- `DISCORD_ALLOWED_GUILD_IDS`

## USER.md profile

ClawNeo keeps a human-editable profile file at:

```text
~/.clawneo/workspace/USER.md
```

This file is used to store stable preferences and other persistent context that should survive across sessions.

## Verify your configuration

Useful checks:

```bash
clawneo status
clawneo ui
```

If the service is not running yet, start it first:

```bash
clawneo start
```

## Next step

- Continue to [Quick Start](/guide/quick-start.html)
- See [Command Reference](/reference/commands.html)
