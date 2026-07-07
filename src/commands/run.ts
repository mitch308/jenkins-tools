import { Command } from 'commander';
import { runAuthWizard } from '../wizard/auth.js';
import { runJobSelectWizard } from '../wizard/job-select.js';
import { runParamsWizard } from '../wizard/params.js';
import { runExecuteWizard } from '../wizard/execute.js';
import { printError } from '../utils/output.js';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('启动交互式构建向导')
    .option('-j, --job <job>', '预选任务（跳过任务选择步骤）')
    .action(async (options: { job?: string }) => {
      try {
        const cwd = process.cwd();

        // Step 1: 认证
        const { config, service, profileName } = await runAuthWizard(cwd);

        // Step 2: 选择任务
        const selection = await runJobSelectWizard(config, service, options.job, cwd);

        // Step 3: 配置参数
        const params = await runParamsWizard(service, selection.jobName, config, cwd, selection.jobAlias);

        // Step 4: 提交执行
        const result = await runExecuteWizard(service, selection.jobName, params, selection.serverProfile, cwd);
        if (!result) {
          printError('构建已取消');
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
