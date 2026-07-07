import type { JenkinsService, BuildResult } from '../services/jenkins.js';
import { printSuccess, printError, printSummary, spinner } from '../utils/output.js';
import { confirm } from '../utils/prompt.js';
import { addBuildRecord } from '../config/store.js';

/**
 * Strip embedded credentials from a URL.
 * http://user:pass@host/path → http://host/path
 */
function stripAuthFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function runExecuteWizard(
  service: JenkinsService,
  jobName: string,
  params: Record<string, string>,
  serverProfile: string,
  cwd?: string,
): Promise<BuildResult | null> {
  // 1. 展示执行摘要
  const items = [
    { label: '构建任务', value: jobName },
    { label: '服务器', value: serverProfile },
  ];

  const paramKeys = Object.keys(params);
  if (paramKeys.length > 0) {
    items.push({ label: '参数', value: '' });
    for (const key of paramKeys) {
      items.push({ label: `  ${key}`, value: params[key] });
    }
  }

  printSummary('执行摘要', items);

  // 2. 确认执行
  const confirmed = await confirm('确认执行构建？', true);
  if (!confirmed) {
    return null;
  }

  // 3. 提交构建
  const s = spinner('正在提交构建...');
  s.start();
  try {
    const result = await service.build(jobName, params);
    s.stop();

    // 输出构建结果
    if (result.buildNumber) {
      const buildUrl = stripAuthFromUrl(result.queueUrl).replace(/\/queue\/item\/\d+\/?/, `/job/${encodeURIComponent(jobName)}/${result.buildNumber}`);
      printSuccess(`构建 #${result.buildNumber} 已提交！`);
      console.log(`  URL: ${buildUrl}`);
    } else {
      printSuccess(`构建已提交！`);
      if (result.queueUrl) {
        console.log(`  队列: ${stripAuthFromUrl(result.queueUrl)}`);
      }
    }

    // 4. 记录构建历史
    if (cwd) {
      addBuildRecord(cwd, {
        jobName,
        buildNumber: result.buildNumber,
        params: Object.keys(params).length > 0 ? params : undefined,
        triggeredAt: new Date().toISOString(),
        server: serverProfile,
        queueUrl: stripAuthFromUrl(result.queueUrl),
      });
    }

    return result;
  } catch (err: any) {
    s.stop();
    printError(`构建提交失败: ${err.message}`);
    throw err;
  }
}
