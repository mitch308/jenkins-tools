import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { getBuildRecords } from '../config/store.js';
import { printSuccess, printError, printInfo, spinner, printWarning } from '../utils/output.js';
import { select, input, confirm } from '../utils/prompt.js';
import chalk from 'chalk';

export function registerAbortCommand(program: Command): void {
  program
    .command('abort [job]')
    .description('中止/删除构建任务')
    .helpOption('-h, --help', '显示帮助信息')
    .option('-n, --number <buildNumber>', '构建号', parseInt)
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .action(async (job: string | undefined, options: { number?: number; server?: string }) => {
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

        const service = new JenkinsService(profile);

        // 解析 job 别名
        let jobName = job;
        if (job && config.jobs?.[job]) {
          jobName = config.jobs[job].name;
        }

        // 如果指定了 job 和构建号，直接操作
        if (jobName && options.number) {
          await abortOrDelete(service, jobName, options.number);
          return;
        }

        // 如果指定了 job 但没有构建号，查询该 job 最近构建
        if (jobName) {
          const s = spinner(`查询 ${jobName} 最近构建...`);
          s.start();
          const buildNumber = await service.getLastBuildNumber(jobName);
          s.stop();
          if (!buildNumber) {
            printInfo(`${jobName} 没有构建记录`);
            return;
          }
          await abortOrDelete(service, jobName, buildNumber);
          return;
        }

        // 如果只指定了构建号，用上次构建的 job
        if (options.number) {
          const lastJob = (await import('../config/store.js')).getLastJob();
          if (!lastJob) {
            printError('请指定 Job 名称：jkt abort <job> -n <buildNumber>');
            process.exit(1);
          }
          await abortOrDelete(service, lastJob, options.number);
          return;
        }

        // 展示最近构建记录供选择
        const records = getBuildRecords(20);
        if (records.length === 0) {
          printInfo('没有本工具触发的构建记录');
          return;
        }

        // 查询每个记录的实时状态
        const s = spinner('查询构建状态...');
        s.start();
        const statuses: Array<{
          jobName: string;
          buildNumber?: number;
          building: boolean;
          result: string | null;
          queueUrl?: string;
        }> = [];

        for (const r of records) {
          if (r.buildNumber) {
            try {
              const status = await service.getBuildStatus(r.jobName, r.buildNumber);
              statuses.push({
                jobName: r.jobName,
                buildNumber: r.buildNumber,
                building: status.building,
                result: status.result,
                queueUrl: r.queueUrl,
              });
            } catch {
              // 构建可能还在排队中，检查队列
              let isQueued = false;
              if (r.queueUrl) {
                try {
                  const queueInfo = await service.getQueueItemStatus(r.queueUrl);
                  if (!queueInfo.cancelled) isQueued = true;
                } catch { /* ignore */ }
              }
              if (!isQueued) {
                try {
                  const queued = await service.findQueuedItem(r.jobName, r.buildNumber);
                  if (queued) isQueued = true;
                } catch { /* ignore */ }
              }
              statuses.push({
                jobName: r.jobName,
                buildNumber: r.buildNumber,
                building: isQueued,
                result: isQueued ? 'QUEUED' : null,
                queueUrl: r.queueUrl,
              });
            }
          }
        }
        s.stop();

        // 筛选出可以进行操作的构建（构建中的可中止，已完成的可删除）
        const choices = statuses.map((st, i) => {
          let label = '';
          if (st.result === 'QUEUED') {
            label = chalk.magenta(`⏳ #${st.buildNumber} 排队中`) + ` — ${chalk.cyan(st.jobName)}  [取消]`;
          } else if (st.building) {
            label = chalk.yellow(`⏳ #${st.buildNumber} 构建中`) + ` — ${chalk.cyan(st.jobName)}  [中止]`;
          } else if (st.result === 'SUCCESS') {
            label = chalk.green(`✔ #${st.buildNumber} 成功`) + ` — ${chalk.cyan(st.jobName)}  [删除]`;
          } else if (st.result === 'FAILURE') {
            label = chalk.red(`✖ #${st.buildNumber} 失败`) + ` — ${chalk.cyan(st.jobName)}  [删除]`;
          } else if (st.result === 'ABORTED') {
            label = chalk.gray(`⊘ #${st.buildNumber} 已中止`) + ` — ${chalk.cyan(st.jobName)}`;
          } else {
            label = `ℹ #${st.buildNumber} ${st.result || '未知'} — ${chalk.cyan(st.jobName)}`;
          }
          return { name: label, value: i };
        });

        choices.push({ name: '手动输入 Job 和构建号', value: -1 });

        const selected = await select('选择要操作的构建:', choices);

        if (selected === -1) {
          const jobName = await input('输入 Job 名称:');
          const buildNumStr = await input('输入构建号:');
          const buildNumber = parseInt(buildNumStr);
          if (isNaN(buildNumber)) {
            printError('构建号必须是数字');
            process.exit(1);
          }
          await abortOrDelete(service, jobName, buildNumber);
          return;
        }

        const target = statuses[selected];
        if (target.buildNumber) {
          await abortOrDelete(service, target.jobName, target.buildNumber, target.queueUrl);
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}

async function abortOrDelete(service: JenkinsService, jobName: string, buildNumber: number, queueUrl?: string): Promise<void> {
  // 先查询构建状态
  const s = spinner(`查询构建 #${buildNumber} 状态...`);
  s.start();
  let status;
  let isQueued = false;
  let queuedItemId: number | undefined;
  try {
    status = await service.getBuildStatus(jobName, buildNumber);
  } catch {
    // 构建可能还在排队中，尝试通过队列 API 查找
    s.stop();

    // 1. 如果有 queueUrl，直接查队列状态
    if (queueUrl) {
      try {
        const queueInfo = await service.getQueueItemStatus(queueUrl);
        if (!queueInfo.cancelled) {
          isQueued = true;
          queuedItemId = queueInfo.id;
        }
      } catch {
        // queueUrl 也访问不了
      }
    }

    // 2. 如果没有 queueUrl 或队列也没找到，尝试在 Jenkins 队列中搜索
    if (!isQueued) {
      try {
        const queued = await service.findQueuedItem(jobName);
        if (queued) {
          isQueued = true;
          queuedItemId = queued.id;
        }
      } catch {
        // 队列 API 也失败
      }
    }

    if (!isQueued) {
      printError(`构建 #${buildNumber} 不存在或无法访问（可能未分配到执行器，且不在队列中）`);
      return;
    }
  }
  s.stop();

  // 处理排队中的构建
  if (isQueued) {
    printWarning(`构建 #${buildNumber} 正在排队中，尚未开始执行`);
    const confirmed = await confirm(`确认取消 ${chalk.cyan(jobName)} 排队中的构建？`, true);
    if (!confirmed) return;

    const s2 = spinner(`正在取消排队...`);
    s2.start();
    try {
      // cancelQueueItem 支持 queueUrl 或 queueItemId
      await service.cancelQueueItem(queuedItemId ?? queueUrl!);
      s2.stop();
      printSuccess(`排队中的构建已取消`);
    } catch (err: any) {
      s2.stop();
      printError(`取消排队失败: ${err.message}`);
    }
    return;
  }

  // At this point status is guaranteed to be set (isQueued path returns early)
  if (status!.building) {
    // 构建中 → 中止
    const confirmed = await confirm(`确认中止 ${chalk.cyan(jobName)} #${buildNumber}？`, true);
    if (!confirmed) return;

    const s2 = spinner(`正在中止 #${buildNumber}...`);
    s2.start();
    try {
      await service.abortBuild(jobName, buildNumber);
      s2.stop();
      printSuccess(`构建 #${buildNumber} 已中止`);
    } catch (err: any) {
      s2.stop();
      printError(`中止失败: ${err.message}`);
    }
  } else {
    // 已完成 → 删除
    printWarning(`构建 #${buildNumber} 已完成 (${status!.result || '未知'})`);
    const action = await select('请选择操作:', [
      { name: '删除构建记录', value: 'delete' },
      { name: '取消', value: 'cancel' },
    ]);

    if (action === 'cancel') return;

    const s2 = spinner(`正在删除 #${buildNumber}...`);
    s2.start();
    try {
      await service.deleteBuild(jobName, buildNumber);
      s2.stop();
      printSuccess(`构建 #${buildNumber} 已删除`);
    } catch (err: any) {
      s2.stop();
      printError(`删除失败: ${err.message}`);
    }
  }
}
