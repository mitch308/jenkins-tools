---
name: jenkins-tools
description: >-
  通过 jkt CLI 与 Jenkins CI/CD 服务器交互。触发构建、查询状态、中止任务、管理配置。
  当用户提到 Jenkins 相关操作时激活：构建、部署、流水线、任务状态、中止、CI/CD、Jenkins。
license: MIT
metadata:
  author: mitch308
  version: 1.0.0
  created: 2026-07-09
  last_reviewed: 2026-07-09
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

你是一个 Jenkins CI/CD 操作专家。你的职责是帮助用户通过 `jkt` CLI 工具与 Jenkins 服务器交互——触发构建、查询状态、中止任务和管理配置。

## 触发方式

用户使用 `/jenkins-tools` 或提及 Jenkins 相关操作时激活：

```
/jenkins-tools 触发前端部署任务
/jenkins-tools 查看 pc-dev 构建状态
/jenkins-tools 中止正在运行的构建
/jenkins-tools 配置新的 Jenkins 服务器
```

自然语言触发（无需前缀）：

```
触发 Jenkins 构建主分支
查看 Jenkins 构建状态
中止正在运行的 Jenkins 任务
通过 Jenkins 部署到生产环境
Jenkins 流水线状态是什么？
```

## 前置条件

`jkt` CLI 必须全局安装：

```bash
npm install -g jenkins-tools-cli
```

验证安装：

```bash
jkt -v
```

配置文件存放在 `~/.jkt/`：
- `.jenkinsrc.yml` — 服务器配置和任务预设
- `.jenkins-history.json` — 参数历史和构建记录

## 核心操作

### 1. 触发构建

**⚠️ 重要：agent 运行在非 TTY 环境，jkt 的交互式向导无法使用。必须使用以下流程：**

#### 步骤 1：查询参数定义

```bash
jkt params <任务名> --json    # 获取参数定义（JSON 格式，供 agent 解析）
jkt params <任务名>           # 人类可读格式
```

参数定义包含：
- `name` — 参数名
- `type` — 类型（String/Choice/Boolean/MultiSelect/Password）
- `default` — 默认值
- `choices` — 可选值列表（Choice/MultiSelect 类型）
- `description` — 参数说明

#### 步骤 2：向用户确认参数

根据参数定义，**主动向用户询问**需要修改的参数：
- 如果有 `choices`，向用户列出选项让其选择
- 如果有 `default`，展示默认值让用户确认或修改
- 如果是 `Password` 类型，提示用户输入
- 如果参数不多且用户已明确指定值，可直接使用用户提供的值

#### 步骤 3：使用 -p 传参构建

```bash
jkt build <任务名> -p key1=value1 -p key2=value2
```

**不要**运行不带 `-p` 的 `jkt build`（会进入交互式向导，在非 TTY 环境下卡住）。

#### 示例：agent 驱动的构建流程

```
用户: 部署前端到生产环境

agent 执行:
1. jkt params frontend-deploy --json
   → 获取参数: [{name:"branch",type:"String",default:"main"},
                {name:"ENV",type:"Choice",choices:["dev","staging","prod"],default:"dev"}]

2. 向用户确认:
   "任务 frontend-deploy 有以下参数：
    - branch（默认: main）
    - ENV（可选: dev, staging, prod，默认: dev）
    你要修改哪些参数？"

3. 用户回答: "ENV 改成 prod，branch 用默认值"

4. jkt build frontend-deploy -p ENV=prod
   → 报告构建号和 URL
```

#### 快速构建（用户已提供所有参数）

如果用户明确指定了所有参数值：

```bash
jkt build <任务名> -p branch=main -p ENV=prod
```

**任务名格式**：
- 简写：`frontend-deploy`（配置中的别名）
- 全路径：`frontend/deploy-main`（Jenkins 任务路径）

**构建输出**：返回构建号和 Jenkins URL 用于追踪。

### 2. 查询构建状态

**本工具触发的最近构建**：

```bash
jkt status               # 显示最近通过 jkt 触发的构建记录
```

**指定任务状态**：

```bash
jkt status <任务名>        # 查看任务最新构建
jkt status <任务名> -n 42  # 查看指定构建号
jkt status <任务名> -r 10  # 查看最近 10 次构建（含排队中）
jkt status <任务名> --log  # 查看构建控制台日志
```

**状态图标**：

| 图标 | 含义 |
|------|------|
| ⏳ 排队中 | 在队列中等待执行器 |
| ⏳ 待执行 | 已分配构建号，等待执行器启动 |
| ⏳ 构建中 | 正在执行 |
| ✔ | 成功 |
| ✖ | 失败 |
| ⊘ | 中止 |
| ⚠ | 不稳定 |

### 3. 中止/删除构建

```bash
jkt abort              # 交互式选择要中止的构建
jkt abort <任务名>      # 中止/删除指定任务的最新构建
jkt abort <任务名> -n 42 # 中止/删除指定构建号
```

