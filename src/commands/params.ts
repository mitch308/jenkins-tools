import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { loadParamDefs, saveParamDefs, loadHistory } from '../config/store.js';
import { printError, printInfo } from '../utils/output.js';
import type { JobParamDef } from '../config/schema.js';

export function registerParamsCommand(program: Command): void {
  program
    .command('params <job>')
    .description('查询任务的参数定义（默认读取本地缓存）')
    .helpOption('-h, --help', '显示帮助信息')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .option('--json', '以 JSON 格式输出')
    .option('-r, --remote', '从远程 Jenkins 获取参数定义（同时更新本地缓存）')
    .option('--sync', '从远程同步参数（删除已移除的 key，新增 key 使用默认值）')
    .action(async (job: string, options: { server?: string; json?: boolean; remote?: boolean; sync?: boolean }) => {
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

        // --sync 模式：远程获取 + 与本地对比同步
        if (options.sync) {
          await handleSync(jobName, profile, options.json);
          return;
        }

        // --remote 模式：从远程获取并更新缓存
        if (options.remote) {
          await handleRemote(jobName, profile, options.json);
          return;
        }

        // 默认模式：从本地缓存读取
        await handleLocal(jobName, profile, options.json);
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}

/**
 * 默认模式：从本地缓存读取参数定义
 * 如果本地无缓存，自动从远程获取并缓存
 */
async function handleLocal(
  jobName: string,
  profile: any,
  jsonOutput?: boolean,
): Promise<void> {
  const cachedDefs = loadParamDefs(jobName);
  const history = loadHistory();
  const lastParams = history[jobName]?.lastParams;

  if (!cachedDefs) {
    // 本地无缓存，自动从远程获取
    if (!jsonOutput) {
      printInfo('本地无缓存，正在从远程获取参数定义...');
    }
    const service = new JenkinsService(profile);
    const jobInfo = await service.getJobInfo(jobName);
    // 保存到本地缓存
    saveParamDefs(jobName, lastParams || {}, jobInfo.params);

    if (jsonOutput) {
      outputJson(jobInfo.name, jobInfo.buildable, jobInfo.params, 'remote', lastParams);
    } else {
      outputHuman(jobInfo.name, jobInfo.buildable, jobInfo.params, 'remote', lastParams);
    }
    return;
  }

  if (jsonOutput) {
    outputJson(jobName, true, cachedDefs, 'local', lastParams);
  } else {
    outputHuman(jobName, true, cachedDefs, 'local', lastParams);
  }
}

/**
 * 远程模式：从 Jenkins 获取参数定义并更新本地缓存
 */
async function handleRemote(
  jobName: string,
  profile: any,
  jsonOutput?: boolean,
): Promise<void> {
  const service = new JenkinsService(profile);
  const jobInfo = await service.getJobInfo(jobName);
  const history = loadHistory();
  const lastParams = history[jobName]?.lastParams;

  // 更新本地缓存
  saveParamDefs(jobName, lastParams || {}, jobInfo.params);

  if (jsonOutput) {
    outputJson(jobInfo.name, jobInfo.buildable, jobInfo.params, 'remote', lastParams);
  } else {
    outputHuman(jobInfo.name, jobInfo.buildable, jobInfo.params, 'remote', lastParams);
  }
}

/**
 * 同步模式：从远程获取参数定义，与本地缓存对比，同步 key 变更
 */
async function handleSync(
  jobName: string,
  profile: any,
  jsonOutput?: boolean,
): Promise<void> {
  const service = new JenkinsService(profile);
  const jobInfo = await service.getJobInfo(jobName);
  const remoteDefs = jobInfo.params;
  const remoteKeys = new Set(remoteDefs.map(p => p.name));

  // 加载本地缓存
  const localDefs = loadParamDefs(jobName) || [];
  const localKeys = new Set(localDefs.map(p => p.name));
  const history = loadHistory();
  const lastParams = { ...(history[jobName]?.lastParams || {}) };

  // 计算差异
  const added = remoteDefs.filter(p => !localKeys.has(p.name));
  const removed = localDefs.filter(p => !remoteKeys.has(p.name));

  // 同步 lastParams：删除已移除的 key
  for (const p of removed) {
    delete lastParams[p.name];
  }

  // 同步 lastParams：新增 key 使用远程默认值
  for (const p of added) {
    lastParams[p.name] = p.default ?? '';
  }

  // 更新本地缓存
  saveParamDefs(jobName, lastParams, remoteDefs);

  if (jsonOutput) {
    outputJson(jobInfo.name, jobInfo.buildable, remoteDefs, 'remote', lastParams, { added, removed });
  } else {
    // 人类可读输出
    console.log(`\n任务: ${jobInfo.name}`);
    console.log(`可构建: ${jobInfo.buildable ? '是' : '否'}`);

    // 同步报告
    if (added.length === 0 && removed.length === 0) {
      console.log('\n✓ 参数已同步，无变更');
    } else {
      console.log('\n同步结果:');
      if (added.length > 0) {
        console.log(`  新增参数 (${added.length}):`);
        for (const p of added) {
          console.log(`    + ${p.name} (默认值: ${p.default ?? '(空)'})`);
        }
      }
      if (removed.length > 0) {
        console.log(`  删除参数 (${removed.length}):`);
        for (const p of removed) {
          console.log(`    - ${p.name}`);
        }
      }
    }

    console.log(`\n参数 (${remoteDefs.length} 个):`);
    if (remoteDefs.length === 0) {
      console.log('  (无参数)');
    } else {
      for (const p of remoteDefs) {
        console.log(`\n  ${p.name}`);
        console.log(`    类型: ${p.type}`);
        if (p.description) console.log(`    描述: ${p.description}`);
        if (p.default) console.log(`    默认值: ${p.default}`);
        if (p.choices && p.choices.length > 0) {
          console.log(`    可选值: ${p.choices.join(', ')}`);
        }
        // 显示当前 lastParams 中的值
        if (lastParams[p.name] !== undefined && lastParams[p.name] !== p.default) {
          console.log(`    当前值: ${lastParams[p.name]}`);
        }
      }
    }
    console.log('');
  }
}

/**
 * JSON 格式输出
 */
function outputJson(
  name: string,
  buildable: boolean,
  params: JobParamDef[],
  source: 'local' | 'remote',
  lastParams?: Record<string, string>,
  syncInfo?: { added: JobParamDef[]; removed: JobParamDef[] },
): void {
  const output: any = {
    name,
    buildable,
    source,
    lastParams: lastParams || null,
    params: params.map(p => ({
      name: p.name,
      type: p.type,
      default: p.default ?? null,
      description: p.description ?? null,
      choices: p.choices ?? null,
    })),
  };
  if (syncInfo) {
    output.sync = {
      added: syncInfo.added.map(p => p.name),
      removed: syncInfo.removed.map(p => p.name),
    };
  }
  console.log(JSON.stringify(output, null, 2));
}

/**
 * 人类可读格式输出
 */
function outputHuman(
  name: string,
  buildable: boolean,
  params: JobParamDef[],
  source: 'local' | 'remote',
  lastParams?: Record<string, string>,
): void {
  const sourceLabel = source === 'local' ? '(本地缓存)' : '(远程)';
  console.log(`\n任务: ${name} ${sourceLabel}`);
  console.log(`可构建: ${buildable ? '是' : '否'}`);
  console.log(`\n参数 (${params.length} 个):`);

  if (params.length === 0) {
    console.log('  (无参数)');
  } else {
    for (const p of params) {
      console.log(`\n  ${p.name}`);
      console.log(`    类型: ${p.type}`);
      if (p.description) console.log(`    描述: ${p.description}`);
      if (p.default) console.log(`    默认值: ${p.default}`);
      if (p.choices && p.choices.length > 0) {
        console.log(`    可选值: ${p.choices.join(', ')}`);
      }
      // 显示 lastParams 中的值（如果与默认值不同）
      if (lastParams && lastParams[p.name] !== undefined && lastParams[p.name] !== p.default) {
        console.log(`    上次使用: ${lastParams[p.name]}`);
      }
    }
  }
  console.log('');
}
