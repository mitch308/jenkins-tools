---
name: jkt
description: Jenkins CLI 工具集成。当用户要求触发 Jenkins 构建、查询构建状态、中止构建时使用此技能。
---

# Jenkins Tools CLI (jkt)

通过 `jkt` CLI 工具与 Jenkins 交互。

## 触发构建

- 交互式向导：`jkt` 或 `jkt run`
- 指定任务：`jkt build <job-name>`
- 直接传参：`jkt build <job-name> -p KEY=VALUE`

## 查询状态

- 最近构建记录：`jkt status`
- 指定任务：`jkt status <job-name>`
- 最近 N 次构建：`jkt status <job-name> -r <count>`
- 指定构建号：`jkt status <job-name> -n <build-number>`
- 查看日志：`jkt status <job-name> --log`

## 中止/删除

- 交互式选择：`jkt abort`
- 指定构建：`jkt abort <job-name> -n <build-number>`
- 支持取消排队中的构建

## 配置

- 初始化：`jkt config init`
- 测试连接：`jkt config test`
- 查看配置：`jkt config list`
