#!/usr/bin/env node

/**
 * Interactive skill installer for jenkins-tools-cli.
 * Triggered by npm postinstall or `jkt setup-skills` command.
 * Installs agent/IDE skill files to the user's global skill directories.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Constants ─────────────────────────────────────────────────────

const SKILL_NAME = 'jenkins-tools';
const SKILL_DIR = path.join(__dirname, 'skills', SKILL_NAME);

const PLATFORMS = [
  { id: 'claude-code', name: 'Claude Code', dir: '.claude' },
  { id: 'copilot', name: 'GitHub Copilot', dir: '.copilot' },
  { id: 'cursor', name: 'Cursor', dir: '.cursor' },
  { id: 'windsurf', name: 'Windsurf', dir: '.codeium/windsurf' },
  { id: 'cline', name: 'Cline', dir: '.cline' },
  { id: 'codex', name: 'Codex CLI', dir: '.agents' },
  { id: 'gemini', name: 'Gemini CLI', dir: '.gemini' },
  { id: 'kiro', name: 'Kiro', dir: '.kiro' },
  { id: 'goose', name: 'Goose', dir: '.config/goose' },
  { id: 'opencode', name: 'OpenCode', dir: '.config/opencode' },
  { id: 'roo-code', name: 'Roo Code', dir: '.roo' },
  { id: 'kilo-code', name: 'Kilo Code', dir: '.kilocode' },
  { id: 'trae', name: 'Trae', dir: '.trae' },
  { id: 'factory', name: 'Factory Droid', dir: '.factory' },
  { id: 'junie', name: 'Junie', dir: '.junie' },
  { id: 'antigravity', name: 'Antigravity', dir: '.agent' },
  { id: 'universal', name: 'Universal (~/.agents/)', dir: '.agents' },
];

// ── Environment detection ──────────────────────────────────────────

function isCI(): boolean {
  return !!process.env.CI || process.env.NODE_ENV === 'test';
}

function isTTY(): boolean {
  return process.stdin.isTTY === true;
}

function findSkillDir(): string | null {
  if (fs.existsSync(SKILL_DIR)) return SKILL_DIR;
  const srcSkillDir = path.resolve(__dirname, '..', 'src', 'skills', SKILL_NAME);
  if (fs.existsSync(srcSkillDir)) return srcSkillDir;
  return null;
}

// ── Platform detection ─────────────────────────────────────────────

function detectInstalledPlatforms(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const installed: string[] = [];
  for (const p of PLATFORMS) {
    const fullPath = path.join(home, p.dir);
    if (fs.existsSync(fullPath)) {
      installed.push(p.id);
    }
  }
  // Always include universal as fallback
  if (!installed.includes('universal')) {
    installed.push('universal');
  }
  return installed;
}

// ── Installation ───────────────────────────────────────────────────

function installForPlatform(skillDir: string, platform: string): void {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const installPs = path.join(skillDir, 'install.ps1');
    if (!fs.existsSync(installPs)) {
      console.log(`jkt: install.ps1 未找到，跳过 ${platform} 安装。`);
      return;
    }
    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${installPs}" -Platform ${platform}`, { stdio: 'inherit' });
    } catch (err: any) {
      console.log(`jkt: ${platform} 安装失败: ${err.message}`);
    }
  } else {
    const installSh = path.join(skillDir, 'install.sh');
    if (!fs.existsSync(installSh)) {
      console.log(`jkt: install.sh 未找到，跳过 ${platform} 安装。`);
      return;
    }
    try {
      execSync(`sh "${installSh}" --platform ${platform}`, { stdio: 'inherit' });
    } catch (err: any) {
      console.log(`jkt: ${platform} 安装失败: ${err.message}`);
    }
  }
}

// ── Interactive platform selection ─────────────────────────────────

async function selectPlatforms(): Promise<string[]> {
  const installed = detectInstalledPlatforms();

  console.log('\n🛠️  jkt: Jenkins CLI Skill 安装器\n');
  console.log('选择要安装的平台（空格切换选择，回车确认）：\n');

  try {
    const { default: inquirer } = await import('inquirer');
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: '选择平台:',
        choices: PLATFORMS.map((p) => ({
          name: `${p.name} → ~/${p.dir}/skills/`,
          value: p.id,
          checked: installed.includes(p.id),
        })),
        loop: false,
      },
    ]);
    return selected as string[];
  } catch {
    // inquirer not available, fallback to detected platforms
    console.log('jkt: 无法启动交互式选择，将安装到所有已检测平台。');
    return installed;
  }
}

// ── Entry point ───────────────────────────────────────────────────

async function main(): Promise<void> {
  // Skip in CI
  if (isCI()) {
    console.log('jkt: CI 环境检测到，跳过 skill 安装。');
    return;
  }

  const hasPlatformFlag = process.argv.includes('--platform');
  const hasAllFlag = process.argv.includes('--all');
  const hasDryRunFlag = process.argv.includes('--dry-run');
  const hasFlags = hasPlatformFlag || hasAllFlag || hasDryRunFlag;

  const skillDir = findSkillDir();
  if (!skillDir) {
    console.log('jkt: 未找到 skill 文件，跳过安装。');
    return;
  }

  let platforms: string[] = [];

  // Check for --platform flag
  const platformIdx = process.argv.indexOf('--platform');
  if (platformIdx > -1 && process.argv[platformIdx + 1]) {
    platforms = [process.argv[platformIdx + 1]];
  }
  // Check for --all flag
  else if (hasAllFlag) {
    platforms = detectInstalledPlatforms();
  }
  // Interactive selection (TTY only)
  else if (isTTY()) {
    platforms = await selectPlatforms();
    if (platforms.length === 0) {
      console.log('\njkt: 未选择任何平台，跳过安装。');
      return;
    }
  }
  // Non-interactive (postinstall, etc.): auto-install to detected platforms
  else {
    platforms = detectInstalledPlatforms();
    if (platforms.length === 0) {
      console.log('jkt: 未检测到 AI 编程平台，跳过 skill 安装。');
      console.log('jkt: 运行 "jkt setup-skills" 手动安装 skills。');
      return;
    }
    console.log(`\n🛠️  jkt: 自动安装 skill 到检测到的 ${platforms.length} 个平台...\n`);
  }

  // Install for each selected platform
  console.log(`\n🛠️  jkt: 正在安装 skill 到 ${platforms.length} 个平台...\n`);

  for (const platform of platforms) {
    const p = PLATFORMS.find((pl) => pl.id === platform);
    const label = p ? p.name : platform;
    console.log(`── 安装到 ${label} ──`);
    if (hasDryRunFlag) {
      console.log(`  [预览] 将安装到 ${platform}`);
    } else {
      installForPlatform(skillDir, platform);
    }
  }

  console.log('\njkt: Skill 安装完成！\n');
}

main().catch((err) => {
  // Don't fail npm install if skill setup fails
  console.log(`jkt: Skill 安装已跳过 (${err.message})`);
});