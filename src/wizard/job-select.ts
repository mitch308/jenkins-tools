import type { AppConfig } from '../config/schema.js';
import type { JenkinsService, BuildStatus } from '../services/jenkins.js';
import { select, input } from '../utils/prompt.js';
import chalk from 'chalk';

export interface JobSelection {
  jobName: string;       // Jenkins job 路径，如 "frontend/deploy-main"
  jobAlias?: string;     // 配置文件中的别名，如 "frontend-deploy"
  serverProfile: string; // 使用的服务器 profile 名
}

function formatBuildSummary(build: BuildStatus | null): string {
  if (!build) return chalk.gray('无构建记录');
  if (build.building) {
    const elapsed = Math.round((Date.now() - build.timestamp) / 1000);
    return chalk.yellow(`⏳ #${build.number} 构建中 (${elapsed}s)`);
  }
  const time = new Date(build.timestamp).toLocaleString('zh-CN');
  const duration = Math.round(build.duration / 1000);
  const icon = build.result === 'SUCCESS' ? chalk.green('✔')
    : build.result === 'FAILURE' ? chalk.red('✖')
    : build.result === 'ABORTED' ? chalk.gray('⊘')
    : chalk.blue('ℹ');
  return `${icon} #${build.number} ${build.result || '未知'} ${time} (${duration}s)`;
}

export async function runJobSelectWizard(
  config: AppConfig,
  service: JenkinsService,
  preselectedJob?: string,
): Promise<JobSelection> {
  // 如果通过 --job 参数预选了任务
  if (preselectedJob) {
    // 先在配置中查找
    if (config.jobs?.[preselectedJob]) {
      const job = config.jobs[preselectedJob];
      return {
        jobName: job.name,
        jobAlias: preselectedJob,
        serverProfile: job.server,
      };
    }
    // 直接当作 Jenkins job 路径
    return {
      jobName: preselectedJob,
      serverProfile: config.servers.default,
    };
  }

  const jobs = config.jobs || {};
  const jobKeys = Object.keys(jobs);

  if (jobKeys.length === 0) {
    // 没有预配置的任务，直接手动输入
    const jobName = await input('输入 Jenkins Job 名称（如 frontend/deploy-main）:');
    return {
      jobName,
      serverProfile: config.servers.default,
    };
  }

  // 并行查询所有 Job 的最近构建状态
  const summaries = await Promise.all(
    jobKeys.map(async (key) => {
      const build = await service.getLastBuildSummary(jobs[key].name);
      return { key, build };
    }),
  );

  const summaryMap = new Map(summaries.map((s) => [s.key, s.build]));

  const choices = jobKeys.map((key) => ({
    name: `${key} (${jobs[key].name}) [${jobs[key].server}] ${formatBuildSummary(summaryMap.get(key) ?? null)}`,
    value: key,
  }));
  choices.push({ name: '手动输入任务名称', value: '__manual__' });

  const selected = await select('选择要执行的构建任务:', choices);

  if (selected === '__manual__') {
    const jobName = await input('输入 Jenkins Job 名称（如 frontend/deploy-main）:');
    return {
      jobName,
      serverProfile: config.servers.default,
    };
  }

  const job = jobs[selected];
  return {
    jobName: job.name,
    jobAlias: selected,
    serverProfile: job.server,
  };
}
