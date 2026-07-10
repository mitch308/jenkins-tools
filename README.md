# Jenkins Tools CLI

交互式 Jenkins CLI 工具，支持分步配置参数、触发构建、查询状态和中止任务。

## 功能

- 🧙 **交互式向导** — 4 步引导完成认证 → 选择任务 → 配置参数 → 提交构建
- 🔍 **任务搜索** — 从 Jenkins 搜索并选择任务，自动显示最近构建状态
- 📋 **参数记忆** — 自动合并 Jenkins 默认值、配置文件预设和上次使用的参数
- 💾 **本地缓存** — 参数定义自动缓存到本地，快速查询且可离线使用，支持远程同步
- ✅ **选择类型参数** — 自动识别 Choice/Radio 类型参数，提供选项列表
- 📊 **构建状态** — 查看最近构建记录及实时状态，支持查看指定 Job 的最近 N 次构建历史（含排队中/待执行任务及参数信息）
- 🛑 **中止/删除** — 中止正在运行的任务、取消排队中的构建或删除已完成任务
- 🔄 **版本更新** — 手动检查并更新到最新版本
- 🤖 **Agent Skills** — 安装时自动部署跨平台 Agent skill，支持 Claude Code、Cursor、Copilot 等 17 个平台

## 安装

### 从 npm 安装（推荐）

```bash
npm install -g jenkins-tools-cli
```

### 从源码安装

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
jkt build              # 同上，不传 job 时等同 jkt
jkt --job pc-dev       # 跳过任务选择，直接配置参数
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

### 查询参数定义

```bash
jkt params pc-dev              # 人类可读格式（默认读本地缓存）
jkt params pc-dev --json       # JSON 格式（默认读本地缓存，含上次使用的参数值）
jkt params pc-dev --remote     # 从远程 Jenkins 获取最新参数定义
jkt params pc-dev --sync       # 从远程同步参数（删除已移除的 key，新增 key 使用默认值）
```

### 查询状态

```bash
jkt status               # 显示最近由本工具触发的构建记录
jkt status pc-dev        # 查询指定 Job 的最近构建状态（含参数和触发用户）
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

### 版本更新

```bash
jkt update             # 检查并更新到最新版本
jkt update --check     # 仅检查是否有新版本
```

### 配置管理

```bash
jkt config init          # 交互式初始化配置文件
jkt config add staging   # 交互式添加新的服务器 Profile
jkt config use staging   # 切换默认服务器 Profile
jkt config test          # 测试 Jenkins 连接
jkt config list          # 列出服务器和任务配置
```

## 配置

配置文件统一存放在 `~/.jkt/` 目录下，全局安装后在任意目录运行 `jkt` 均可访问：

```
~/.jkt/
  .jenkinsrc.yml          # 服务器配置和任务预设
  .jenkins-history.json   # 参数历史、构建记录和参数定义缓存
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

`jkt` 安装后自动部署 Agent skill，让 AI 编程助手可以直接操作 Jenkins。

### 自动安装

`npm install -g jenkins-tools-cli` 时自动检测已安装的 AI 工具并安装 skill。

### 手动安装

```bash
jkt setup-skills                    # 自动检测平台并安装
jkt setup-skills --platform cursor  # 指定平台
jkt setup-skills --all              # 安装到所有已检测的平台
jkt setup-skills --dry-run          # 预览安装内容
```

### 支持平台

| 平台 | 路径 | 格式 |
|------|------|------|
| Claude Code | `~/.claude/skills/` | SKILL.md（原生） |
| Cursor | `~/.cursor/rules/` | .mdc（自动生成） |
| GitHub Copilot | `~/.copilot/skills/` | SKILL.md（原生） |
| Codex CLI | `~/.agents/skills/` | SKILL.md（原生） |
| Gemini CLI | `~/.gemini/skills/` | SKILL.md（原生） |
| Windsurf | `~/.codeium/windsurf/skills/` | .md 规则 |
| OpenCode | `~/.config/opencode/skills/` | SKILL.md（原生） |
| + 更多... | | |

### 使用方式

安装后在 AI 工具中输入：

```
/jenkins-tools 触发前端部署
/jenkins-tools 查看构建状态
/jenkins-tools 中止卡住的构建
```

## License

MIT
