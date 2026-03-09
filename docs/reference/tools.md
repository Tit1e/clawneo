# Tools Reference

ClawNeo can use a small set of built-in tools to work with local files, code, shell commands, skills, and reminder tasks.

The tool layer is intentionally narrow: practical enough for daily use, but easier to reason about than a large plugin system.

## File and search tools

### `read`

Read the contents of a file.

Typical uses:

- inspect source files
- read markdown, JSON, or config files
- open images such as `jpg`, `png`, `gif`, and `webp`
- read a file in chunks with offset and limit when it is large

Behavior notes:

- text output is truncated for very large files
- images are returned as attachments instead of raw text
- supports relative and absolute paths

### `ls`

List directory contents.

Typical uses:

- inspect repository structure
- verify generated files
- find the next file to open

Behavior notes:

- directories are shown with a trailing `/`
- dotfiles are included
- output is truncated for very large directories

### `grep`

Search file contents for a pattern.

Typical uses:

- find symbols, commands, env vars, or error strings
- locate configuration fields
- inspect usage across a codebase

Behavior notes:

- respects `.gitignore`
- supports regex or literal matching
- can filter files with `glob`
- can return surrounding context lines

## Shell tool

### `bash`

Run a shell command in the configured working directory.

Typical uses:

- run builds or tests
- inspect git status or diffs
- execute targeted project commands

Behavior notes:

- default timeout is limited
- maximum timeout is capped
- output capture is size-limited
- ClawNeo prefers a Unix shell and is not supported on Windows for tool execution yet

Shell resolution order:

1. `CLAWNEO_SHELL`
2. `zsh`
3. `bash`
4. `sh`

### Safety model for `bash`

ClawNeo blocks some obviously dangerous commands, including patterns related to:

- shutdown or reboot
- destructive disk formatting
- dangerous `dd if=` usage
- `rm -rf /`
- fork bombs

In addition to hard-blocked patterns, high-risk file-system operations should require explicit user confirmation before execution.

## Skill management tool

### `install_skill`

Install a skill into ClawNeo.

Supported sources:

- local paths
- GitHub repo shorthand such as `owner/repo`
- full git URLs

Install targets:

- default: `~/.clawneo/skills`
- global: `~/.agents/skills`

Important rule:

- global installation should only be used when the user explicitly asks for it

## Reminder task tools

### `create_scheduled_task`

Create a reminder-style scheduled task for the current Discord conversation.

Supports:

- one-shot reminders
- recurring reminders
- explicit timezone or machine default timezone

### `list_scheduled_tasks`

List reminder tasks for the current user or current session.

Useful filters include:

- scope: `user` or `session`
- status: `active`, `delivering`, `done`, `cancelled`, `failed`

### `cancel_scheduled_task`

Cancel a reminder task by ID, or cancel the latest active task in the current session.

## Practical boundaries

ClawNeo tools are designed for:

- repository inspection
- lightweight automation
- targeted shell execution
- local skill installation
- reminder scheduling in Discord

They are not designed to be:

- a full container sandbox
- a browser automation suite by default
- a distributed worker system
- an unrestricted remote execution platform

## Related pages

- [Command Reference](/reference/commands)
- [Quick Start](/guide/quick-start)
- [Architecture Overview](/architecture)
