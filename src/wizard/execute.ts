import type { JenkinsService, BuildResult } from '../services/jenkins.js';
import { printSuccess, printError, printSummary, spinner } from '../utils/output.js';
import { confirm } from '../utils/prompt.js';

export async function runExecuteWizard(
  service: JenkinsService,
  jobName: string,
  params: Record<string, string>,
  serverProfile: string,
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
    printSuccess(`构建已提交！队列地址: ${result.queueUrl || '(已触发)'}`);
    return result;
  } catch (err: any) {
    s.stop();
    printError(`构建提交失败: ${err.message}`);
    throw err;
  }
}
