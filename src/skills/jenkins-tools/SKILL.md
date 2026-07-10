---
name: jenkins-tools
description: >-
  通过 jkt CLI 与 Jenkins CI/CD 服务器交互。触发构建、查询状态、中止任务、管理配置。
  当用户提到 Jenkins 相关操作时激活：构建、部署、流水线、任务状态、中止、CI/CD、Jenkins。
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
compatibility: >-
  兼容所有支持 Agent Skills Open Standard (SKILL.md) 的平台：
  Claude Code、GitHub Copilot、Cursor、Windsurf、Codex CLI、Gemini CLI 等。
---
# /jenkins-tools — Jenkins CI/CD 操作

通过 `jkt` CLI 与 Jenkins 交互。**⚠️ agent 运行在非 TTY 环境，禁止运行交互式向导。**

## 前置条件

```bash
npm install -g jenkins-tools-cli   # 安装
jkt -v                             # 验证
```

配置：`~/.jkt/.jenkinsrc.yml`（服务器/任务预设）、`~/.jkt/.jenkins-history.json`（参数历史/缓存）

## 1. 触发构建

### 步骤 1：查询参数定义

```bash
jkt params <任务名> --json           # 默认读本地缓存（快速，推荐）
jkt params <任务名> --remote --json  # 从远程 Jenkins 获取最新定义
jkt params <任务名> --sync           # 同步参数（删除已移除的 key，新增 key 用默认值）
```

`jkt params` 默认读取本地缓存，首次无缓存时自动从远程获取。

**JSON 输出关键字段**：
- `source` — `"local"`（本地缓存）/ `"remote"`（远程获取）
- `lastParams` — 上次使用的参数值（可直接用于 `-p` 传参）
- `params[]` — 参数定义（name/type/default/choices/description）
- `sync` — 同步变更信息（仅 `--sync`）：`added`/`removed`

### 步骤 2：向用户确认参数

- **有 `lastParams`**：展示上次参数值，询问用户是否修改。不修改则直接使用
- **有 `choices`**：列出选项让用户选择
- **有 `default`**：展示默认值让用户确认或修改
- **Password 类型**：提示用户输入
- 用户已明确指定所有参数值时，可跳过确认

### 步骤 3：使用 -p 传参构建

```bash
jkt build <任务名> -p key1=value1 -p key2=value2
```

**⚠️ 禁止**运行不带 `-p` 的 `jkt build <任务名>`（非 TTY 卡死）。不传任务名时 `jkt build` 等同 `jkt`（运行完整向导）。

**任务名格式**：简写 `frontend-deploy`（别名）或全路径 `frontend/deploy-main`

#### 示例

```
用户: 部署前端到生产环境

1. jkt params frontend-deploy --json
   → {source:"local", lastParams:{branch:"main",ENV:"dev"},
      params:[{name:"branch",default:"main"},{name:"ENV",choices:["dev","staging","prod"]}]}

2. 向用户确认: "上次参数: branch=main, ENV=dev，要修改哪些？"
3. 用户: "ENV 改成 prod"
4. jkt build frontend-deploy -p branch=main -p ENV=prod
```

## 2. 查询构建状态

```bash
jkt status               # 最近通过 jkt 触发的构建
jkt status <任务名>        # 任务最新构建（含参数和触发用户）
jkt status <任务名> -n 42  # 指定构建号
jkt status <任务名> -r 10  # 最近 10 次构建（含排队中）
jkt status <任务名> --log  # 构建日志
```

**状态图标**：⏳排队中 ⏳待执行 ⏳构建中 ✔成功 ✖失败 ⊘中止 ⚠不稳定

## 3. 中止/删除构建

```bash
jkt abort              # 交互式选择
jkt abort <任务名>      # 中止/删除最新构建
jkt abort <任务名> -n 42 # 指定构建号
```

排队中 → 取消排队 | 构建中 → 中止执行 | 已完成 → 删除记录

## 4. 配置管理

```bash
jkt config init          # 首次设置
jkt config add <名称>    # 添加服务器 Profile
jkt config use <名称>    # 切换默认服务器
jkt config remove <名称> # 移除服务器 Profile
jkt config test          # 测试连接
jkt config list          # 显示配置
```

## 5. 版本更新

```bash
jkt update             # 检查并更新
jkt update --check     # 仅检查
```

## 错误处理

| 错误 | 解决 |
|------|------|
| 403 禁止访问 | jkt 自动处理 CSRF |
| 连接拒绝 | `jkt config test` 诊断 |
| 任务未找到 | 用全路径 `folder/job-name` |
| 认证失败 | `jkt config init` 重新配置 |

## 参考文档

- `references/jkt-commands.md` — 完整 CLI 命令参考
- `references/configuration.md` — 详细配置文件指南
