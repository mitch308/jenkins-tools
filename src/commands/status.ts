import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printSuccess, printError, printInfo, spinner } from '../utils/output.js';
import chalk from 'chalk';

export function registerStatusCommand(program: Command): void {
  program
    .command('status <job>')
    .description('查询构建状态')
    .option('-n, --number <buildNumber>', '构建号', parseInt)
    .option('-l, --log', '查看构建日志')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .action(async (job: string, options: { number?: number; log?: boolean; server?: string }) => {
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

        // 解析 job 别名
        let jobName = job;
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
        }

        const service = new JenkinsService(profile);

        // 获取构建号
        let buildNumber = options.number;
        if (!buildNumber) {
          const s = spinner('查询最近构建...');
          s.start();
          buildNumber = await service.getLastBuildNumber(jobName);
          s.stop();
        }

        if (!buildNumber) {
          printInfo('没有找到构建记录');
          return;
        }

        // 查看日志
        if (options.log) {
          const s = spinner(`获取构建 #${buildNumber} 日志...`);
          s.start();
          const log = await service.getBuildLog(jobName, buildNumber);
          s.stop();
          console.log(log);
          return;
        }

        // 查询状态
        const s = spinner(`查询构建 #${buildNumber} 状态...`);
        s.start();
        const status = await service.getBuildStatus(jobName, buildNumber);
        s.stop();

        const statusIcon = status.building
          ? chalk.yellow('⏳ 构建中')
          : status.result === 'SUCCESS'
            ? chalk.green('✔ 成功')
            : status.result === 'FAILURE'
              ? chalk.red('✖ 失败')
              : status.result === 'ABORTED'
                ? chalk.gray('⊘ 中止')
                : chalk.blue(`ℹ ${status.result || '未知'}`);

        console.log(`\n构建 #${status.number}  ${statusIcon}`);
        console.log(`URL: ${status.url}`);
        console.log(`耗时: ${Math.round(status.duration / 1000)}s`);
        console.log();
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
