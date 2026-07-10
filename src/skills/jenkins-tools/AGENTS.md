# Jenkins Tools — Agent 指令

通过 `jkt` CLI 与 Jenkins 交互。**⚠️ 非 TTY 环境，禁止运行不带 `-p` 的 `jkt build <任务>`。**

| 操作 | 命令 |
|------|------|
| 查参数 | `jkt params <任务> --json` |
| 快捷构建 | `jkt build <任务> -p K=V` |
| 远程参数 | `jkt params <任务> --remote --json` |
| 同步参数 | `jkt params <任务> --sync` |
| 查状态 | `jkt status [任务]` |
| 查日志 | `jkt status <任务> --log` |
| 中止 | `jkt abort [任务] [-n N]` |
| 配置 | `jkt config init\|add\|use\|test\|list` |
| 更新 | `jkt update [--check]` |

前置：`npm install -g jenkins-tools-cli`，配置在 `~/.jkt/`。完整文档见 `SKILL.md`。
