# Command Reference

## CLI service commands

| Command | Description |
| --- | --- |
| `clawneo start` | Start the local ClawNeo service |
| `clawneo stop` | Stop the running service |
| `clawneo restart` | Restart the service |
| `clawneo status` | Show service status |
| `clawneo ui` | Open the local status UI |
| `clawneo config` | Open interactive configuration |

## Model-facing tools

ClawNeo can use these built-in tools when appropriate:

| Tool | Description |
| --- | --- |
| `read` | Read text files and images |
| `ls` | List directory contents |
| `grep` | Search file contents |
| `bash` | Run shell commands |
| `install_skill` | Install a skill into ClawNeo |
| `create_scheduled_task` | Create a reminder-style scheduled task |
| `list_scheduled_tasks` | List reminder tasks |
| `cancel_scheduled_task` | Cancel a reminder task |

## Skill directories

ClawNeo loads skills from:

- `~/.clawneo/skills`
- `~/.agents/skills`

Default behavior:

- local installs go to `~/.clawneo/skills`
- global installs go to `~/.agents/skills`
- global installation only happens when explicitly requested
