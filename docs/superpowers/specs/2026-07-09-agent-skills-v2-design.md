# Agent Skills 系统设计文档（v2）

## 概述

基于 Agent Skills Open Standard 规范，在 jenkins-tools-cli npm 包中内置跨平台 skill，`npm install` 时通过 `postinstall` 自动安装到用户的 AI 工具目录。支持 17 个平台，统一 SKILL.md 格式，Tier 2 平台自动转换格式。

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 安装方式 | postinstall 自动 | 用户无需额外操作，CI 自动跳过 |
| Skill 格式 | SKILL.md 规范 | 遵循 Agent Skills Open Standard，17 平台兼容 |
| Skill 范围 | 单一 jenkins-tools-skill | 覆盖所有 Jenkins 操作，简单易维护 |
| 安装范围 | 全局安装 | skill 安装到用户主目录，所有项目可用 |
| 生成方式 | 方案 C：agent-skill-creator 生成后精简 | 保证规范合规，去掉不需要的 Python/eval |

## 架构

```
src/skills/jenkins-tools-skill/     # Skill 源文件（编译后打包到 dist/skills/）
├── SKILL.md                        # 主定义（Agent Skills Open Standard）
├── AGENTS.md                       # 伴侣文件（AAIF 格式，扩展工具覆盖）
├── install.sh                      # 跨平台安装器（macOS/Linux，POSIX 兼容）
├── install.ps1                     # 跨平台安装器（Windows PowerShell）
├── references/                     # 详细文档（按需加载）
│   ├── jkt-commands.md             # 完整 CLI 命令参考
│   └── configuration.md            # 配置文件指南
└── README.md                       # 安装说明

src/setup-skills.ts                 # postinstall 入口（Node.js）
scripts/copy-skills.js              # 构建脚本：复制 skills 到 dist/
```

## 安装流程

```
npm install -g jenkins-tools-cli
    |
    v
postinstall 触发 dist/setup-skills.js
    |
    v
检测 CI 环境变量 → CI 中跳过
    |
    v
检测 TTY → 非 TTY 跳过（除非有 --platform 等标志）
    |
    v
查找 dist/skills/jenkins-tools-skill/
    |
    v
Windows? → powershell install.ps1
Unix?   → sh install.sh
    |
    v
install.sh/ps1 自动检测平台
    |
    v
复制 skill 文件到平台原生路径
    |
    v
Tier 2 平台格式转换（Cursor .mdc 等）
    |
    v
创建 ~/.agents/skills/ 通用链接
```

## 平台支持

### Tier 1 — 原生 SKILL.md（直接读取，无需转换）

| 平台 | 全局路径 | 项目路径 |
|------|----------|----------|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| GitHub Copilot | `~/.copilot/skills/` | `.github/skills/` |
| Codex CLI | `~/.agents/skills/` | `.agents/skills/` |
| Gemini CLI | `~/.gemini/skills/` | `.gemini/skills/` |
| Kiro | `~/.kiro/skills/` | `.kiro/skills/` |
| Goose | `~/.config/goose/skills/` | — |
| OpenCode | `~/.config/opencode/skills/` | `.opencode/skills/` |
| Cline | `~/.cline/skills/` | `.clinerules/skills/` |
| Roo Code | `~/.roo/skills/` | `.roo/skills/` |
| Kilo Code | `~/.kilocode/skills/` | `.kilocode/skills/` |
| Factory Droid | `~/.factory/skills/` | `.factory/skills/` |
| Antigravity | — | `.agent/skills/` |

### Tier 2 — 自动格式转换

| 平台 | 原生格式 | 转换方式 |
|------|----------|----------|
| Cursor | `.mdc` | 从 SKILL.md 生成，含 `alwaysApply: true` frontmatter |
| Windsurf | `.md` 规则 | 从 SKILL.md 提取 body，6K 字符限制 |
| Trae | `.md` 规则 | 从 SKILL.md 提取 body |
| Junie | `guidelines.md` | 从 SKILL.md 提取 body |

### Tier 3 — 手动集成

Zed、Augment、Aider、Continue.dev 需要用户手动复制内容。

## SKILL.md 规范

```yaml
---
name: jenkins-tools-skill    # 必须匹配目录名，1-64 字符
description: >-              # 1-1024 字符，包含激活关键词
  描述内容...
license: MIT
metadata:
  author: mitch308
  version: 1.0.0
  created: YYYY-MM-DD
  last_reviewed: YYYY-MM-DD
  review_interval_days: 90
  dependencies:              # 外部依赖（可选）
    - url: https://...
      name: ...
      type: npm-package
compatibility: >-            # 兼容性说明（可选）
  ...
---
```

## 关键约定

- **幂等**：重复安装不重复追加，先删除旧目录再复制
- **CI 友好**：`CI=true` 时跳过安装
- **非 TTY 友好**：非交互终端跳过，除非提供 `--platform`/`--all`/`--dry-run` 标志
- **postinstall 容错**：`package.json` 中 `postinstall` 使用 `|| echo "skipped"` 确保 npm install 不会因 skill 安装失败而中断
- **全局安装场景**：使用 `process.env.HOME || process.env.USERPROFILE` 解析用户主目录
- **Windows 支持**：PowerShell 安装器 `install.ps1`，使用 Junction（目录符号链接）替代 Unix symlink
- **通用路径**：安装后在 `~/.agents/skills/` 创建链接，供 Codex CLI、Gemini CLI、OpenCode 等工具发现
- **中文内容**：所有 skill 文件内容使用中文，与 jkt CLI 的 i18n 策略一致

## 与旧方案对比

| 方面 | 旧方案（v1，已删除） | 新方案（v2） |
|------|---------------------|-------------|
| 平台数 | 4（Claude/Cursor/Codex/OpenCode） | 17 |
| 格式 | 每平台独立模板 | 统一 SKILL.md + 自动格式转换 |
| 安装器 | 自定义 TypeScript（286 行） | install.sh（POSIX）+ install.ps1（PowerShell） |
| 规范 | 无标准 | Agent Skills Open Standard |
| AGENTS.md | 无 | 有（AAIF 格式，扩展工具覆盖） |
| 通用路径 | 无 | ~/.agents/skills/ 链接 |
| Windows 支持 | 无 | install.ps1 |
| 维护成本 | 高（每平台独立模板） | 低（一处编写，到处安装） |