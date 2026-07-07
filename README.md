# Jenkins Tools CLI

交互式 Jenkins CLI 工具，支持分步配置参数、触发构建、查询状态和中止任务。

## 功能

- 🧙 **交互式向导** — 4 步引导完成认证 → 选择任务 → 配置参数 → 提交构建
- 🔍 **任务搜索** — 从 Jenkins 搜索并选择任务，自动显示最近构建状态
- 📋 **参数记忆** — 自动合并 Jenkins 默认值、配置文件预设和上次使用的参数
- ✅ **选择类型参数** — 自动识别 Choice/Radio 类型参数，提供选项列表
- 📊 **构建状态** — 查看最近构建记录及实时状态，支持查看指定 Job 的最近 N 次构建历史（含排队中/待执行任务及参数信息）
- 🛑 **中止/删除** — 中止正在运行的任务、取消排队中的构建或删除已完成任务

## 安装

### 从 npm 安装（推荐）

```bash
npm install -g jenkins-tools-cli
```

### 从源码安装

```bash
```bash
git clone https://github.com/mitch308/jenkins-tools.git
cd jenkins-tools
npm install
npm run build
npm link
```

## 使用

### 交互式向导（推荐）

```bash
jkt                    # 启动交互式向导
jkt run                # 同上
jkt run --job pc-dev   # 跳过任务选择，直接配置参数
```

向导流程：
1. **认证** — 首次使用引导配置（URL / 用户名 / API Token 或密码），已配置则自动验证
2. **选择任务** — 从预配置列表选择，或搜索 Jenkins 上的任务
3. **配置参数** — 自动合并默认值，逐个展示支持修改
4. **提交执行** — 确认摘要后触发构建，返回构建号和 URL

### 快捷构建

```bash
jkt build pc-dev                           # 进入参数配置向导后构建
jkt build pc-dev -p branch=main -p ENV=prod  # 直接传参构建
```

### 查询状态

```bash
jkt status               # 显示最近由本工具触发的构建记录
jkt status pc-dev        # 查询指定 Job 的最近构建状态
jkt status pc-dev -n 42  # 查询指定构建号（支持排队中/待执行状态）
jkt status pc-dev -r 10  # 查看最近 10 次构建记录（含排队中任务及参数）
jkt status pc-dev --log  # 查看构建日志
```

构建状态图标：

| 图标 | 含义 |
|------|------|
| ⏳ 排队中 | 在队列中等待执行器 |
| ⏳ 待执行 | 已分配构建号，等待执行器启动 |
| ⏳ 构建中 | 正在执行 |
| ✔ | 成功 |
| ✖ | 失败 |
| ⊘ | 中止 |
| ⚠ | 不稳定 |

### 中止/删除任务

```bash
jkt abort              # 选择要中止或删除的构建
jkt abort pc-dev       # 中止/删除指定 Job 的最近构建
jkt abort pc-dev -n 42 # 中止/删除指定构建号
```

- 排队中的任务 → 取消排队
- 正在构建的任务 → 中止
- 已完成的任务 → 删除记录

### 配置管理

```bash
jkt config init    # 交互式初始化配置文件
jkt config test    # 测试 Jenkins 连接
jkt config list    # 列出服务器和任务配置
```

## 配置

配置文件统一存放在 `~/.jkt/` 目录下，全局安装后在任意目录运行 `jkt` 均可访问：

```
~/.jkt/
  .jenkinsrc.yml          # 服务器配置和任务预设
  .jenkins-history.json   # 参数历史和构建记录
```

首次运行 `jkt` 或 `jkt config init` 会自动创建配置目录和文件。

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
  backend-test:
    server: staging
    name: backend/run-tests
```

支持 **API Token** 和 **用户名密码** 两种认证方式。

### 参数合并优先级

构建参数按以下优先级合并（后者覆盖前者）：

1. Jenkins 参数定义的默认值
2. `~/.jkt/.jenkinsrc.yml` 中预设的参数值
3. `~/.jkt/.jenkins-history.json` 中最近一次使用的参数值

## 开发

```bash
npm install       # 安装依赖
npm run dev       # 监听模式编译
npm run build     # 编译
npm start         # 运行
npm link          # 全局安装（开发用）
```

## Agent/IDE Skills

安装时自动提示安装 Agent/IDE Skills，支持：

- **Claude Code** → `.claude/commands/jkt-*.md`（slash 命令）、`.claude/skills/jkt/`（技能）、`.claude/agents/jkt.md`（子代理）
- **Cursor** → `.cursor/rules/jkt.mdc`（规则）、`.cursor/skills/jkt/`（技能）、`.cursor/agents/jkt.md`（子代理）
- **Codex** → `AGENTS.md` 追加章节（幂等替换）
- **OpenCode** → `.opencode/agents/jkt.md`（代理定义）、`opencode.json` agent 字段合并（幂等）

也可手动运行：

```bash
jkt setup-skills       # 重新选择平台并安装
```

安装后，Agent 可以通过自然语言触发 Jenkins 操作，如"帮我构建 pc-dev"。

> ⚠️ **注意**：Agent/IDE Skills 功能尚未经过完整测试验证，各平台兼容性可能存在问题，欢迎反馈。

## License

MIT
