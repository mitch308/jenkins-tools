---
name: jkt
description: Jenkins CLI 工具集成。当用户要求触发 Jenkins 构建、查询构建状态、中止构建、管理 Jenkins 配置时使用此技能。
---

# Jenkins Tools CLI (jkt)

通过 `jkt` CLI 工具与 Jenkins 交互。

## 触发构建

当用户要求构建、部署、打包时：

- 交互式向导：`jkt` 或 `jkt run`
- 指定任务：`jkt build <job-name>`
- 直接传参：`jkt build <job-name> -p KEY=VALUE`
- 使用别名：`jkt build frontend-deploy -p ENV=production`

## 查询状态

当用户要求查看构建状态、结果、日志、历史时：

- 最近构建记录：`jkt status`
- 指定任务状态：`jkt status <job-name>`
- 最近 N 次构建：`jkt status <job-name> -r <count>`
- 指定构建号：`jkt status <job-name> -n <build-number>`
- 查看日志：`jkt status <job-name> --log`

## 中止/删除

当用户要求停止、取消、删除构建时：

- 交互式选择：`jkt abort`
- 指定构建：`jkt abort <job-name> -n <build-number>`
- 支持取消排队中的构建（自动从 Jenkins 队列查找）

## 配置管理

当用户要求配置 Jenkins 连接时：

- 初始化：`jkt config init`
- 测试连接：`jkt config test`
- 查看配置：`jkt config list`

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

## 注意事项

- 首次使用需运行 `jkt config init` 配置连接
- 支持任务别名（在 `.jenkinsrc.yml` 中配置）
- 构建完成后会输出构建号和 URL
- 排队中的构建可取消，构建中的可中止，已完成的可删除
