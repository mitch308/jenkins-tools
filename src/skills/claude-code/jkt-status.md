---
name: jkt-status
description: 查询 Jenkins 构建状态。当用户要求查看构建状态、构建结果、构建日志时使用。
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

## 查询指定构建号

```bash
jkt status <job-name> -n <build-number>
```

## 查看构建日志

```bash
jkt status <job-name> --log
```

## 使用预设别名

```bash
jkt status frontend-deploy
```

## 注意事项

- `jkt status` 无参数显示本工具触发的最近构建记录
- 构建状态图标：✔ 成功、✖ 失败、⏳ 构建中、⊘ 中止
