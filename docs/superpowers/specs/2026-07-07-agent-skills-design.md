# Agent/IDE Skills 系统设计文档

## 概述

在 jenkins-tools-cli npm 包中内置各平台的 skill 文件模板，`npm install` 时通过 `postinstall` 脚本交互式安装到目标项目。Agent 通过自然语言触发 skill，调用 `jkt` CLI 完成 Jenkins 操作。

## 支持平台

| 平台 | 目标目录 | 文件格式 | 说明 |
|------|---------|---------|------|
| Claude Code | `.claude/commands/jkt-*.md` | Markdown (命令模板) | 每个功能一个命令文件 |
| Cursor | `.cursor/rules/jkt.mdc` | MDC (Markdown + frontmatter) | 单文件合并所有规则 |
| Codex | `AGENTS.md` | Markdown | 追加 `## Jenkins Tools` 章节 |
| OpenCode | `opencode.json` | JSON config | 追加到 commands 数组 |

## Skill 功能

每个平台 skill 覆盖 4 个功能：
1. **触发构建** — `jkt`, `jkt build <job>`
2. **查询状态** — `jkt status [name]`, `jkt status <name> --log`
3. **中止/删除** — `jkt abort`
4. **配置管理** — `jkt config init/add/use/test/list`

## 安装流程

1. `npm install -g jenkins-tools-cli` 触发 `postinstall` 脚本
2. 检测 `CI` 环境变量 → CI 中自动跳过
3. 交互式多选：选择要安装的平台
4. 在用户当前工作目录（CWD）中创建对应文件
5. 已存在的文件：检测 jkt 标记，幂等替换/追加

## 项目结构新增

```
src/
├── skills/                    # Skill 模板（编译后打包到 dist/skills/）
│   ├── claude-code/
│   │   ├── jkt-build.md
│   │   ├── jkt-status.md
│   │   ├── jkt-abort.md
│   │   └── jkt-config.md
│   ├── cursor/
│   │   └── jkt.mdc
│   ├── codex/
│   │   └── agents-section.md
│   └── opencode/
│       └── opencode-commands.json
├── setup-skills.ts            # 安装脚本入口
└── ...
```

## 关键约定

- 幂等：重复运行不重复追加，通过 `<!-- jkt-skills -->` 标记识别
- CI 友好：`CI=true` 时跳过交互
- 全局安装场景：`postinstall` 的 CWD 是包目录，需用 `process.env.INIT_CWD` 或向上查找项目根
- 文件权限：不修改已有文件的非 jkt 内容
