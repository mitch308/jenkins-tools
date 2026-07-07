import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { addBuildRecord } from '../config/store.js';
import { runParamsWizard } from '../wizard/params.js';
import { printSuccess, printError, spinner } from '../utils/output.js';

export function registerBuildCommand(program: Command): void {
  program
    .command('build <job>')
    .description('快捷构建（跳过向导，直接触发）')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .option('-p, --param <params...>', '构建参数，格式: KEY=VALUE')
    .action(async (job: string, options: { server?: string; param?: string[] }) => {
      try {
        const cwd = process.cwd();
        const config = loadConfig(cwd);
        if (!config) {
          printError('未找到配置文件，请先运行 jkt config init');
          process.exit(1);
        }

        const profileName = options.server || config.servers.default;
        const profile = config.servers.profiles[profileName];
        if (!profile) {
          printError(`服务器 Profile "${profileName}" 不存在`);
          process.exit(1);
        }

        // 如果 job 是别名，解析为实际路径
        let jobName = job;
        let jobAlias: string | undefined;
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
          jobAlias = job;
        }

        const service = new JenkinsService(profile);

        // 解析参数
        let params: Record<string, string> = {};
        if (options.param && options.param.length > 0) {
          // 通过 -p 传入的参数
          for (const p of options.param) {
            const eqIndex = p.indexOf('=');
            if (eqIndex === -1) {
              printError(`参数格式错误: "${p}"，应为 KEY=VALUE`);
              process.exit(1);
            }
            const key = p.substring(0, eqIndex);
            const value = p.substring(eqIndex + 1);
            params[key] = value;
          }
        } else {
          // 未传 -p 参数，进入参数配置向导
          params = await runParamsWizard(service, jobName, config, cwd, jobAlias);
        }

        const s = spinner(`正在构建 ${jobName}...`);
        s.start();
        const result = await service.build(jobName, Object.keys(params).length > 0 ? params : undefined);
        s.stop();

        printSuccess(`构建已提交！队列地址: ${result.queueUrl || '(已触发)'}`);

        // 记录构建历史
        addBuildRecord(cwd, {
          jobName,
          buildNumber: result.buildNumber,
          params: Object.keys(params).length > 0 ? params : undefined,
          triggeredAt: new Date().toISOString(),
          server: profileName,
        });
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
