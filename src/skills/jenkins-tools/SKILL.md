---
name: jenkins-tools
description: >-
  jkt CLI 操作 Jenkins：构建、状态、中止、配置。触发词：Jenkins、构建、部署、流水线、CI/CD。
license: MIT
metadata:
  author: mitch308
  version: 2.0.0
  created: 2026-07-09
  last_reviewed: 2026-07-10
  review_interval_days: 90
  dependencies:
    - url: https://www.npmjs.com/package/jenkins-tools-cli
      name: jenkins-tools-cli
      type: npm-package
---
# /jenkins-tools

通过 `jkt` CLI 与 Jenkins 交互。**⚠️ agent 非 TTY 环境，禁止运行交互式向导。**

## 前置

```bash
npm install -g jenkins-tools-cli   # 安装
jkt -v                             # 验证
```

配置：`~/.jkt/.jenkinsrc.yml`（服务器/任务预设）、`~/.jkt/.jenkins-history.json`（参数历史/缓存）

## 命令速查

| 操作 | 命令 |
|------|------|
| 构建向导 | `jkt` 或 `jkt build` |
| 快捷构建 | `jkt build <任务> -p K=V` |
| 查参数 | `jkt params <任务> --json` |
| 远程参数 | `jkt params <任务> --remote --json` |
| 同步参数 | `jkt params <任务> --sync` |
| 查状态 | `jkt status [任务]` |
| 查日志 | `jkt status <任务> --log` |
| 中止 | `jkt abort [任务] [-n N]` |
| 配置 | `jkt config init\|add\|use\|test\|list` |
| 更新 | `jkt update [--check]` |

**⚠️ 禁止**运行不带 `-p` 的 `jkt build <任务>`（非 TTY 卡死）。

## 构建流程

1. `jkt params <任务> --json` → 获取参数（默认读本地缓存）
2. 若有 `lastParams`，展示上次参数询问用户是否修改；否则展示 `params` 中的 `default`/`choices`
3. 用户确认后 `jkt build <任务> -p K1=V1 -p K2=V2`

### params --json 输出

```json
{"name":"job","buildable":true,"source":"local","lastParams":{"branch":"main"},
 "params":[{"name":"branch","type":"String","default":"main","choices":null},
           {"name":"ENV","type":"Choice","choices":["dev","staging","prod"],"default":"dev"}]}
```

- `source`: `"local"`(缓存) / `"remote"`(远程)
- `lastParams`: 上次使用的值，可直接用于 `-p` 传参
- `--remote`: 从 Jenkins 获取最新定义并更新缓存
- `--sync`: 同步 key 变更（删已移除 key，新增 key 用默认值）

## 状态图标

⏳排队中 ⏳待执行 ⏳构建中 ✔成功 ✖失败 ⊘中止 ⚠不稳定

## 错误

| 错误 | 解决 |
|------|------|
| 403 | jkt 自动处理 CSRF |
| 连接拒绝 | `jkt config test` 诊断 |
| 任务未找到 | 用全路径 `folder/job-name` |
| 认证失败 | `jkt config init` 重新配置 |