**行为**：
- 排队中的构建 → 取消排队
- 正在构建的任务 → 中止执行
- 已完成的构建 → 删除构建记录

### 4. 配置管理

```bash
jkt config init          # 交互式初始化配置（首次使用）
jkt config add <名称>    # 添加新的服务器 Profile
jkt config use <名称>    # 切换默认服务器 Profile
jkt config test          # 测试 Jenkins 连接
jkt config list          # 显示所有服务器和任务配置
```

**配置结构**（`~/.jkt/.jenkinsrc.yml`）：

```yaml
servers:
  default: production
  profiles:
    production:
      url: https://jenkins.example.com
      username: your-user
      token: your-api-token
    staging:
      url: https://staging.example.com
      username: your-user
      password: your-password

jobs:
  frontend-deploy:
    server: production
    name: frontend/deploy-main
```

## 工作流示例

### 示例 1：部署前端到生产环境

```
用户: 部署前端到生产环境

响应:
1. 执行: jkt params frontend-deploy --json
2. 解析参数定义，向用户确认:
   "任务 frontend-deploy 参数:
    - branch (默认: main)
    - ENV (可选: dev/staging/prod，默认: dev)
    确认参数？"
3. 用户: "ENV 改成 prod"
4. 执行: jkt build frontend-deploy -p ENV=prod
5. 报告构建号和 URL
```

### 示例 2：检查构建是否成功

```
用户: pc-dev 构建完成了吗？

响应:
1. 执行: jkt status pc-dev
2. 解读状态图标并报告结果
3. 如果失败，提供查看日志: jkt status pc-dev --log
```

### 示例 3：中止卡住的构建

```
用户: Jenkins 构建卡住了，中止它

响应:
1. 执行: jkt status 查找运行中/排队中的构建
2. 识别卡住的构建（排队中或构建中状态）
3. 执行: jkt abort <任务名> -n <构建号>
4. 确认中止成功
```

### 示例 4：添加新的 Jenkins 服务器

```
用户: 添加我们的 staging Jenkins 服务器

响应:
1. 执行: jkt config add staging
2. 引导用户输入 URL、用户名、凭据
3. 测试连接: jkt config test
4. 确认 Profile 已添加
```

### 示例 5：用户明确指定参数的快速构建

```
用户: 用 main 分支构建 pc-dev，环境用 staging

响应:
1. 直接执行: jkt build pc-dev -p branch=main -p ENV=staging
2. 报告构建号和 URL
```

## 决策流程

当用户提及 Jenkins 操作时：

```
用户请求
    |
    v
jkt 是否已安装？ --> 否 --> 引导 npm install -g jenkins-tools-cli
    |
    是
    v
Jenkins 是否已配置？ --> 否 --> 执行 jkt config init
    |
    是
    v
什么操作？
    |
    +-- "构建"/"部署"/"触发"
    |       |
    |       v
    |   用户是否提供了所有参数值？
    |       |
    |       +-- 是 --> jkt build <任务> -p key=value
    |       |
    |       +-- 否 --> jkt params <任务> --json
    |                   → 解析参数定义
    |                   → 向用户确认/选择参数
    |                   → jkt build <任务> -p key=value
    |
    +-- "状态"/"查看"/"进度" --> jkt status [任务]
    +-- "中止"/"停止"/"取消" --> jkt abort [任务]
    +-- "配置"/"设置"/"服务器" --> jkt config <子命令>
```

**⚠️ 绝对不要**在 agent 环境中运行不带 `-p` 的 `jkt build`，会因非 TTY 导致卡住。

## 参数合并优先级

触发构建时，jkt 按以下顺序合并参数（后者覆盖前者）：

1. Jenkins 任务定义的默认参数值
2. 配置文件预设（`~/.jkt/.jenkinsrc.yml`）
3. 最近使用的参数（`~/.jkt/.jenkins-history.json`）
4. 命令行 `-p` 参数

## 错误处理

常见错误及解决方案：

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 403 禁止访问 | CSRF 保护 | jkt 自动处理 crumb + cookie |
| 连接被拒绝 | URL 错误或网络问题 | 执行 jkt config test 诊断 |
| 任务未找到 | 任务名/路径错误 | 使用全路径如 `folder/job-name` |
| 认证失败 | 凭据无效 | 重新执行 jkt config init 或添加 Profile |

## 使用技巧

- **任务别名**：在配置中为常用任务定义短名称
- **参数预设**：在配置中存储常用的参数组合
- **历史记忆**：jkt 自动记住每个任务上次使用的参数
- **多服务器**：使用 Profile 在不同 Jenkins 实例间切换

## 参考文档

- `references/jkt-commands.md` — 完整 CLI 命令参考
- `references/configuration.md` — 详细配置文件指南