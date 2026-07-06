import { Command } from 'commander';
import { loadConfig, saveConfig, findConfigPath } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printSuccess, printError, printInfo, printWarning, spinner } from '../utils/output.js';
import { input, password, select, confirm } from '../utils/prompt.js';
import type { AppConfig, ServerProfile } from '../config/schema.js';
import fs from 'node:fs';
import chalk from 'chalk';

export function registerConfigCommand(program: Command): void {
  const configCmd = program.command('config').description('配置管理');

  configCmd
    .command('init')
    .description('初始化配置文件')
    .action(async () => {
      const cwd = process.cwd();
      const configPath = findConfigPath(cwd);

      if (fs.existsSync(configPath)) {
        printWarning(`配置文件已存在: ${configPath}`);
        const overwrite = await confirm('是否覆盖？');
        if (!overwrite) {
          return;
        }
      }

      console.log('\n初始化 Jenkins CLI 配置：\n');

      const url = await input('Jenkins URL:', 'https://jenkins.example.com');
      const username = await input('用户名:');
      const authType = await select('认证方式:', [
        { name: 'API Token', value: 'token' },
        { name: '密码', value: 'password' },
      ]);

      const secret = authType === 'token' ? await password('API Token:') : await password('密码:');

      const profile: ServerProfile = {
        url: url.replace(/\/+$/, ''),
        username,
      };
      if (authType === 'token') {
        profile.token = secret;
      } else {
        profile.password = secret;
      }

      const config: AppConfig = {
        servers: {
          default: 'default',
          profiles: { default: profile },
        },
      };

      saveConfig(cwd, config);
      printSuccess(`配置文件已创建: ${configPath}`);

      // 测试连接
      const testNow = await confirm('是否测试连接？', true);
      if (testNow) {
        const service = new JenkinsService(profile);
        const s = spinner('验证 Jenkins 连接...');
        s.start();
        const ok = await service.testConnection();
        s.stop();
        if (ok) {
          printSuccess('连接成功！');
        } else {
          printError('连接失败，请检查配置');
        }
      }
    });

  configCmd
    .command('test')
    .description('测试 Jenkins 连接')
    .action(async () => {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      if (!config) {
        printError('未找到配置文件，请先运行 jkt config init');
        process.exit(1);
      }

      const profile = config.servers.profiles[config.servers.default];
      const service = new JenkinsService(profile);

      const s = spinner(`测试连接 ${profile.url}...`);
      s.start();
      const ok = await service.testConnection();
      s.stop();

      if (ok) {
        printSuccess('连接成功！');
      } else {
        printError('连接失败');
        process.exit(1);
      }
    });

  configCmd
    .command('list')
    .description('列出配置信息')
    .action(() => {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      if (!config) {
        printError('未找到配置文件');
        process.exit(1);
      }

      console.log('\n服务器 Profiles:');
      for (const [name, profile] of Object.entries(config.servers.profiles)) {
        const isDefault = name === config.servers.default ? chalk.green(' (默认)') : '';
        console.log(`  ${name}${isDefault}: ${profile.url} (${profile.username})`);
      }

      if (config.jobs && Object.keys(config.jobs).length > 0) {
        console.log('\n预配置任务:');
        for (const [alias, job] of Object.entries(config.jobs)) {
          console.log(`  ${alias} → ${job.name} [${job.server}]`);
        }
      } else {
        printInfo('没有预配置任务');
      }
      console.log();
    });
}
