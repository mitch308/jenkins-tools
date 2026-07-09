import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printError } from '../utils/output.js';

export function registerParamsCommand(program: Command): void {
  program
    .command('params <job>')
    .description('查询任务的参数定义')
    .helpOption('-h, --help', '显示帮助信息')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .option('-j, --json', '以 JSON 格式输出')
    .action(async (job: string, options: { server?: string; json?: boolean }) => {
      try {
        const config = loadConfig();
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
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
        }

        const service = new JenkinsService(profile);
        const jobInfo = await service.getJobInfo(jobName);

        if (options.json) {
          // JSON 输出（供 agent/程序解析）
          console.log(JSON.stringify({
            name: jobInfo.name,
            buildable: jobInfo.buildable,
            params: jobInfo.params.map(p => ({
              name: p.name,
              type: p.type,
              default: p.default ?? null,
              description: p.description ?? null,
              choices: p.choices ?? null,
            })),
          }, null, 2));
        } else {
          // 人类可读输出
          console.log(`\n任务: ${jobInfo.name}`);
          console.log(`可构建: ${jobInfo.buildable ? '是' : '否'}`);
          console.log(`\n参数 (${jobInfo.params.length} 个):`);

          if (jobInfo.params.length === 0) {
            console.log('  (无参数)');
          } else {
            for (const p of jobInfo.params) {
              console.log(`\n  ${p.name}`);
              console.log(`    类型: ${p.type}`);
              if (p.description) console.log(`    描述: ${p.description}`);
              if (p.default) console.log(`    默认值: ${p.default}`);
              if (p.choices && p.choices.length > 0) {
                console.log(`    可选值: ${p.choices.join(', ')}`);
              }
            }
          }
          console.log('');
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}