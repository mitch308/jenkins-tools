#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerBuildCommand } from './commands/build.js';
import { registerStatusCommand } from './commands/status.js';
import { registerAbortCommand } from './commands/abort.js';
import { registerConfigCommand } from './commands/config.js';
import { checkUpdate, printUpdateNotice } from './utils/update.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

// 异步检查更新（不阻塞主流程）
checkUpdate();

// 进程退出时输出更新提示
process.on('exit', printUpdateNotice);

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

// setup-skills 子命令：手动安装 Agent/IDE skills
program
  .command('setup-skills')
  .description('安装 Agent/IDE Skills（Claude Code、Cursor、Codex 等）')
  .helpOption('-h, --help', '显示帮助信息')
  .option('-p, --platform <platform>', '指定安装平台')
  .option('-a, --all', '安装到所有已检测的平台')
  .option('--dry-run', '预览安装内容，不实际复制文件')
  .action(async (options: { platform?: string; all?: boolean; dryRun?: boolean }) => {
    const { spawn } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const fs = (await import('node:fs')).default;

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const skillDir = path.join(__dirname, 'skills', 'jenkins-tools-skill');

    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const installPs = path.join(skillDir, 'install.ps1');
      if (!fs.existsSync(installPs)) {
        console.log('jkt: 未找到 skill 安装文件，请重新安装 jenkins-tools-cli。');
        process.exit(1);
      }
      const psArgs = ['-ExecutionPolicy', 'Bypass', '-File', installPs];
      if (options.platform) { psArgs.push('-Platform', options.platform); }
      if (options.all) { psArgs.push('-All'); }
      if (options.dryRun) { psArgs.push('-DryRun'); }
      const child = spawn('powershell', psArgs, { stdio: 'inherit' });
      child.on('close', (code: number) => { process.exit(code ?? 0); });
    } else {
      const installSh = path.join(skillDir, 'install.sh');
      if (!fs.existsSync(installSh)) {
        console.log('jkt: 未找到 skill 安装文件，请重新安装 jenkins-tools-cli。');
        process.exit(1);
      }
      const args = [installSh];
      if (options.platform) args.push('--platform', options.platform);
      if (options.all) args.push('--all');
      if (options.dryRun) args.push('--dry-run');
      const child = spawn('sh', args, { stdio: 'inherit' });
      child.on('close', (code: number) => { process.exit(code ?? 0); });
    }
  });

program.parse();
