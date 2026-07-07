import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { getBuildRecords } from '../config/store.js';
import { printSuccess, printError, printInfo, printWarning, spinner } from '../utils/output.js';
import chalk from 'chalk';

export function registerStatusCommand(program: Command): void {
  program
    .command('status [name]')
    .description('查询构建状态（无参数显示最近记录，指定 Job 名查询详情）')
    .option('-n, --number <buildNumber>', '构建号', parseInt)
    .option('-r, --recent <count>', '查看最近 N 次构建记录', parseInt)
    .option('-l, --log', '查看构建日志')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .action(async (name: string | undefined, options: { number?: number; recent?: number; log?: boolean; server?: string }) => {
      try {
        if (name) {
          // 查询指定 Job 的构建状态
          await showJobStatus(name, options);
        } else {
          // 展示最近由本工具触发的构建记录
          await showRecentBuilds();
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}

async function showRecentBuilds(): Promise<void> {
  const records = getBuildRecords(20);

  if (records.length === 0) {
    printInfo('没有本工具触发的构建记录，请先运行 jkt 或 jkt build 触发构建');
    return;
  }

  const config = loadConfig();

  console.log(chalk.bold('\n最近构建记录：\n'));

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const time = new Date(r.triggeredAt).toLocaleString('zh-CN');

    // 尝试从 Jenkins 获取最新状态
    let statusStr = chalk.gray('未知');
    if (config) {
      const profileName = r.server || config.servers.default;
      const profile = config.servers.profiles[profileName];
      if (profile) {
        try {
          const service = new JenkinsService(profile);
          const lastBuild = await service.getLastBuildSummary(r.jobName);
          if (lastBuild) {
            if (lastBuild.building) {
              statusStr = chalk.yellow(`⏳ #${lastBuild.number} 构建中`);
            } else if (lastBuild.result === 'SUCCESS') {
              statusStr = chalk.green(`✔ #${lastBuild.number} 成功`);
            } else if (lastBuild.result === 'FAILURE') {
              statusStr = chalk.red(`✖ #${lastBuild.number} 失败`);
            } else if (lastBuild.result === 'ABORTED') {
              statusStr = chalk.gray(`⊘ #${lastBuild.number} 中止`);
            } else {
              statusStr = chalk.blue(`ℹ #${lastBuild.number} ${lastBuild.result || '未知'}`);
            }
          }
        } catch {
          // ignore — show unknown
        }
      }
    }

    // 构建参数摘要
    const paramStr = r.params
      ? Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(', ')
      : '';

    console.log(`  ${chalk.bold(`#${i + 1}`)}  ${chalk.cyan(r.jobName)}  ${statusStr}`);
    console.log(`      ${chalk.gray(time)}${paramStr ? `  ${chalk.gray(paramStr)}` : ''}`);
    if (r.queueUrl) {
      console.log(`      ${chalk.blue(r.queueUrl)}`);
    }
  }
  console.log();
}

async function showJobStatus(job: string, options: { number?: number; recent?: number; log?: boolean; server?: string }): Promise<void> {
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

  // 解析 job 别名
  let jobName = job;
  if (config.jobs?.[job]) {
    jobName = config.jobs[job].name;
  }

  const service = new JenkinsService(profile);

  // 查看最近 N 次构建记录
  if (options.recent) {
    const count = options.recent || 10;
    const s = spinner(`查询 ${jobName} 最近 ${count} 次构建...`);
    s.start();
    const builds = await service.getRecentBuilds(jobName, count);
    s.stop();

    if (builds.length === 0) {
      printInfo(`${jobName} 没有构建记录`);
      return;
    }

    console.log(chalk.bold(`\n${jobName} 最近 ${builds.length} 次构建：\n`));

    for (const b of builds) {
      const time = new Date(b.timestamp).toLocaleString('zh-CN');
      const duration = b.building ? '—' : `${Math.round(b.duration / 1000)}s`;

      let statusIcon: string;
      if (b.building) {
        statusIcon = chalk.yellow('⏳ 构建中');
      } else if (b.result === 'SUCCESS') {
        statusIcon = chalk.green('✔ 成功');
      } else if (b.result === 'FAILURE') {
        statusIcon = chalk.red('✖ 失败');
      } else if (b.result === 'ABORTED') {
        statusIcon = chalk.gray('⊘ 中止');
      } else if (b.result === 'UNSTABLE') {
        statusIcon = chalk.yellow('⚠ 不稳定');
      } else if (b.result === 'NOT_BUILT') {
        statusIcon = chalk.gray('○ 未构建');
      } else {
        statusIcon = chalk.blue(`ℹ ${b.result || '未知'}`);
      }

      // 构建描述行
      const descParts: string[] = [];
      if (b.userName) {
        descParts.push(chalk.cyan(`@${b.userName}`));
      }
      if (b.description) {
        descParts.push(chalk.white(b.description));
      }
      const descLine = descParts.length > 0 ? `  ${descParts.join(' ')}` : '';

      console.log(`  ${chalk.bold(`#${b.number}`)}  ${statusIcon}  ${chalk.gray(time)}  ${chalk.gray(`耗时 ${duration}`)}${descLine}`);
    }
    console.log();
    return;
  }

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
}
