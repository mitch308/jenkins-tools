import type { AppConfig } from '../config/schema.js';
import type { JenkinsService, BuildStatus } from '../services/jenkins.js';
import { select, input } from '../utils/prompt.js';
import { getLastJob } from '../config/store.js';
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
    if (config.jobs?.[preselectedJob]) {
      const job = config.jobs[preselectedJob];
      return {
        jobName: job.name,
        jobAlias: preselectedJob,
        serverProfile: job.server,
      };
    }
    return {
      jobName: preselectedJob,
      serverProfile: config.servers.default,
    };
  }

  const jobs = config.jobs || {};
  const jobKeys = Object.keys(jobs);
  const lastJob = getLastJob();

  if (jobKeys.length > 0) {
    // 有预配置的任务：展示列表 + 最近构建状态
    return selectFromPresets(config, service, jobs, jobKeys, lastJob);
  }

  // 没有预配置的任务：搜索 Jenkins 上的 Job
  return searchAndSelect(config, service, lastJob);
}

async function selectFromPresets(
  config: AppConfig,
  service: JenkinsService,
  jobs: Record<string, import('../config/schema.js').JobConfig>,
  jobKeys: string[],
  lastJob?: string,
): Promise<JobSelection> {
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
  choices.push({ name: '搜索其他任务...', value: '__search__' });
  choices.push({ name: '手动输入任务名称', value: '__manual__' });

  // 默认选中上次构建的任务（如果它在预配置列表中）
  const defaultChoice = lastJob && jobKeys.includes(lastJob) ? lastJob : undefined;

  const selected = await select('选择要执行的构建任务:', choices, defaultChoice);

  if (selected === '__manual__') {
    const jobName = await input('输入 Jenkins Job 名称:');
    return { jobName, serverProfile: config.servers.default };
  }

  if (selected === '__search__') {
    return searchAndSelect(config, service, lastJob);
  }

  const job = jobs[selected];
  return {
    jobName: job.name,
    jobAlias: selected,
    serverProfile: job.server,
  };
}

async function searchAndSelect(
  config: AppConfig,
  service: JenkinsService,
  lastJob?: string,
): Promise<JobSelection> {
  // 获取所有 Job 名称（带缓存，只查一次）
  const spinner = (await import('../utils/output.js')).spinner;
  const s = spinner('获取 Jenkins 任务列表...');
  s.start();
  let allJobs: string[];
  try {
    allJobs = await service.getJobNames();
  } catch {
    s.stop();
    // 获取失败则退回手动输入
    const jobName = await input('输入 Jenkins Job 名称:', lastJob);
    return { jobName, serverProfile: config.servers.default };
  }
  s.stop();

  // 循环搜索，直到用户选中或退出
  while (true) {
    const keyword = await input('搜索任务名称（输入关键词，回车列出全部）:', lastJob);
    const filtered = keyword
      ? allJobs.filter((j) => j.toLowerCase().includes(keyword.toLowerCase()))
      : allJobs;

    if (filtered.length === 0) {
      (await import('../utils/output.js')).printWarning('没有匹配的任务，请换关键词重试');
      continue;
    }

    // 限制显示数量
    const MAX_SHOW = 20;
    const displayed = filtered.slice(0, MAX_SHOW);

    // 并行查询最近构建
    const summaries = await Promise.all(
      displayed.map(async (name) => {
        const build = await service.getLastBuildSummary(name);
        return { name, build };
      }),
    );

    const choices = summaries.map(({ name, build }) => ({
      name: `${name}  ${formatBuildSummary(build)}`,
      value: name,
    }));

    if (filtered.length > MAX_SHOW) {
      choices.push({ name: chalk.gray(`...还有 ${filtered.length - MAX_SHOW} 个结果，请缩小搜索范围`), value: '__more__' });
    }
    choices.push({ name: '重新搜索', value: '__research__' });
    choices.push({ name: '手动输入任务名称', value: '__manual__' });

    // 默认选中上次构建的任务（如果在结果列表中）
    const defaultChoice = lastJob && displayed.includes(lastJob) ? lastJob : undefined;

    const selected = await select(`搜索结果 (${filtered.length} 个):`, choices, defaultChoice);

    if (selected === '__research__') continue;
    if (selected === '__more__') continue;
    if (selected === '__manual__') {
      const jobName = await input('输入 Jenkins Job 名称:', lastJob);
      return { jobName, serverProfile: config.servers.default };
    }

    return { jobName: selected, serverProfile: config.servers.default };
  }
}
