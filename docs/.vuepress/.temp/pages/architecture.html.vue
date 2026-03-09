<template><div><h1 id="architecture-overview" tabindex="-1"><a class="header-anchor" href="#architecture-overview"><span>Architecture Overview</span></a></h1>
<p>ClawNeo is intentionally smaller than a general-purpose multi-agent platform. Its core execution path is:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">Discord -> Session -> Codex -> Tools -> Reply -> Persistent context</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><h2 id="core-modules" tabindex="-1"><a class="header-anchor" href="#core-modules"><span>Core modules</span></a></h2>
<ul>
<li><strong>Discord adapter</strong>: receives and sends Discord messages</li>
<li><strong>Session service</strong>: maps messages to a stable <code v-pre>sessionKey</code> and enforces serial execution</li>
<li><strong>Agent runner</strong>: drives the Codex conversation loop and tool usage</li>
<li><strong>Tool executor</strong>: runs built-in tools such as <code v-pre>read</code>, <code v-pre>grep</code>, and <code v-pre>bash</code></li>
<li><strong>Persistence layer</strong>: stores SQLite state, JSONL transcripts, and <code v-pre>USER.md</code></li>
<li><strong>Reminder scheduler</strong>: handles reminder-style scheduled tasks</li>
</ul>
<h2 id="session-model" tabindex="-1"><a class="header-anchor" href="#session-model"><span>Session model</span></a></h2>
<p>Recommended session key shapes:</p>
<ul>
<li>DM: <code v-pre>discord:dm:&lt;userId&gt;</code></li>
<li>Guild channel: <code v-pre>discord:guild:&lt;guildId&gt;:channel:&lt;channelId&gt;</code></li>
<li>Thread: <code v-pre>discord:guild:&lt;guildId&gt;:thread:&lt;threadId&gt;</code></li>
</ul>
<h2 id="storage-strategy" tabindex="-1"><a class="header-anchor" href="#storage-strategy"><span>Storage strategy</span></a></h2>
<p>ClawNeo uses a mixed persistence approach:</p>
<ul>
<li><code v-pre>SQLite</code> for structured state</li>
<li><code v-pre>JSONL</code> for append-only transcripts</li>
<li><code v-pre>USER.md</code> for human-editable profile context</li>
</ul>
<p>Default state root:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">~/.clawneo</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><h2 id="reminder-path" tabindex="-1"><a class="header-anchor" href="#reminder-path"><span>Reminder path</span></a></h2>
<p>Reminder delivery follows a dedicated system path:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">Natural-language reminder -> reminder skill -> scheduled task tools -> SQLite -> in-process scheduler -> Discord reminder</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><h2 id="current-status" tabindex="-1"><a class="header-anchor" href="#current-status"><span>Current status</span></a></h2>
<p>For a more detailed and up-to-date implementation record, see:</p>
<ul>
<li><a href="https://github.com/Tit1e/clawneo/blob/main/ARCHITECTURE.md" target="_blank" rel="noopener noreferrer">ARCHITECTURE.md on GitHub</a></li>
</ul>
</div></template>


