#!/usr/bin/env node

// Suppress deprecation warnings from transitive dependencies (punycode via jenkins-api → request)
process.removeAllListeners('warning');

import { Command } from 'commander';
import { registerRunCommand } from './commands/run.js';
import { registerBuildCommand } from './commands/build.js';
import { registerStatusCommand } from './commands/status.js';
import { registerConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('jkt')
  .description('Interactive Jenkins CLI tool')
  .version('0.1.0');

// 默认命令：启动向导
program.action(async () => {
  const { runAuthWizard } = await import('./wizard/auth.js');
  const { runJobSelectWizard } = await import('./wizard/job-select.js');
  const { runParamsWizard } = await import('./wizard/params.js');
  const { runExecuteWizard } = await import('./wizard/execute.js');
  const { printError } = await import('./utils/output.js');

  try {
    const cwd = process.cwd();

    const { config, service, profileName } = await runAuthWizard(cwd);
    const selection = await runJobSelectWizard(config, service, undefined, cwd);
    const params = await runParamsWizard(service, selection.jobName, config, cwd, selection.jobAlias);
    const result = await runExecuteWizard(service, selection.jobName, params, selection.serverProfile);
    if (!result) {
      printError('构建已取消');
    }
  } catch (err: any) {
    printError(err.message);
    process.exit(1);
  }
});

registerRunCommand(program);
registerBuildCommand(program);
registerStatusCommand(program);
registerConfigCommand(program);

program.parse();
