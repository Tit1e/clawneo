<template><div><h1 id="command-reference" tabindex="-1"><a class="header-anchor" href="#command-reference"><span>Command Reference</span></a></h1>
<h2 id="cli-service-commands" tabindex="-1"><a class="header-anchor" href="#cli-service-commands"><span>CLI service commands</span></a></h2>
<table>
<thead>
<tr>
<th>Command</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>clawneo start</code></td>
<td>Start the local ClawNeo service</td>
</tr>
<tr>
<td><code v-pre>clawneo stop</code></td>
<td>Stop the running service</td>
</tr>
<tr>
<td><code v-pre>clawneo restart</code></td>
<td>Restart the service</td>
</tr>
<tr>
<td><code v-pre>clawneo status</code></td>
<td>Show service status</td>
</tr>
<tr>
<td><code v-pre>clawneo ui</code></td>
<td>Open the local status UI</td>
</tr>
<tr>
<td><code v-pre>clawneo config</code></td>
<td>Open interactive configuration</td>
</tr>
</tbody>
</table>
<h2 id="model-facing-tools" tabindex="-1"><a class="header-anchor" href="#model-facing-tools"><span>Model-facing tools</span></a></h2>
<p>ClawNeo can use these built-in tools when appropriate:</p>
<table>
<thead>
<tr>
<th>Tool</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>read</code></td>
<td>Read text files and images</td>
</tr>
<tr>
<td><code v-pre>ls</code></td>
<td>List directory contents</td>
</tr>
<tr>
<td><code v-pre>grep</code></td>
<td>Search file contents</td>
</tr>
<tr>
<td><code v-pre>bash</code></td>
<td>Run shell commands</td>
</tr>
<tr>
<td><code v-pre>install_skill</code></td>
<td>Install a skill into ClawNeo</td>
</tr>
<tr>
<td><code v-pre>create_scheduled_task</code></td>
<td>Create a reminder-style scheduled task</td>
</tr>
<tr>
<td><code v-pre>list_scheduled_tasks</code></td>
<td>List reminder tasks</td>
</tr>
<tr>
<td><code v-pre>cancel_scheduled_task</code></td>
<td>Cancel a reminder task</td>
</tr>
</tbody>
</table>
<h2 id="skill-directories" tabindex="-1"><a class="header-anchor" href="#skill-directories"><span>Skill directories</span></a></h2>
<p>ClawNeo loads skills from:</p>
<ul>
<li><code v-pre>~/.clawneo/skills</code></li>
<li><code v-pre>~/.agents/skills</code></li>
</ul>
<p>Default behavior:</p>
<ul>
<li>local installs go to <code v-pre>~/.clawneo/skills</code></li>
<li>global installs go to <code v-pre>~/.agents/skills</code></li>
<li>global installation only happens when explicitly requested</li>
</ul>
</div></template>


