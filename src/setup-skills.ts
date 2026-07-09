#!/usr/bin/env node

/**
 * Interactive skill installer for jenkins-tools-cli.
 * Triggered by npm postinstall.
 * Installs agent/IDE skill files to the user's global skill directories.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Constants ─────────────────────────────────────────────────────

const SKILL_NAME = 'jenkins-tools-skill';
const SKILL_DIR = path.join(__dirname, 'skills', SKILL_NAME);

// ── Environment detection ──────────────────────────────────────────

function isCI(): boolean {
  return !!process.env.CI || process.env.NODE_ENV === 'test';
}

function isTTY(): boolean {
  return process.stdin.isTTY === true;
}

function findSkillDir(): string | null {
  // Check dist/skills/ first (production)
  if (fs.existsSync(SKILL_DIR)) {
    return SKILL_DIR;
  }
  // Check src/skills/ (development)
  const srcSkillDir = path.resolve(__dirname, '..', 'src', 'skills', SKILL_NAME);
  if (fs.existsSync(srcSkillDir)) {
    return srcSkillDir;
  }
  return null;
}

// ── Installation ───────────────────────────────────────────────────

function runInstaller(skillDir: string, platform?: string): void {
  const isWindows = process.platform === 'win32';
  const installSh = path.join(skillDir, 'install.sh');
  const installPs = path.join(skillDir, 'install.ps1');

  if (isWindows) {
    // Windows: use PowerShell installer
    if (!fs.existsSync(installPs)) {
      console.log('jkt: install.ps1 not found, skipping skill installation.');
      return;
    }
    let cmd = `powershell -ExecutionPolicy Bypass -File "${installPs}"`;
    if (platform) cmd += ` -Platform ${platform}`;
    if (process.argv.includes('--all')) cmd += ' -All';
    if (process.argv.includes('--dry-run')) cmd += ' -DryRun';
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err: any) {
      console.log(`jkt: Skill installation failed: ${err.message}`);
    }
  } else {
    // Unix: use shell installer
    if (!fs.existsSync(installSh)) {
      console.log('jkt: install.sh not found, skipping skill installation.');
      return;
    }
    let cmd = `sh "${installSh}"`;
    if (platform) cmd += ` --platform ${platform}`;
    if (process.argv.includes('--all')) cmd += ' --all';
    if (process.argv.includes('--dry-run')) cmd += ' --dry-run';
    try {
      execSync(cmd, { stdio: 'inherit' });
    } catch (err: any) {
      console.log(`jkt: Skill installation failed: ${err.message}`);
    }
  }
}

function installToDefault(skillDir: string): void {
  // Detect Claude Code as primary platform (most common)
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const claudeDir = path.join(home, '.claude');
  const copilotDir = path.join(home, '.copilot');
  const geminiDir = path.join(home, '.gemini');
  const agentsDir = path.join(home, '.agents');

  let platform = '';
  if (fs.existsSync(claudeDir)) {
    platform = 'claude-code';
  } else if (fs.existsSync(copilotDir)) {
    platform = 'copilot';
  } else if (fs.existsSync(geminiDir)) {
    platform = 'gemini';
  } else if (fs.existsSync(agentsDir)) {
    platform = 'universal';
  } else {
    // No known platform detected, install to universal path
    platform = 'universal';
  }

  console.log(`\n🛠️  jkt: Installing skill for ${platform}...\n`);
  runInstaller(skillDir, platform);
}

// ── Entry point ───────────────────────────────────────────────────

async function main(): Promise<void> {
  // Skip in CI
  if (isCI()) {
    console.log('jkt: CI environment detected, skipping skill installation.');
    return;
  }

  const hasPlatformFlag = process.argv.includes('--platform');
  const hasAllFlag = process.argv.includes('--all');
  const hasDryRunFlag = process.argv.includes('--dry-run');
  const hasFlags = hasPlatformFlag || hasAllFlag || hasDryRunFlag;

  // Skip non-interactive unless flags are provided (manual invocation)
  if (!isTTY() && !hasFlags) {
    console.log('jkt: Non-interactive terminal, skipping skill installation.');
    console.log('jkt: Run "jkt setup-skills" to install skills manually.');
    return;
  }

  const skillDir = findSkillDir();
  if (!skillDir) {
    console.log('jkt: Skill files not found, skipping installation.');
    return;
  }

  // Check for --platform flag
  const platformIdx = process.argv.indexOf('--platform');
  if (platformIdx > -1 && process.argv[platformIdx + 1]) {
    const platform = process.argv[platformIdx + 1];
    runInstaller(skillDir, platform);
    return;
  }

  // Check for --all flag
  if (hasAllFlag) {
    runInstaller(skillDir);
    return;
  }

  // Default: install to detected platform
  installToDefault(skillDir);
}

main().catch((err) => {
  // Don't fail npm install if skill setup fails
  console.log(`jkt: Skill installation skipped (${err.message})`);
});