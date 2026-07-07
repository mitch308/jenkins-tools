#!/usr/bin/env node

/**
 * Interactive skill installer for jenkins-tools-cli.
 * Triggered by npm postinstall.
 * Installs agent/IDE skill files to the user's project directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Platform definitions ─────────────────────────────────────────

interface SkillPlatform {
  id: string;
  name: string;
  targetDir: string;
  files: Array<{ src: string; dest: string }>;
  install: (targetRoot: string, filesDir: string) => void;
  isInstalled: (targetRoot: string) => boolean;
}

const PLATFORMS: SkillPlatform[] = [
  // Claude Code
  {
    id: 'claude-code',
    name: 'Claude Code',
    targetDir: '.claude/commands',
    files: [
      { src: 'claude-code/jkt-build.md', dest: '.claude/commands/jkt-build.md' },
      { src: 'claude-code/jkt-status.md', dest: '.claude/commands/jkt-status.md' },
      { src: 'claude-code/jkt-abort.md', dest: '.claude/commands/jkt-abort.md' },
      { src: 'claude-code/jkt-config.md', dest: '.claude/commands/jkt-config.md' },
    ],
    install(targetRoot, filesDir) {
      const destDir = path.join(targetRoot, '.claude', 'commands');
      fs.mkdirSync(destDir, { recursive: true });
      for (const f of this.files) {
        const src = path.join(filesDir, f.src);
        const dest = path.join(targetRoot, f.dest);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    },
    isInstalled(targetRoot) {
      return fs.existsSync(path.join(targetRoot, '.claude', 'commands', 'jkt-build.md'));
    },
  },

  // Cursor
  {
    id: 'cursor',
    name: 'Cursor',
    targetDir: '.cursor/rules',
    files: [
      { src: 'cursor/jkt.mdc', dest: '.cursor/rules/jkt.mdc' },
    ],
    install(targetRoot, filesDir) {
      const destDir = path.join(targetRoot, '.cursor', 'rules');
      fs.mkdirSync(destDir, { recursive: true });
      for (const f of this.files) {
        const src = path.join(filesDir, f.src);
        const dest = path.join(targetRoot, f.dest);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    },
    isInstalled(targetRoot) {
      return fs.existsSync(path.join(targetRoot, '.cursor', 'rules', 'jkt.mdc'));
    },
  },

  // Codex (AGENTS.md)
  {
    id: 'codex',
    name: 'Codex (AGENTS.md)',
    targetDir: '.',
    files: [
      { src: 'codex/agents-section.md', dest: '' },
    ],
    install(targetRoot, filesDir) {
      const sectionSrc = path.join(filesDir, 'codex', 'agents-section.md');
      const agentsFile = path.join(targetRoot, 'AGENTS.md');
      const marker = '<!-- jkt-skills -->';

      const section = fs.readFileSync(sectionSrc, 'utf-8');
      const content = `${marker}\n${section}\n${marker}`;

      if (fs.existsSync(agentsFile)) {
        const existing = fs.readFileSync(agentsFile, 'utf-8');
        if (existing.includes(marker)) {
          // Replace existing jkt section
          const regex = new RegExp(`${escapeRegex(marker)}[\\s\\S]*?${escapeRegex(marker)}`, 'g');
          fs.writeFileSync(agentsFile, existing.replace(regex, content), 'utf-8');
        } else {
          // Append
          fs.writeFileSync(agentsFile, existing + '\n\n' + content, 'utf-8');
        }
      } else {
        fs.writeFileSync(agentsFile, content, 'utf-8');
      }
    },
    isInstalled(targetRoot) {
      const agentsFile = path.join(targetRoot, 'AGENTS.md');
      if (!fs.existsSync(agentsFile)) return false;
      return fs.readFileSync(agentsFile, 'utf-8').includes('<!-- jkt-skills -->');
    },
  },

  // OpenCode
  {
    id: 'opencode',
    name: 'OpenCode',
    targetDir: '.',
    files: [
      { src: 'opencode/opencode-commands.json', dest: '' },
    ],
    install(targetRoot, filesDir) {
      const commandsSrc = path.join(filesDir, 'opencode', 'opencode-commands.json');
      const newCommands = JSON.parse(fs.readFileSync(commandsSrc, 'utf-8')).commands;
      const configFile = path.join(targetRoot, 'opencode.json');

      if (fs.existsSync(configFile)) {
        const existing = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        const existingCommands = existing.commands || [];
        // Remove old jkt commands (by name prefix)
        const filtered = existingCommands.filter((c: any) => !c.name?.startsWith('jkt-'));
        existing.commands = [...filtered, ...newCommands];
        fs.writeFileSync(configFile, JSON.stringify(existing, null, 2), 'utf-8');
      } else {
        const config = { commands: newCommands };
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
      }
    },
    isInstalled(targetRoot) {
      const configFile = path.join(targetRoot, 'opencode.json');
      if (!fs.existsSync(configFile)) return false;
      const content = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      return (content.commands || []).some((c: any) => c.name?.startsWith('jkt-'));
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findProjectRoot(): string {
  // For global installs, INIT_CWD points to the user's project
  // For local installs, CWD is the project root
  const initCwd = process.env.INIT_CWD;
  if (initCwd && fs.existsSync(path.join(initCwd, 'package.json'))) {
    return initCwd;
  }
  return process.cwd();
}

function getSkillsDir(): string {
  // Skills are in dist/skills/ (compiled from src/skills/)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distSkills = path.join(__dirname, 'skills');
  if (fs.existsSync(distSkills)) {
    return distSkills;
  }
  // Fallback: src/skills/ for development
  const srcSkills = path.resolve(__dirname, '..', 'src', 'skills');
  if (fs.existsSync(srcSkills)) {
    return srcSkills;
  }
  throw new Error('Skills directory not found');
}

// ── Interactive installer ────────────────────────────────────────

async function runInstaller(): Promise<void> {
  // CI environment: skip interactive prompt
  if (process.env.CI || process.env.NODE_ENV === 'test') {
    console.log('jkt: CI environment detected, skipping skill installation.');
    return;
  }

  // Non-TTY: skip
  if (!process.stdin.isTTY) {
    console.log('jkt: Non-interactive terminal, skipping skill installation.');
    console.log('jkt: Run "jkt setup-skills" manually to install skills.');
    return;
  }

  const projectRoot = findProjectRoot();

  console.log('\n🛠️  jkt: Jenkins CLI Skill Installer\n');
  console.log('选择要安装 Agent/IDE Skills 的平台：\n');

  // Dynamic import for inquirer (ESM)
  const { default: inquirer } = await import('inquirer');

  const { selected } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selected',
      message: '选择平台:',
      choices: PLATFORMS.map((p) => ({
        name: `${p.name} → ${p.targetDir}`,
        value: p.id,
        checked: p.isInstalled(projectRoot),
      })),
    },
  ]);

  if (selected.length === 0) {
    console.log('\njkt: 未选择任何平台，跳过安装。');
    return;
  }

  const skillsDir = getSkillsDir();

  for (const platformId of selected) {
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (!platform) continue;

    try {
      platform.install(projectRoot, skillsDir);
      console.log(`  ✔ ${platform.name} skills 已安装`);
    } catch (err: any) {
      console.log(`  ✖ ${platform.name} 安装失败: ${err.message}`);
    }
  }

  console.log('\njkt: Skills 安装完成！\n');
}

// ── Entry point ─────────────────────────────────────────────────

runInstaller().catch((err) => {
  // Don't fail npm install if skill setup fails
  console.log(`jkt: Skill installation skipped (${err.message})`);
});
