#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerBuildCommand } from './commands/build.js';
import { registerStatusCommand } from './commands/status.js';
import { registerAbortCommand } from './commands/abort.js';
import { registerConfigCommand } from './commands/config.js';
import { registerParamsCommand } from './commands/params.js';
import { checkAndUpdate } from './utils/update.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('jkt')
  .description('交互式 Jenkins CLI 工具')
  .version(version, '-v, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息')
  .addHelpCommand('help [command]', '显示子命令帮助')
  .option('-j, --job <job>', '预选任务（跳过任务选择步骤）');

// 默认命令：启动向导
program.action(async (options: { job?: string }) => {
  const { runAuthWizard } = await import('./wizard/auth.js');
  const { runJobSelectWizard } = await import('./wizard/job-select.js');
  const { runParamsWizard } = await import('./wizard/params.js');
  const { runExecuteWizard } = await import('./wizard/execute.js');
  const { printError } = await import('./utils/output.js');

  try {
    const { config, service, profileName } = await runAuthWizard();
    const selection = await runJobSelectWizard(config, service, options.job);
    const params = await runParamsWizard(service, selection.jobName, config, selection.jobAlias);
    const result = await runExecuteWizard(service, selection.jobName, params, selection.serverProfile);
    if (!result) {
      printError('构建已取消');
    }
  } catch (err: any) {
    printError(err.message);
    process.exit(1);
  }
});

registerBuildCommand(program);
registerStatusCommand(program);
registerAbortCommand(program);
registerConfigCommand(program);
registerParamsCommand(program);

// update 子命令：检查并更新
program
  .command('update')
  .description('检查并更新 jkt 到最新版本')
  .helpOption('-h, --help', '显示帮助信息')
  .option('--check', '仅检查更新，不执行更新')
  .action(async (options: { check?: boolean }) => {
    await checkAndUpdate(!options.check);
  });

// setup-skills 子命令：手动安装 Agent/IDE skills
program
  .command('setup-skills')
  .description('安装 Agent/IDE Skills（Claude Code、Cursor、Codex 等）')
  .helpOption('-h, --help', '显示帮助信息')
  .option('-p, --platform <platform>', '指定安装平台')
  .option('-a, --all', '安装到所有已检测的平台')
  .option('--dry-run', '预览安装内容，不实际复制文件')
  .action(async (options: { platform?: string; all?: boolean; dryRun?: boolean }) => {
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const { execSync } = await import('node:child_process');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const setupScript = path.join(__dirname, 'setup-skills.js');

    // Forward options to setup-skills.js
    const args = ['node', setupScript];
    if (options.platform) args.push('--platform', options.platform);
    if (options.all) args.push('--all');
    if (options.dryRun) args.push('--dry-run');

    try {
      execSync(args.join(' '), { stdio: 'inherit' });
    } catch (err: any) {
      process.exit(err.status ?? 1);
    }
  });

// remove-skills 子命令：卸载 Agent/IDE skills
program
  .command('remove-skills')
  .description('卸载 Agent/IDE Skills')
  .helpOption('-h, --help', '显示帮助信息')
  .option('-p, --platform <platform>', '指定卸载平台')
  .option('-a, --all', '卸载所有已安装的平台')
  .option('--dry-run', '预览卸载内容，不实际删除文件')
  .action(async (options: { platform?: string; all?: boolean; dryRun?: boolean }) => {
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const fs = await import('node:fs');

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

    const PLATFORM_SUBDIRS: Record<string, string> = {
      'cursor': 'rules',
      'trae': 'rules',
    };

    const home = process.env.HOME || process.env.USERPROFILE || '';
    const skillName = 'jenkins-tools';

    // Determine which platforms to remove
    let platforms: string[] = [];
    if (options.platform) {
      platforms = [options.platform];
    } else if (options.all) {
      platforms = PLATFORMS.map(p => p.id);
    } else {
      // Default: remove from all platforms where skill is installed
      for (const p of PLATFORMS) {
        const subDir = PLATFORM_SUBDIRS[p.id] || 'skills';
        const skillDir = path.join(home, p.dir, subDir, skillName);
        if (fs.existsSync(skillDir)) {
          platforms.push(p.id);
        }
      }
      if (platforms.length === 0) {
        console.log('jkt: 未找到已安装的 skill。');
        return;
      }
    }

    console.log(`\n🗑️  jkt: 正在卸载 skill（${platforms.length} 个平台）...\n`);

    for (const platformId of platforms) {
      const p = PLATFORMS.find(pl => pl.id === platformId);
      const label = p ? p.name : platformId;
      console.log(`── 卸载 ${label} ──`);

      const subDir = PLATFORM_SUBDIRS[platformId] || 'skills';
      const skillDir = path.join(home, p?.dir || '', subDir, skillName);

      if (options.dryRun) {
        console.log(`  [预览] 将删除 ${skillDir}`);
        continue;
      }

      // Remove skill directory
      if (fs.existsSync(skillDir)) {
        // List files before deleting
        try {
          const files = fs.readdirSync(skillDir);
          for (const f of files) {
            console.log(`  - 删除 ${path.join(skillDir, f)}`);
          }
        } catch {
          // Ignore listing errors
        }
        fs.rmSync(skillDir, { recursive: true, force: true });
        console.log(`  ✔ 已删除 ${skillDir}`);
      } else {
        console.log(`  ℹ 未找到 ${skillDir}，跳过`);
      }

      // Remove universal link
      const universalDir = path.join(home, '.agents', 'skills', skillName);
      if (fs.existsSync(universalDir)) {
        try {
          fs.rmSync(universalDir, { recursive: true, force: true });
          console.log(`  ✔ 已删除通用链接 ${universalDir}`);
        } catch {
          // Ignore
        }
      }

      console.log('');
    }

    console.log('jkt: Skill 卸载完成！\n');
  });

program.parse();
