---
description: 中止或删除 Jenkins 构建。当用户要求停止、取消、中止或删除构建任务时使用。
---

# 中止/删除 Jenkins 构建

使用 `jkt` CLI 工具中止正在运行的构建或删除已完成的构建记录。

## 交互式选择

```bash
jkt abort
```

展示最近构建列表供选择。正在构建的任务可以中止，已完成的任务可以删除，排队中的任务可以取消。

## 指定任务和构建号

```bash
jkt abort <job-name> -n <build-number>
```

中止指定任务指定构建号的构建。

## 仅指定任务

```bash
jkt abort <job-name>
```

自动查询该任务最近的构建并操作。

## 操作逻辑

| 构建状态 | 操作 |
|----------|------|
| 构建中 | 中止（stop） |
| 排队中 | 取消排队（cancelQueue） |
| 已完成 | 可选择删除（delete from Jenkins） |

## 注意事项

- 操作不可逆，确认后再执行
- 排队中（未开始执行）的构建会自动从 Jenkins 队列中查找并取消
- 支持使用 `.jenkinsrc.yml` 中配置的任务别名
