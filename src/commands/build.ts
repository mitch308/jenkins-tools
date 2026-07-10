import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { addBuildRecord, loadParamDefs, saveParamDefs } from '../config/store.js';
import { runParamsWizard } from '../wizard/params.js';
import { printSuccess, printError, spinner, stripAuthFromUrl } from '../utils/output.js';

export function registerBuildCommand(program: Command): void {
  program
    .command('build <job>')
    .description('快捷构建（跳过向导，直接触发）')
    .helpOption('-h, --help', '显示帮助信息')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .option('-p, --param <params...>', '构建参数，格式: KEY=VALUE')
    .action(async (job: string, options: { server?: string; param?: string[] }) => {
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
        let jobAlias: string | undefined;
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
          jobAlias = job;
        }

        const service = new JenkinsService(profile);

        // 解析参数
        let params: Record<string, string> = {};
        let usedWizard = false;
        if (options.param && options.param.length > 0) {
          // 通过 -p 传入的参数
          for (const p of options.param) {
            const eqIndex = p.indexOf('=');
            if (eqIndex === -1) {
              printError(`参数格式错误: "${p}"，应为 KEY=VALUE`);
              process.exit(1);
            }
            const key = p.substring(0, eqIndex);
            const value = p.substring(eqIndex + 1);
            params[key] = value;
          }
        } else {
          // 未传 -p 参数，进入参数配置向导
          params = await runParamsWizard(service, jobName, config, jobAlias);
          usedWizard = true;
        }

        const s = spinner(`正在构建 ${jobName}...`);
        s.start();
        const result = await service.build(jobName, Object.keys(params).length > 0 ? params : undefined);
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

        // 记录构建历史
        addBuildRecord({
          jobName,
          buildNumber: result.buildNumber,
          params: Object.keys(params).length > 0 ? params : undefined,
          triggeredAt: new Date().toISOString(),
          server: profileName,
          queueUrl: stripAuthFromUrl(result.queueUrl),
        });

        // 更新本地参数缓存
        if (!usedWizard) {
          // -p 传参模式：向导已自行缓存，这里只处理 -p 模式
          const cachedDefs = loadParamDefs(jobName);
          if (cachedDefs) {
            // 有缓存定义，更新 lastParams
            saveParamDefs(jobName, params, cachedDefs);
          } else {
            // 无缓存定义，从远程获取并缓存
            try {
              const jobInfo = await service.getJobInfo(jobName);
              saveParamDefs(jobName, params, jobInfo.params);
            } catch {
              // 远程获取失败不影响构建结果，静默跳过
            }
          }
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
