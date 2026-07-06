import type { JenkinsService } from '../services/jenkins.js';
import type { AppConfig, JobParamDef } from '../config/schema.js';
import { loadHistory, saveHistory } from '../config/store.js';
import { spinner, printInfo, printWarning } from '../utils/output.js';
import { input, confirm } from '../utils/prompt.js';
import inquirer from 'inquirer';

export async function runParamsWizard(
  service: JenkinsService,
  jobName: string,
  config: AppConfig,
  cwd: string,
  jobAlias?: string,
): Promise<Record<string, string>> {
  // 1. 从 Jenkins 获取参数定义
  const s = spinner('查询任务参数定义...');
  s.start();
  let jobInfo;
  try {
    jobInfo = await service.getJobInfo(jobName);
  } catch (err: any) {
    s.stop();
    printWarning(`无法获取任务参数: ${err.message}`);
    // 如果获取失败，尝试直接构建无参数任务
    const proceed = await confirm('是否跳过参数配置直接构建？');
    if (proceed) {
      return {};
    }
    throw err;
  }
  s.stop();

  if (jobInfo.params.length === 0) {
    printInfo('该任务没有参数定义，将直接构建');
    return {};
  }

  // 2. 合并参数值
  const mergedDefaults = mergeParams(jobInfo.params, config, jobName, cwd, jobAlias);

  // 3. 逐个展示参数，允许修改
  console.log('\n配置构建参数（回车保留当前值，输入新值修改）：\n');

  const finalParams: Record<string, string> = {};

  for (const param of jobInfo.params) {
    const currentValue = mergedDefaults[param.name] ?? param.default ?? '';
    const hint = param.description ? ` - ${param.description}` : '';

    if (param.choices && param.choices.length > 0) {
      // 选择类型参数
      const { value } = await inquirer.prompt([
        {
          type: 'list',
          name: 'value',
          message: `${param.name}${hint}:`,
          choices: param.choices.map((c) => ({
            name: c,
            value: c,
          })),
          default: currentValue,
        },
      ]);
      finalParams[param.name] = value;
    } else if (param.type === 'BooleanParameterDefinition') {
      // 布尔类型参数
      const { value } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'value',
          message: `${param.name}${hint}:`,
          default: currentValue === 'true',
        },
      ]);
      finalParams[param.name] = value.toString();
    } else {
      // 字符串/文本类型参数
      const value = await input(`${param.name}${hint} (当前: ${currentValue || '(空)'}):`, currentValue);
      finalParams[param.name] = value;
    }
  }

  // 4. 保存到历史
  saveHistory(cwd, jobName, finalParams);

  return finalParams;
}

/**
 * 参数合并：Jenkins 默认值 < 配置文件预设 < 历史记录
 */
function mergeParams(
  params: JobParamDef[],
  config: AppConfig,
  jobName: string,
  cwd: string,
  jobAlias?: string,
): Record<string, string> {
  const result: Record<string, string> = {};

  // 第一层：Jenkins 参数默认值
  for (const param of params) {
    if (param.default !== undefined && param.default !== null) {
      result[param.name] = param.default;
    }
  }

  // 第二层：配置文件中预设的参数
  const jobConfig = jobAlias ? config.jobs?.[jobAlias] : null;
  if (jobConfig?.params) {
    Object.assign(result, jobConfig.params);
  }

  // 第三层：历史记录中最近一次的参数
  const history = loadHistory(cwd);
  const historyEntry = history[jobName];
  if (historyEntry?.lastParams) {
    Object.assign(result, historyEntry.lastParams);
  }

  return result;
}
