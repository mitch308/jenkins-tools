---
description: 查询 Jenkins 构建状态。当用户要求查看构建状态、构建结果、构建日志、构建历史时使用。
---

# 查询 Jenkins 构建状态

使用 `jkt` CLI 工具查询 Jenkins 构建状态。

## 查看最近构建记录

```bash
jkt status
```

展示最近由本工具触发的构建记录，包含实时状态。

## 查询指定任务状态

```bash
jkt status <job-name>
```

显示该任务最近一次构建的状态、URL 和耗时。

## 查询指定构建号

```bash
jkt status <job-name> -n <build-number>
```

## 查看最近 N 次构建记录

```bash
jkt status <job-name> -r <count>
```

查询某任务在 Jenkins 上的最近 N 次构建记录列表，包含构建号、状态、时间和耗时。例如：

```bash
jkt status pc-dev -r 10
```

## 查看构建日志

```bash
jkt status <job-name> --log
```

或指定构建号查看日志：

```bash
jkt status <job-name> -n <build-number> --log
```

## 使用预设别名

```bash
jkt status frontend-deploy
```

## 状态图标

| 图标 | 含义 |
|------|------|
| ⏳ 排队中 | 在队列中等待执行器 |
| ⏳ 待执行 | 已分配构建号，等待执行器启动 |
| ⏳ 构建中 | 正在执行 |
| ✔ | 成功 |
| ✖ | 失败 |
| ⊘ | 中止 |
| ⚠ | 不稳定 |
| ○ | 未构建 |

## 查询排队中/待执行构建

`jkt status <job> -n <number>` 支持查询排队中和待执行状态的构建，会自动回退到队列 API 查找。
