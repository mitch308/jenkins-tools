# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 构建与运行

```bash
npm run build          # 编译 TypeScript 到 dist/
npm run dev            # 监听模式编译
npm start              # 运行 CLI (node dist/index.js)
npm link               # 全局安装 `jkt` 用于测试
```

未配置测试框架。通过编译 (`npx tsc`) 和手动运行 `jkt` 来验证变更。

## 架构

交互式 Jenkins CLI 工具 (`jkt`)，基于 TypeScript ESM 构建（Node16 模块解析）。

**向导流程**（核心 UX）：`auth → job-select → params → execute`。每个步骤位于 `src/wizard/`。默认 `jkt` 命令运行完整向导（可选 `--job` 跳过任务选择）。`jkt build [job]` — 指定 job 时直接触发，若无 `-p` 参数则进入参数向导；未指定 job 时运行完整向导（等同于 `jkt`）。

**JenkinsService** (`src/services/jenkins.ts`)：通过 Node `http`/`https` 直接调用 REST API，不依赖第三方 Jenkins 库。参数从 `/job/<name>/config.xml` 解析（而非 JSON API），因为 uno-choice 插件的 `ChoiceParameter` 仅在 XML Groovy 脚本元素中暴露选项值。解析脚本前需进行 XML 实体解码（`&apos;` → `'`）。**Uno-choice 列表正则**：使用 `\]\s*$` 匹配 return 语句结尾，因为选项值可能包含 `[` `]` 方括号（如 `小密盒(xmh)[pc-enterprise]`）。队列操作（`getQueueItemStatus`、`cancelQueueItem`、`findQueuedItem`）处理尚未开始执行的构建——它们存在于 `/queue/item/<id>/` 而非 `/job/<name>/<buildNumber>/`。队列中缺少 `executable.number` 的构建号，通过 job 的 `nextBuildNumber` 顺序推算。构建参数和触发用户从队列和构建 API 的 `actions[causes[userId,userName],parameters[name,value]]` 中提取。**CSRF 防护**：Jenkins POST 请求需要 crumb 头（`Jenkins-Crumb`）和会话 cookie。服务在首次 POST 时自动从 `/crumbIssuer/api/json` 获取 crumb，缓存并在后续请求中维护 cookie jar。缺少 crumb 获取时的会话 cookie，Jenkins 会以 403 "No valid crumb was included in the request" 拒绝 POST。

**配置层** (`src/config/`)：
- `~/.jkt/.jenkinsrc.yml` — 服务器 Profile 和 Job 预设（由 `loader.ts` 加载）。所有配置存储在全局 `~/.jkt/` 目录，非项目本地。
- `~/.jkt/.jenkins-history.json` — 参数历史、参数定义缓存（`paramDefs`）、上次 Job 和构建记录（由 `store.ts` 管理）。文件格式包含 `meta`、`jobs` 和 `buildRecords` 键。
- `paths.ts` — 集中管理所有配置文件路径解析（`getConfigDir()`、`getConfigPath()`、`getHistoryPath()`）。

**参数合并优先级**（低 → 高）：Jenkins 默认值 → `~/.jkt/.jenkinsrc.yml` Job 预设 → `~/.jkt/.jenkins-history.json` 上次参数

**Prompt 封装** (`src/utils/prompt.ts`)：所有 inquirer 交互通过此模块。Inquirer v14 使用 `type: 'select'`（非 `'list'`）。`select()` 函数接受可选的 `defaultValue` 参数。

## 关键约定

- **纯 ESM**：`package.json` 设置 `"type": "module"`。所有 import 使用 `.js` 扩展名。
- **js-yaml 导入**：必须使用 `import * as yaml from 'js-yaml'`（而非 `import yaml from 'js-yaml'`）以兼容 ESM。
- **Jenkins URL**：禁止在用户可见输出中暴露含凭据的 URL（`user:pass@host`）。使用 `stripAuthFromUrl()` 清理。
- **XML 参数解析** (`parseParamsFromXml`)：按 XML 文档顺序解析参数（非按类型），以保持 Jenkins 中显示的顺序。正则在单次遍历中匹配所有参数标签类型。
- **构建记录追踪**：通过 `jkt` 或 `jkt build` 触发的每次构建都记录在历史文件的 `buildRecords[]` 中。供 `jkt status` 和 `jkt abort` 命令使用。
- **参数定义缓存**：`jkt params` 默认从本地缓存读取（`store.ts` 中的 `loadParamDefs`/`saveParamDefs`）。`--remote` 从 Jenkins 获取并更新缓存。`--sync` 协调键变更（删除已移除的键，新增键使用默认值）。向导（`runParamsWizard`）也优先使用本地缓存。
- **更新命令**：`jkt update` 替代了旧的每次运行自动更新行为。`jkt update --check` 仅检查不更新。`index.ts` 中不再有 `checkUpdate()`/`printUpdateNotice()` 钩子。
- **构建脚本**：`npm run build` 清理 `dist/`（通过 `rimraf`），编译 TypeScript，然后通过 `scripts/copy-skills.js` 复制 skill 文件。
- **版本管理**：版本号在运行时通过 `createRequire` 从 `package.json` 读取——禁止在源码中硬编码。发布新版本使用 `npm version patch|minor|major`（自动更新 `package.json` + 创建 git tag），然后 `npm publish` 和 `git push origin main --tags`。
- **CLI 国际化**：所有 Commander 描述和帮助文本必须使用中文。每个命令使用 `.helpOption('-h, --help', '显示帮助信息')` 和 `.addHelpCommand('help [command]', '显示子命令帮助')`。

**Agent/IDE Skills 系统** (`src/skills/jenkins-tools-skill/`)：
- 遵循 **Agent Skills 开放标准** — 单一 `SKILL.md` + `AGENTS.md` + 跨平台安装器
- 支持 17 个平台：Claude Code、Cursor、Copilot、Codex、Gemini、Windsurf、Cline、OpenCode、Kiro、Goose、Roo Code、Kilo Code、Trae、Junie、Factory Droid、Antigravity、Universal
- **安装方式**：`npm install` 触发 `postinstall` → `dist/setup-skills.js` 自动检测平台并安装 skill 到用户全局 skill 目录。CI 环境自动跳过。
- **手动安装**：`jkt setup-skills` 命令，支持 `--platform`、`--all`、`--dry-run` 选项
- **构建流水线**：`scripts/copy-skills.js` 将 `src/skills/` 复制到 `dist/skills/`（TypeScript 编译器仅处理 .ts 文件，不处理 .md/.sh/.ps1）
- **双安装器**：`install.sh`（macOS/Linux，POSIX 兼容）+ `install.ps1`（Windows PowerShell）— 均自动检测平台，支持 `--platform`/`--all`/`--dry-run`
- **格式适配**：Cursor `.mdc` 从 SKILL.md 自动生成；Cline/Roo Code/Kilo Code/Trae 使用纯 .md 规则
- **Universal 符号链接**：主安装完成后，创建 `~/.agents/skills/jenkins-tools-skill` 链接供读取通用路径的工具使用
- **Skill 内容**：全部为中文。SKILL.md 包含触发词、核心操作（build/status/abort/config）、工作流示例、决策流程、错误处理。参考资料在 `references/` 目录。
