---
name: jkt-abort
description: 中止或删除 Jenkins 构建。当用户要求停止、取消、中止或删除构建任务时使用。
---

# 中止/删除 Jenkins 构建

使用 `jkt` CLI 工具中止正在运行的构建或删除已完成的构建记录。

## 交互式选择

```bash
jkt abort
```

展示最近构建列表供选择。正在构建的任务可以中止，已完成的任务可以删除。

## 指定构建号

```bash
jkt abort -n <build-number>
```

需要配合最近使用的任务（从历史记录中获取）。

## 注意事项

- 正在构建的任务 → 中止（stop）
- 已完成的任务 → 可选择删除（delete from Jenkins）
- 操作不可逆，确认后再执行
