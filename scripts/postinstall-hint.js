#!/usr/bin/env node

/**
 * Lightweight install hint script.
 * Called by the npm "install" lifecycle hook.
 * Only prints a hint message — does NOT launch the interactive installer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
];

const home = process.env.HOME || process.env.USERPROFILE || '';
const detected = [];
for (const p of PLATFORMS) {
  if (fs.existsSync(path.join(home, p.dir))) {
    detected.push(p.name);
  }
}

console.log('');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🛠️  jkt: Jenkins CLI Skill 安装提示');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('  jkt 可以为你的 AI 编程工具安装 Skill，');
console.log('  让 AI 助手直接帮你触发构建、查询状态等操作。');
console.log('');

if (detected.length > 0) {
  console.log(`  检测到已安装的工具: ${detected.join('、')}`);
  console.log('');
}

console.log('  运行以下命令安装 Skill:');
console.log('');
console.log('    jkt setup-skills          # 交互式选择平台');
console.log('    jkt setup-skills --all    # 安装到所有已检测平台');
console.log('    jkt setup-skills --platform claude-code  # 指定平台');
console.log('');
console.log('  支持的平台: Claude Code、Cursor、Copilot、Windsurf、');
console.log('  Cline、Codex CLI、Gemini、Kiro、Goose、OpenCode、');
console.log('  Roo Code、Kilo Code、Trae、Factory Droid、Junie、Antigravity');
console.log('');
console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
