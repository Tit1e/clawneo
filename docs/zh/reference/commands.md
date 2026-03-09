# 命令参考

## CLI 服务命令

| 命令 | 说明 |
| --- | --- |
| `clawneo start` | 启动本地 ClawNeo 服务 |
| `clawneo stop` | 停止正在运行的服务 |
| `clawneo restart` | 重启服务 |
| `clawneo status` | 查看服务状态 |
| `clawneo ui` | 打开本地状态 UI |
| `clawneo config` | 打开交互式配置 |

## 面向模型的内置工具

ClawNeo 会在合适时机使用以下内置工具：

| 工具 | 说明 |
| --- | --- |
| `read` | 读取文本文件和图片 |
| `ls` | 列出目录内容 |
| `grep` | 搜索文件内容 |
| `bash` | 执行 shell 命令 |
| `install_skill` | 安装技能到 ClawNeo |
| `create_scheduled_task` | 创建提醒式定时任务 |
| `list_scheduled_tasks` | 列出提醒任务 |
| `cancel_scheduled_task` | 取消提醒任务 |

## 技能目录

ClawNeo 会从以下目录加载技能：

- `~/.clawneo/skills`
- `~/.agents/skills`

默认行为：

- 本地安装会进入 `~/.clawneo/skills`
- 全局安装会进入 `~/.agents/skills`
- 只有在用户明确要求时才进行全局安装
