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

**Wizard flow** (the core UX): `auth → job-select → params → execute`. Each step lives in `src/wizard/`. The default `jkt` command and `jkt run` both run the full wizard. `jkt build <job>` triggers directly but enters the params wizard if no `-p` flags are given.

**JenkinsService** (`src/services/jenkins.ts`): Direct REST API calls via Node `http`/`https` — no third-party Jenkins library. Parameters are parsed from `/job/<name>/config.xml` (not the JSON API) because the uno-choice plugin's `ChoiceParameter` only exposes choices in the XML Groovy script element. XML entity decoding (`&apos;` → `'`) is required before parsing the script. Queue operations (`getQueueItemStatus`, `cancelQueueItem`, `findQueuedItem`) handle builds that haven't started executing yet — they exist in `/queue/item/<id>/` not `/job/<name>/<buildNumber>/`.

**Config layers** (`src/config/`):
- `~/.jkt/.jenkinsrc.yml` — server profiles and job presets (loaded by `loader.ts`). All config stored in global `~/.jkt/` directory, not project-local.
- `~/.jkt/.jenkins-history.json` — parameter history, last job, and build records (managed by `store.ts`). File format has `meta`, `jobs`, and `buildRecords` keys.
- `paths.ts` — centralizes all config file path resolution (`getConfigDir()`, `getConfigPath()`, `getHistoryPath()`).

**Parameter merge priority** (low → high): Jenkins default → `~/.jkt/.jenkinsrc.yml` job preset → `~/.jkt/.jenkins-history.json` last params

**Prompt wrapper** (`src/utils/prompt.ts`): All inquirer interactions go through this module. Inquirer v14 uses `type: 'select'` (not `'list'`). The `select()` function accepts an optional `defaultValue` parameter.

## Key Conventions

- **ESM only**: `package.json` has `"type": "module"`. All imports use `.js` extensions.
- **js-yaml import**: Must use `import * as yaml from 'js-yaml'` (not `import yaml from 'js-yaml'`) for ESM compat.
- **Jenkins URLs**: Never expose URLs with embedded credentials (`user:pass@host`) in user-facing output. Use `stripAuthFromUrl()` to clean them.
- **XML parameter parsing** (`parseParamsFromXml`): Parses parameters in XML document order (not by type) to preserve the order shown in Jenkins. The regex matches all parameter tag types in a single pass.
- **Build record tracking**: Every build triggered via `jkt` or `jkt build` is recorded in `buildRecords[]` in the history file. This feeds the `jkt status` and `jkt abort` commands.
- **Skill installer** (`src/setup-skills.ts`): Triggered by npm `postinstall`. Installs agent/IDE skill files to the user's project. Skills are in `src/skills/` and copied to `dist/skills/` during build. Each platform installs different file types:
  - **Claude Code**: `.claude/commands/` (slash commands), `.claude/skills/jkt/SKILL.md` (skill), `.claude/agents/jkt.md` (subagent)
  - **Cursor**: `.cursor/rules/jkt.mdc` (rule), `.cursor/skills/jkt/SKILL.md` (skill), `.cursor/agents/jkt.md` (subagent)
  - **Codex**: `AGENTS.md` section appended with `<!-- jkt-skills -->` markers (idempotent replacement)
  - **OpenCode**: `.opencode/agents/jkt.md` (agent definition), `opencode.json` `agent` field merged (idempotent by `jkt-` key prefix)
- **Build script**: `npm run build` compiles TypeScript then copies `src/skills/` to `dist/skills/` (non-TS assets).
