# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode compilation
npm start              # Run CLI (node dist/index.js)
npm link               # Install `jkt` globally for testing
```

No test framework is configured. Verify changes by compiling (`npx tsc`) and running `jkt` manually.

## Architecture

Interactive Jenkins CLI tool (`jkt`) built with TypeScript ESM (Node16 module resolution).

**Wizard flow** (the core UX): `auth → job-select → params → execute`. Each step lives in `src/wizard/`. The default `jkt` command runs the full wizard (with optional `--job` to skip job selection). `jkt build [job]` — when job is provided, triggers directly but enters the params wizard if no `-p` flags are given; when job is omitted, runs the full wizard (same as `jkt`).

**JenkinsService** (`src/services/jenkins.ts`): Direct REST API calls via Node `http`/`https` — no third-party Jenkins library. Parameters are parsed from `/job/<name>/config.xml` (not the JSON API) because the uno-choice plugin's `ChoiceParameter` only exposes choices in the XML Groovy script element. XML entity decoding (`&apos;` → `'`) is required before parsing the script. **Uno-choice list regex**: uses `\]\s*$` to match the end of the return statement, because choice values may contain `[` `]` brackets (e.g. `小密盒(xmh)[pc-enterprise]`). Queue operations (`getQueueItemStatus`, `cancelQueueItem`, `findQueuedItem`) handle builds that haven't started executing yet — they exist in `/queue/item/<id>/` not `/job/<name>/<buildNumber>/`. Build numbers for queued items without `executable.number` are computed from the job's `nextBuildNumber` sequentially. Build parameters and trigger user are extracted from `actions[causes[userId,userName],parameters[name,value]]` in both queue and build APIs. **CSRF protection**: Jenkins POST requests require a crumb header (`Jenkins-Crumb`) and session cookie. The service auto-fetches the crumb from `/crumbIssuer/api/json` on first POST, caches it, and maintains a cookie jar across requests. Without the session cookie from the crumb fetch, Jenkins rejects POSTs with 403 "No valid crumb was included in the request".

**Config layers** (`src/config/`):
- `~/.jkt/.jenkinsrc.yml` — server profiles and job presets (loaded by `loader.ts`). All config stored in global `~/.jkt/` directory, not project-local.
- `~/.jkt/.jenkins-history.json` — parameter history, param definition cache (`paramDefs`), last job, and build records (managed by `store.ts`). File format has `meta`, `jobs`, and `buildRecords` keys.
- `paths.ts` — centralizes all config file path resolution (`getConfigDir()`, `getConfigPath()`, `getHistoryPath()`).

**Parameter merge priority** (low → high): Jenkins default → `~/.jkt/.jenkinsrc.yml` job preset → `~/.jkt/.jenkins-history.json` last params

**Prompt wrapper** (`src/utils/prompt.ts`): All inquirer interactions go through this module. Inquirer v14 uses `type: 'select'` (not `'list'`). The `select()` function accepts an optional `defaultValue` parameter.

## Key Conventions

- **ESM only**: `package.json` has `"type": "module"`. All imports use `.js` extensions.
- **js-yaml import**: Must use `import * as yaml from 'js-yaml'` (not `import yaml from 'js-yaml'`) for ESM compat.
- **Jenkins URLs**: Never expose URLs with embedded credentials (`user:pass@host`) in user-facing output. Use `stripAuthFromUrl()` to clean them.
- **XML parameter parsing** (`parseParamsFromXml`): Parses parameters in XML document order (not by type) to preserve the order shown in Jenkins. The regex matches all parameter tag types in a single pass.
- **Build record tracking**: Every build triggered via `jkt` or `jkt build` is recorded in `buildRecords[]` in the history file. This feeds the `jkt status` and `jkt abort` commands.
- **Param definition cache**: `jkt params` reads from local cache by default (`loadParamDefs`/`saveParamDefs` in `store.ts`). `--remote` fetches from Jenkins and updates cache. `--sync` reconciles key changes (deletes removed keys, adds new keys with defaults). The wizard (`runParamsWizard`) also uses local cache first.
- **Update command**: `jkt update` replaces the old auto-update-on-every-run behavior. `jkt update --check` only checks without updating. No more `checkUpdate()`/`printUpdateNotice()` hooks in `index.ts`.
- **Build script**: `npm run build` cleans `dist/` (via `rimraf`), compiles TypeScript, then copies skill files via `scripts/copy-skills.js`.
- **Version management**: Version is read from `package.json` at runtime via `createRequire` — never hardcode in source. To release a new version, use `npm version patch|minor|major` (auto-bumps `package.json` + creates git tag), then `npm publish` and `git push origin main --tags`.
- **CLI i18n**: All Commander descriptions and help text must be in Chinese. Use `.helpOption('-h, --help', '显示帮助信息')` and `.addHelpCommand('help [command]', '显示子命令帮助')` on each command.

**Agent/IDE Skills System** (`src/skills/jenkins-tools-skill/`):
- Follows the **Agent Skills Open Standard** — single `SKILL.md` + `AGENTS.md` + cross-platform installer
- Supports 17 platforms: Claude Code, Cursor, Copilot, Codex, Gemini, Windsurf, Cline, OpenCode, Kiro, Goose, Roo Code, Kilo Code, Trae, Junie, Factory Droid, Antigravity, Universal
- **Installation**: `npm install` triggers `postinstall` → `dist/setup-skills.js` auto-detects platform and installs skill to the user's global skill directory. CI environments are skipped automatically.
- **Manual install**: `jkt setup-skills` command with `--platform`, `--all`, `--dry-run` options
- **Build pipeline**: `scripts/copy-skills.js` copies `src/skills/` to `dist/skills/` (TypeScript compiler only processes .ts files, not .md/.sh/.ps1)
- **Dual installer**: `install.sh` (macOS/Linux, POSIX-compatible) + `install.ps1` (Windows PowerShell) — both auto-detect platform, support `--platform`/`--all`/`--dry-run`
- **Format adapters**: Cursor `.mdc` auto-generated from SKILL.md; Cline/Roo Code/Kilo Code/Trae get plain .md rules
- **Universal symlink**: After primary install, creates `~/.agents/skills/jenkins-tools-skill` link for tools reading the universal path
- **Skill content**: All in Chinese. SKILL.md contains trigger, core operations (build/status/abort/config), workflow examples, decision flow, error handling. References in `references/` directory.
