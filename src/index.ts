import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerBuildCommand } from './commands/build.js';
import { registerStatusCommand } from './commands/status.js';
import { registerAbortCommand } from './commands/abort.js';
import { registerConfigCommand } from './commands/config.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('jkt')
  .description('Interactive Jenkins CLI tool')
  .version(version)
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

program.parse();
