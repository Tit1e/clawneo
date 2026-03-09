<template><div><h1 id="quick-start" tabindex="-1"><a class="header-anchor" href="#quick-start"><span>Quick Start</span></a></h1>
<h2 id="install" tabindex="-1"><a class="header-anchor" href="#install"><span>Install</span></a></h2>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">npm</span> <span class="token function">install</span> <span class="token parameter variable">-g</span> clawneo</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><h2 id="upgrade" tabindex="-1"><a class="header-anchor" href="#upgrade"><span>Upgrade</span></a></h2>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">npm</span> <span class="token function">install</span> <span class="token parameter variable">-g</span> clawneo@latest</span>
<span class="line">clawneo restart</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="basic-cli-commands" tabindex="-1"><a class="header-anchor" href="#basic-cli-commands"><span>Basic CLI commands</span></a></h2>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line">clawneo <span class="token parameter variable">-h</span></span>
<span class="line">clawneo <span class="token parameter variable">--help</span></span>
<span class="line">clawneo <span class="token parameter variable">-v</span></span>
<span class="line">clawneo <span class="token parameter variable">--version</span></span>
<span class="line">clawneo config</span>
<span class="line">clawneo start</span>
<span class="line">clawneo stop</span>
<span class="line">clawneo restart</span>
<span class="line">clawneo status</span>
<span class="line">clawneo ui</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h2 id="local-status-ui" tabindex="-1"><a class="header-anchor" href="#local-status-ui"><span>Local status UI</span></a></h2>
<p>After the service starts, open:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">http://127.0.0.1:3210</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><h2 id="discord-system-commands" tabindex="-1"><a class="header-anchor" href="#discord-system-commands"><span>Discord system commands</span></a></h2>
<p>ClawNeo supports both plain-text <code v-pre>/xxx</code> messages and native Discord slash commands.</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">/help</span>
<span class="line">/status</span>
<span class="line">/cancel</span>
<span class="line">/update</span>
<span class="line">/restart</span>
<span class="line">/stop</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><p>Notes:</p>
<ul>
<li><code v-pre>/cancel</code> aborts the current running task in the current Discord session</li>
<li><code v-pre>/update</code> updates ClawNeo in the background and restarts the service</li>
<li><code v-pre>/stop</code> takes the bot offline until you start it again</li>
</ul>
<h2 id="reminder-tasks" tabindex="-1"><a class="header-anchor" href="#reminder-tasks"><span>Reminder tasks</span></a></h2>
<p>Examples:</p>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">20 minutes later remind me to check the logs</span>
<span class="line">every day at 8 remind me to clock in</span>
<span class="line">what reminders do I have</span>
<span class="line">cancel the latest reminder</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></div></template>


