import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
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

        // 解析参数
        const params: Record<string, string> = {};
        if (options.param) {
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
        }

        // 如果 job 是别名，解析为实际路径
        let jobName = job;
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
        }

        const service = new JenkinsService(profile);
        const s = spinner(`正在构建 ${jobName}...`);
        s.start();
        const result = await service.build(jobName, Object.keys(params).length > 0 ? params : undefined);
        s.stop();

        printSuccess(`构建已提交！队列地址: ${result.queueUrl || '(已触发)'}`);
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
