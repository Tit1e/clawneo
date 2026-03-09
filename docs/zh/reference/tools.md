# 工具参考

ClawNeo 提供一组精简的内置工具，用于处理本地文件、代码、shell 命令、技能以及提醒任务。

工具层刻意保持收敛：既足够实用，能覆盖日常使用场景，也比大型插件系统更容易理解和控制。

## 文件与搜索工具

### `read`

读取文件内容。

典型用途：

- 查看源代码文件
- 读取 markdown、JSON 或配置文件
- 打开 `jpg`、`png`、`gif`、`webp` 等图片
- 对大文件按 offset 与 limit 分段读取

行为说明：

- 文本输出在文件很大时会被截断
- 图片会以附件形式返回，而不是原始文本
- 支持相对路径和绝对路径

### `ls`

列出目录内容。

典型用途：

- 查看仓库结构
- 确认生成文件是否存在
- 找到下一步要打开的文件

行为说明：

- 目录会以 `/` 结尾显示
- 包含 dotfiles
- 超大目录输出会被截断

### `grep`

搜索文件内容。

典型用途：

- 查找符号、命令、环境变量或报错字符串
- 定位配置字段
- 查看某段内容在整个代码库中的使用位置

行为说明：

- 遵循 `.gitignore`
- 支持正则和字面量匹配
- 可通过 `glob` 过滤文件
- 可返回匹配行周围的上下文

## Shell 工具

### `bash`

在已配置的工作目录中执行 shell 命令。

典型用途：

- 运行构建或测试
- 查看 git 状态或 diff
- 执行有针对性的项目命令

行为说明：

- 默认超时时间有限制
- 最大超时时间受上限控制
- 输出捕获大小有限制
- ClawNeo 更偏好 Unix shell，当前不支持 Windows 下的工具执行

Shell 解析顺序：

1. `CLAWNEO_SHELL`
2. `zsh`
3. `bash`
4. `sh`

### `bash` 的安全模型

ClawNeo 会阻止一些明显危险的命令模式，包括：

- 关机或重启
- 破坏性磁盘格式化
- 危险的 `dd if=` 用法
- `rm -rf /`
- fork bomb

除硬性拦截模式外，高风险文件系统操作也应在执行前获得用户明确确认。

## 技能管理工具

### `install_skill`

安装技能到 ClawNeo。

支持来源：

- 本地路径
- GitHub 仓库短写，如 `owner/repo`
- 完整 git URL

安装目标：

- 默认：`~/.clawneo/skills`
- 全局：`~/.agents/skills`

重要规则：

- 只有在用户明确要求时才应使用全局安装

## 提醒任务工具

### `create_scheduled_task`

为当前 Discord 对话创建提醒式定时任务。

支持：

- 单次提醒
- 周期性提醒
- 显式时区或机器默认时区

### `list_scheduled_tasks`

列出当前用户或当前会话的提醒任务。

常用过滤条件：

- scope：`user` 或 `session`
- status：`active`、`delivering`、`done`、`cancelled`、`failed`

### `cancel_scheduled_task`

按 ID 取消提醒任务，或取消当前会话中最近的一个活跃提醒。

## 实际边界

ClawNeo 工具的设计目标是：

- 仓库检查
- 轻量自动化
- 有针对性的 shell 执行
- 本地技能安装
- Discord 中的提醒调度

它们并不是：

- 完整的容器沙箱
- 默认提供的浏览器自动化套件
- 分布式 worker 系统
- 无限制的远程执行平台

## 相关页面

- [命令参考](/zh/reference/commands)
- [快速开始](/zh/guide/quick-start)
- [架构概览](/zh/architecture)
