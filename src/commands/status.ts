import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { getBuildRecords } from '../config/store.js';
import { printSuccess, printError, printInfo, printWarning, spinner, stripAuthFromUrl } from '../utils/output.js';
import chalk from 'chalk';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join('');
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status [name]')
    .description('查询构建状态（无参数显示最近记录，指定 Job 名查询详情）')
    .helpOption('-h, --help', '显示帮助信息')
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
  const records = getBuildRecords(10);

  if (records.length === 0) {
    printInfo('没有本工具触发的构建记录，请先运行 jkt 或 jkt build 触发构建');
    return;
  }

  const config = loadConfig();

  console.log(chalk.bold('\n最近构建记录：\n'));

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const time = new Date(r.triggeredAt).toLocaleString('zh-CN');

    // 构建参数摘要
    const paramStr = r.params
      ? Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(', ')
      : '';

    // 无构建号（旧数据或推算失败）：不联网查询
    if (!r.buildNumber) {
      const statusStr = chalk.gray('未知构建号');
      console.log(`  ${chalk.bold(`#${i + 1}`)}  ${chalk.cyan(r.jobName)}  ${statusStr}`);
      console.log(`      ${chalk.gray(time)}${paramStr ? `  ${chalk.gray(paramStr)}` : ''}`);
      if (r.queueUrl) {
        console.log(`      ${chalk.blue(r.queueUrl)}`);
      }
      continue;
    }

    // 用记录自身的构建号查询真实状态
    let statusStr = chalk.gray('未知');
    let urlStr = r.queueUrl || '';
    if (config) {
      const profileName = r.server || config.servers.default;
      const profile = config.servers.profiles[profileName];
      if (profile) {
        const service = new JenkinsService(profile);
        const buildUrl = `${profile.url.replace(/\/+$/, '')}/job/${encodeURIComponent(r.jobName)}/${r.buildNumber}/`;
        try {
          const status = await service.getBuildStatus(r.jobName, r.buildNumber);
          if (status.result === null && !status.building) {
            statusStr = chalk.blue(`ℹ #${status.number} 待执行`);
          } else if (status.building) {
            statusStr = chalk.yellow(`⏳ #${status.number} 构建中`);
          } else if (status.result === 'SUCCESS') {
            statusStr = chalk.green(`✔ #${status.number} 成功`);
          } else if (status.result === 'FAILURE') {
            statusStr = chalk.red(`✖ #${status.number} 失败`);
          } else if (status.result === 'ABORTED') {
            statusStr = chalk.gray(`⊘ #${status.number} 中止`);
          } else {
            statusStr = chalk.blue(`ℹ #${status.number} ${status.result || '未知'}`);
          }
          // 已执行：显示构建地址
          urlStr = stripAuthFromUrl(buildUrl);
        } catch {
          // Build API 不可访问，可能仍在排队中
          try {
            const queued = await service.findQueuedItem(r.jobName, r.buildNumber);
            if (queued && !queued.cancelled) {
              statusStr = chalk.magenta(`⏳ #${r.buildNumber} 排队中`);
              if (queued.why) {
                // 排队中：显示队列地址
                urlStr = r.queueUrl ? stripAuthFromUrl(r.queueUrl) : urlStr;
              }
            } else {
              statusStr = chalk.gray(`# ${r.buildNumber} 不存在或无法访问`);
            }
          } catch {
            // ignore — show unknown
          }
        }
      }
    }

    console.log(`  ${chalk.bold(`#${i + 1}`)}  ${chalk.cyan(r.jobName)}  ${statusStr}`);
    console.log(`      ${chalk.gray(time)}${paramStr ? `  ${chalk.gray(paramStr)}` : ''}`);
    if (urlStr) {
      console.log(`      ${chalk.blue(urlStr)}`);
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
      const duration = b.building ? '—' : formatDuration(b.duration);

      let statusIcon: string;
      let numberLabel: string;
      if (b.queued) {
        statusIcon = chalk.magenta('⏳ 排队中');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.pending) {
        statusIcon = chalk.blue('⏳ 待执行');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.building) {
        statusIcon = chalk.yellow('⏳ 构建中');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.result === 'SUCCESS') {
        statusIcon = chalk.green('✔ 成功');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.result === 'FAILURE') {
        statusIcon = chalk.red('✖ 失败');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.result === 'ABORTED') {
        statusIcon = chalk.gray('⊘ 中止');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.result === 'UNSTABLE') {
        statusIcon = chalk.yellow('⚠ 不稳定');
        numberLabel = chalk.bold(`#${b.number}`);
      } else if (b.result === 'NOT_BUILT') {
        statusIcon = chalk.gray('○ 未构建');
        numberLabel = chalk.bold(`#${b.number}`);
      } else {
        statusIcon = chalk.blue(`ℹ ${b.result || '未知'}`);
        numberLabel = chalk.bold(`#${b.number}`);
      }

      // 构建描述行
      const descParts: string[] = [];
      if (b.userName) {
        descParts.push(chalk.cyan(`@${b.userName}`));
      }
      if (b.description) {
        descParts.push(chalk.white(b.description));
      }
      if (b.queued && b.queueWhy) {
        descParts.push(chalk.gray(b.queueWhy));
      }
      const descLine = descParts.length > 0 ? `  ${descParts.join(' ')}` : '';

      // 参数信息行
      const paramLine = b.params && Object.keys(b.params).length > 0
        ? `\n      ${chalk.gray(Object.entries(b.params).map(([k, v]) => `${k}=${v}`).join(', '))}`
        : '';

      console.log(`  ${numberLabel}  ${statusIcon}  ${chalk.gray(time)}  ${chalk.gray(`耗时 ${duration}`)}${descLine}${paramLine}`);
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
    try {
      const log = await service.getBuildLog(jobName, buildNumber);
      s.stop();
      console.log(log);
    } catch {
      s.stop();
      printError(`构建 #${buildNumber} 尚未开始执行，暂无日志`);
    }
    return;
  }

  // 查询状态
  const s = spinner(`查询构建 #${buildNumber} 状态...`);
  s.start();
  try {
    const status = await service.getBuildStatus(jobName, buildNumber);
    s.stop();

    // Pending: result=null && building=false
    if (status.result === null && !status.building) {
      console.log(`\n构建 #${status.number}  ${chalk.blue('⏳ 待执行')}`);
      console.log(`URL: ${status.url}`);
      console.log(`状态: 已分配构建号，等待执行器启动`);
      if (status.params && Object.keys(status.params).length > 0) {
        console.log(`参数: ${chalk.gray(Object.entries(status.params).map(([k, v]) => `${k}=${v}`).join(', '))}`);
      }
      console.log();
      return;
    }

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
    console.log(`耗时: ${formatDuration(status.duration)}`);
    if (status.userName) {
      console.log(`用户: ${chalk.cyan(`@${status.userName}`)}`);
    }
    if (status.params && Object.keys(status.params).length > 0) {
      console.log(`参数: ${chalk.gray(Object.entries(status.params).map(([k, v]) => `${k}=${v}`).join(', '))}`);
    }
    console.log();
  } catch {
    // Build API 不可访问，可能还在排队中，查队列
    s.stop();

    const s2 = spinner('查询队列...');
    s2.start();
    const queued = await service.findQueuedItem(jobName, buildNumber);
    s2.stop();

    if (queued && !queued.cancelled) {
      console.log(`\n构建 #${buildNumber}  ${chalk.magenta('⏳ 排队中')}`);
      console.log(`队列ID: ${queued.id}`);
      if (queued.why) {
        console.log(`原因: ${queued.why}`);
      }
      if (queued.userName) {
        console.log(`用户: ${chalk.cyan(`@${queued.userName}`)}`);
      }
      if (queued.params && Object.keys(queued.params).length > 0) {
        console.log(`参数: ${chalk.gray(Object.entries(queued.params).map(([k, v]) => `${k}=${v}`).join(', '))}`);
      }
      console.log();
    } else {
      printError(`构建 #${buildNumber} 不存在或无法访问`);
    }
  }
}
