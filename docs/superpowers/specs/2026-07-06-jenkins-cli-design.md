# Jenkins CLI 工具库设计文档

## 概述

一个基于 Node.js/TypeScript 的 Jenkins CLI 交互式工具，支持分步配置参数、触发构建和查询构建状态。核心体验是交互式向导模式，引导用户完成认证 → 选择任务 → 配置参数 → 提交执行的全流程。

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全，适合工具开发 |
| CLI 框架 | Commander.js | 成熟稳定，子命令支持好 |
| 交互提示 | Inquirer | 丰富的交互类型，社区标准 |
| Jenkins API | jenkins-api | 开箱即用，减少 API 封装 |
| 配置格式 | YAML (js-yaml) | 可读性好，适合配置文件 |
| 输出美化 | chalk + ora | 彩色输出 + 加载动画 |

## 核心流程：交互式向导

### Step 1: 认证

1. 检查 `.jenkinsrc.yml` 中是否已配置 server profile
2. 已配置 → 用默认 profile 验证连接
   - 通过 → 进入 Step 2
   - 失败 → 提示错误，选择：重新配置 / 切换 profile / 退出
3. 未配置 → 引导用户输入：
   - Jenkins URL
   - 用户名
   - 认证方式：API Token 或 密码
   - 保存到 `.jenkinsrc.yml`

### Step 2: 选择构建任务

1. 展示已配置的任务列表（带序号）：
   ```
   ? 选择要执行的构建任务:
   ❯ 1. frontend-deploy (frontend/deploy-main) [production]
     2. backend-test (backend/run-tests) [staging]
     3. 手动输入任务名称
   ```
2. 选择已有任务 → 直接进入 Step 3
3. 选择手动输入 → 提示输入 Jenkins job 路径 → 进入 Step 3

### Step 3: 配置构建参数

1. 调用 Jenkins API 查询选中任务的参数定义
2. 参数合并逻辑（优先级从低到高）：
   - Jenkins 参数定义的默认值
   - `.jenkinsrc.yml` 中预设的参数值
   - `.jenkins-history.json` 中最近一次的参数值
3. 逐个展示参数，支持修改：
   ```
   ? ENV (默认: production): [回车保留，输入修改]
   ? BRANCH (默认: main): feature/new-ui
   ? TIMEOUT (默认: 30):
   ```
4. 修改后的参数自动保存到 `.jenkins-history.json`

### Step 4: 提交执行

1. 展示执行摘要：
   ```
   ┌──────────────────────────────────┐
   │ 构建任务: frontend/deploy-main   │
   │ 服务器:   production             │
   │ 参数:                            │
   │   ENV     = production           │
   │   BRANCH  = feature/new-ui       │
   │   TIMEOUT = 30                   │
   └──────────────────────────────────┘
   ```
2. 确认执行 → 提交构建 → 返回构建号和队列 URL
3. 取消 → 返回 Step 3

## 项目结构

```
jenkins-tools/
├── src/
│   ├── index.ts                # CLI 入口
│   ├── commands/
│   │   ├── run.ts              # 交互式向导主命令
│   │   ├── build.ts            # 快捷构建命令
│   │   ├── status.ts           # 构建状态查询
│   │   └── config.ts           # 配置管理命令
│   ├── services/
│   │   └── jenkins.ts          # Jenkins API 封装
│   ├── config/
│   │   ├── loader.ts           # 配置文件加载
│   │   ├── schema.ts           # 配置结构定义
│   │   └── store.ts            # 最近参数持久化
│   ├── wizard/
│   │   ├── auth.ts             # Step 1: 认证
│   │   ├── job-select.ts       # Step 2: 任务选择
│   │   ├── params.ts           # Step 3: 参数配置
│   │   └── execute.ts          # Step 4: 提交执行
│   └── utils/
│       ├── output.ts           # 输出格式化
│       └── prompt.ts           # 交互提示封装
├── .jenkinsrc.yml              # 配置文件（用户创建）
├── .jenkins-history.json       # 最近参数记录（自动生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 配置文件格式

### .jenkinsrc.yml

```yaml
servers:
  default: production
  profiles:
    production:
      url: https://jenkins.example.com
      username: your-user
      token: your-api-token
    staging:
      url: https://staging-jenkins.example.com
      username: your-user
      password: your-password

jobs:
  frontend-deploy:
    server: production
    name: frontend/deploy-main
  backend-test:
    server: staging
    name: backend/run-tests
```

### .jenkins-history.json（自动维护）

```json
{
  "frontend/deploy-main": {
    "lastParams": {
      "ENV": "production",
      "BRANCH": "main"
    },
    "lastRun": "2026-07-06T10:30:00Z"
  }
}
```

## CLI 命令

```
jkt                              # 启动交互式向导（默认命令）
jkt run                          # 同上
jkt run --job frontend-deploy    # 跳过 Step 2
jkt build <job> -p KEY=VALUE     # 快捷模式：直接触发
jkt status <job>                 # 查询构建状态
jkt status <job> --number 42     # 指定构建号
jkt status <job> --log           # 查看构建日志
jkt config init                  # 初始化配置文件
jkt config test                  # 测试连接
jkt config list                  # 列出配置
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| 网络超时/连接失败 | 友好提示，建议检查 URL 和网络 |
| 认证失败 | 提示检查凭据，引导重新配置 |
| Job 不存在 | 提示任务路径可能有误 |
| 参数缺失 | 标记必填参数，阻止提交 |
| 配置文件损坏 | 提示修复或重新初始化 |

## 依赖

- commander — CLI 框架
- inquirer — 交互式提示
- jenkins-api — Jenkins API 客户端
- js-yaml — YAML 解析
- chalk — 彩色输出
- ora — 加载动画
- conf — 简单配置持久化（用于 history）
