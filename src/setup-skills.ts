#!/usr/bin/env node

/**
 * Interactive skill installer for jenkins-tools-cli.
 * Triggered by `jkt setup-skills` command.
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

// ── Global install check ────────────────────────────────────────────

interface GlobalInstallInfo {
  installed: boolean;
  version: string | null;
  path: string | null;
}

/**
 * Check if jkt is installed globally and get its version.
 */
function getGlobalInstallInfo(): GlobalInstallInfo {
  const result: GlobalInstallInfo = { installed: false, version: null, path: null };

  try {
    // Find global jkt binary path
    const whichCmd = process.platform === 'win32' ? 'where jkt' : 'which jkt';
    const binPath = execSync(whichCmd, { encoding: 'utf-8', timeout: 5000 }).trim().split(/\r?\n/)[0];

    if (!binPath) return result;
    result.path = binPath;

    // Get version from the global install
    const verOutput = execSync('jkt --version', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (verOutput) {
      result.installed = true;
      result.version = verOutput;
    }
  } catch {
    // jkt not found globally or command failed
  }

  return result;
}

/**
 * Check if current process is running via npx.
 */
function isRunningViaNpx(): boolean {
  // npx sets npm_lifecycle_event or places the package in a temp cache dir
  const npmLifecycle = process.env.npm_lifecycle_event;
  if (npmLifecycle === 'npx') return true;

  // npx stores packages in _npx/ cache directory
  const execPath = process.argv[1] || '';
  if (execPath.includes(`${path.sep}_npx${path.sep}`)) return true;

  // Also check for the npm exec cache pattern
  if (execPath.includes(`${path.sep}npm${path.sep}_npx`)) return true;

  return false;
}

/**
 * Get current running version from package.json.
 */
function getCurrentVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

/**
 * Check global install and version match before proceeding.
 * Returns true if safe to continue, false if should abort.
 */
function checkGlobalInstall(): boolean {
  const viaNpx = isRunningViaNpx();
  const globalInfo = getGlobalInstallInfo();
  const currentVer = getCurrentVersion();

  // Not running via npx — user is using their global install directly, no check needed
  if (!viaNpx) return true;

  // Running via npx but no global install found — inform user
  if (!globalInfo.installed) {
    console.log('');
    console.log('  ⚠️  检测到通过 npx 运行，但未找到全局安装的 jkt。');
    console.log('');
    console.log('  建议先全局安装 jkt，再运行 setup-skills：');
    console.log('');
    console.log('    npm install -g jenkins-tools-cli');
    console.log('    jkt setup-skills');
    console.log('');
    console.log('  npx 运行的 skill 文件在临时缓存中，重启后会丢失。');
    console.log('  全局安装后 skill 文件位置稳定，升级时也会自动更新。');
    console.log('');
    return false;
  }

  // Running via npx and global install exists — check version match
  if (globalInfo.version && globalInfo.version !== currentVer) {
    console.log('');
    console.log('  ⚠️  版本不匹配！');
    console.log('');
    console.log(`  npx 运行版本:  ${currentVer}`);
    console.log(`  全局安装版本:  ${globalInfo.version}`);
    console.log('');
    console.log('  你已全局安装了 jkt，但版本与 npx 下载的不同。');
    console.log('  建议使用全局安装的版本运行 setup-skills：');
    console.log('');
    console.log('    jkt setup-skills');
    console.log('');
    console.log('  或先更新全局版本：');
    console.log('');
    console.log('    npm update -g jenkins-tools-cli');
    console.log('    jkt setup-skills');
    console.log('');
    return false;
  }

  // Version matches — npx and global are the same, suggest using global directly
  console.log('');
  console.log('  ℹ️  检测到通过 npx 运行，已找到全局安装的 jkt (v' + currentVer + ')。');
  console.log('  建议直接使用全局命令：');
  console.log('');
  console.log('    jkt setup-skills');
  console.log('');

  return true;
}

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

/**
 * Platform-specific skill subdirectory mapping.
 * Most platforms use `skills/`, some use `rules/`.
 */
const PLATFORM_SUBDIRS: Record<string, string> = {
  'cursor': 'rules',
  'trae': 'rules',
};

function installForPlatform(skillDir: string, platform: string): void {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const p = PLATFORMS.find((pl) => pl.id === platform);
  if (!p) {
    console.log(`jkt: 未知平台 ${platform}，跳过。`);
    return;
  }

  // 1. Validate SKILL.md
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    console.log('jkt: 未找到 SKILL.md，跳过安装。');
    return;
  }
  const firstLine = fs.readFileSync(skillMdPath, 'utf-8').split('\n')[0];
  if (firstLine?.trim() !== '---') {
    console.log('jkt: SKILL.md 格式无效，跳过安装。');
    return;
  }
  console.log('  ✔ SKILL.md 验证通过');

  // 2. Resolve install path
  const subDir = PLATFORM_SUBDIRS[platform] || 'skills';
  const installDir = path.join(home, p.dir, subDir, SKILL_NAME);
  console.log(`  ℹ 安装目录: ${installDir}`);

  // 3. Copy files
  if (fs.existsSync(installDir)) {
    fs.rmSync(installDir, { recursive: true, force: true });
  }
  fs.mkdirSync(installDir, { recursive: true });

  const entries = fs.readdirSync(skillDir);
  let count = 0;
  for (const entry of entries) {
    if (entry === 'install.ps1' || entry === 'install.sh') continue;
    const src = path.join(skillDir, entry);
    const dest = path.join(installDir, entry);
    fs.cpSync(src, dest, { recursive: true, force: true });
    count++;
  }
  console.log(`  ✔ 已复制 ${count} 个文件`);

  // 4. Cursor .mdc format adapter
  if (platform === 'cursor') {
    generateMdcFile(skillMdPath, installDir);
  }

  // 5. Universal path link
  if (platform !== 'codex' && platform !== 'universal') {
    createUniversalLink(installDir, home);
  }

  console.log(`  ✔ Skill '${SKILL_NAME}' 已安装到 ${p.name}\n`);
}

