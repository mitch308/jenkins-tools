# Jenkins Tools Skill

跨平台 Agent skill，通过 `jkt` CLI 工具与 Jenkins CI/CD 服务器交互。

## 功能

- **触发 Jenkins 构建** — 通过交互式向导或直接命令启动任务
- **查询构建状态** — 查看运行中、排队中或已完成的构建；查看日志
- **中止/删除构建** — 取消排队中的构建、中止运行中的任务、删除已完成记录
- **管理配置** — 设置服务器、添加 Profile、测试连接

## 前置条件

全局安装 `jkt` CLI：

```bash
npm install -g jenkins-tools-cli
jkt -v  # 验证安装
```

配置存放在 `~/.jkt/`：
- `.jenkinsrc.yml` — 服务器配置和任务预设
- `.jenkins-history.json` — 构建历史

## 安装

### 自动检测平台（推荐）

```bash
cd jenkins-tools-skill
./install.sh          # macOS/Linux
.\install.ps1         # Windows PowerShell
```

### 安装到指定平台

```bash
./install.sh --platform claude-code  # Claude Code
./install.sh --platform cursor       # Cursor（.mdc 格式）
./install.sh --platform windsurf     # Windsurf
./install.sh --platform gemini       # Gemini CLI
./install.sh --platform opencode     # OpenCode
```

Windows：

```powershell
.\install.ps1 -Platform claude-code
.\install.ps1 -Platform cursor
```

### 安装到所有已检测的平台

```bash
./install.sh --all          # macOS/Linux
.\install.ps1 -All          # Windows
```

### 项目级安装

```bash
./install.sh --project      # 安装到当前项目的 skill 目录
.\install.ps1 -Project      # Windows
```

### 预览模式

```bash
./install.sh --dry-run      # 显示将要安装的内容，不实际复制
.\install.ps1 -DryRun       # Windows
```

## 支持的平台

| 平台 | 原生路径 | 格式 |
|------|----------|------|
| Claude Code | `~/.claude/skills/` | SKILL.md（原生） |
| GitHub Copilot | `~/.copilot/skills/` | SKILL.md（原生） |
| Cursor | `~/.cursor/rules/` | .mdc（自动生成） |
| Windsurf | `~/.codeium/windsurf/skills/` | .md 规则 |
| Gemini CLI | `~/.gemini/skills/` | SKILL.md（原生） |
| OpenCode | `~/.config/opencode/skills/` | SKILL.md（原生） |
| Codex CLI | `~/.agents/skills/` | SKILL.md（原生） |
| Cline | `~/.cline/skills/` | .md 规则 |
| Roo Code | `~/.roo/skills/` | .md 规则 |
| Kilo Code | `~/.kilocode/skills/` | .md 规则 |
| Goose | `~/.config/goose/skills/` | SKILL.md（原生） |
| Kiro | `~/.kiro/skills/` | SKILL.md（原生） |
| Trae | `~/.trae/rules/` | .md 规则 |
| Junie | `~/.junie/skills/` | guidelines.md |
| Factory Droid | `~/.factory/skills/` | SKILL.md（原生） |
| Antigravity | `.agent/skills/` | SKILL.md（原生） |

安装器还会在 `~/.agents/skills/` 创建链接，供读取通用路径的工具使用。

## 使用方式

安装后，在 AI 工具中调用 skill：

### 斜杠命令

```
/jenkins-tools 触发前端部署任务
```

### 自然语言触发

```
触发 Jenkins 构建主分支
查看 Jenkins 构建状态
中止正在运行的 Jenkins 任务
通过 Jenkins 部署到生产环境
Jenkins 流水线状态是什么？
```

## 文件结构

```
jenkins-tools-skill/
├── SKILL.md          # Skill 定义（Agent Skills Open Standard）
├── AGENTS.md         # 伴侣文件（供读取 AGENTS.md 的工具使用）
├── install.sh        # 跨平台安装器（macOS/Linux）
├── install.ps1       # 跨平台安装器（Windows PowerShell）
├── references/
│   ├── jkt-commands.md   # 完整 CLI 命令参考
│   └── configuration.md  # 配置文件指南
└── README.md         # 本文件
```

## License

MIT