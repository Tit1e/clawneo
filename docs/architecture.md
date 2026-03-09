# Architecture Overview

ClawNeo is intentionally smaller than a general-purpose multi-agent platform. Its core execution path is:

```text
Discord -> Session -> Codex -> Tools -> Reply -> Persistent context
```

## Core modules

- **Discord adapter**: receives and sends Discord messages
- **Session service**: maps messages to a stable `sessionKey` and enforces serial execution
- **Agent runner**: drives the Codex conversation loop and tool usage
- **Tool executor**: runs built-in tools such as `read`, `grep`, and `bash`
- **Persistence layer**: stores SQLite state, JSONL transcripts, and `USER.md`
- **Reminder scheduler**: handles reminder-style scheduled tasks

## Session model

Recommended session key shapes:

- DM: `discord:dm:<userId>`
- Guild channel: `discord:guild:<guildId>:channel:<channelId>`
- Thread: `discord:guild:<guildId>:thread:<threadId>`

## Storage strategy

ClawNeo uses a mixed persistence approach:

- `SQLite` for structured state
- `JSONL` for append-only transcripts
- `USER.md` for human-editable profile context

Default state root:

```text
~/.clawneo
```

## Reminder path

Reminder delivery follows a dedicated system path:

```text
Natural-language reminder -> reminder skill -> scheduled task tools -> SQLite -> in-process scheduler -> Discord reminder
```

## Current status

For a more detailed and up-to-date implementation record, see:

- [ARCHITECTURE.md on GitHub](https://github.com/Tit1e/clawneo/blob/main/ARCHITECTURE.md)