/**
 * Generate Cursor .mdc file from SKILL.md.
 */
function generateMdcFile(skillMdPath: string, installDir: string): void {
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const lines = content.split('\n');

  let desc = '';
  const bodyLines: string[] = [];
  let fmCount = 0;

  for (const line of lines) {
    if (line.trim() === '---') {
      fmCount++;
      continue;
    }
    if (fmCount === 1 && line.match(/^description:\s*/)) {
      desc = line.replace(/^description:\s*/, '').trim();
      // Remove YAML multiline indicator
      if (desc.startsWith('>-')) desc = desc.slice(2).trim();
      continue;
    }
    if (fmCount >= 2) {
      bodyLines.push(line);
    }
  }

  const mdcContent = `---\ndescription: ${desc}\nglobs:\nalwaysApply: true\n---\n${bodyLines.join('\n')}`;
  const mdcPath = path.join(installDir, `${SKILL_NAME}.mdc`);
  fs.writeFileSync(mdcPath, mdcContent, 'utf-8');
  console.log(`  ✔ 已生成 Cursor .mdc`);
}

/**
 * Create universal symlink/junction at ~/.agents/skills/<skillName>.
 */
function createUniversalLink(installDir: string, home: string): void {
  const universalDir = path.join(home, '.agents', 'skills', SKILL_NAME);
  const agentsDir = path.join(home, '.agents', 'skills');

  try {
    fs.mkdirSync(agentsDir, { recursive: true });
    if (fs.existsSync(universalDir)) {
      fs.rmSync(universalDir, { recursive: true, force: true });
    }
    if (process.platform === 'win32') {
      // Windows: use junction (directory symlink that doesn't require admin)
      fs.symlinkSync(installDir, universalDir, 'junction');
    } else {
      fs.symlinkSync(installDir, universalDir);
    }
    console.log('  ✔ 通用链接已创建');
  } catch (err: any) {
    // Non-critical — don't fail the whole install
    console.log(`  ⚠ 无法创建通用链接: ${err.message}`);
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

  // Check if running via npx — warn about global install mismatch
  if (!checkGlobalInstall()) {
    return;
  }

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
  // Non-interactive: cannot proceed
  else {
    console.log('jkt: 非交互终端，无法启动安装向导。');
    console.log('jkt: 运行 "jkt setup-skills" 或 "jkt setup-skills --all" 安装 skills。');
    return;
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