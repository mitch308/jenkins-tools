import type { AppConfig, ServerProfile } from '../config/schema.js';
import { loadConfig, saveConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printSuccess, printError, printWarning, spinner } from '../utils/output.js';
import { confirm, input, password, select } from '../utils/prompt.js';

export interface AuthResult {
  config: AppConfig;
  service: JenkinsService;
  profileName: string;
}

export async function runAuthWizard(cwd: string): Promise<AuthResult> {
  const config = loadConfig(cwd);

  // 已有配置，尝试验证
  if (config?.servers?.profiles && config.servers.default) {
    const profileName = config.servers.default;
    const profile = config.servers.profiles[profileName];

    if (profile) {
      const s = spinner('验证 Jenkins 连接...');
      s.start();
      const service = new JenkinsService(profile);
      const ok = await service.testConnection();
      s.stop();

      if (ok) {
        printSuccess(`已连接到 ${profile.url} (${profileName})`);
        return { config, service, profileName };
      }

      printError(`连接 ${profileName} 失败`);
      const action = await select('请选择操作:', [
        { name: '重新配置当前服务器', value: 'reconfigure' },
        { name: '切换服务器 Profile', value: 'switch' },
        { name: '退出', value: 'exit' },
      ]);

      if (action === 'exit') {
        process.exit(0);
      }

      if (action === 'switch') {
        return switchProfile(cwd, config);
      }

      // reconfigure
      return reconfigureProfile(cwd, config, profileName);
    }
  }

  // 全新配置
  return newProfile(cwd);
}

async function switchProfile(cwd: string, config: AppConfig): Promise<AuthResult> {
  const profileNames = Object.keys(config.servers.profiles);
  const choices = profileNames.map((name) => ({
    name: `${name} (${config.servers.profiles[name].url})`,
    value: name,
  }));

  const selected = await select('选择服务器 Profile:', choices);
  config.servers.default = selected;
  saveConfig(cwd, config);

  const profile = config.servers.profiles[selected];
  const s = spinner('验证 Jenkins 连接...');
  s.start();
  const service = new JenkinsService(profile);
  const ok = await service.testConnection();
  s.stop();

  if (ok) {
    printSuccess(`已连接到 ${profile.url} (${selected})`);
    return { config, service, profileName: selected };
  }

  printError(`连接 ${selected} 失败`);
  return reconfigureProfile(cwd, config, selected);
}

async function reconfigureProfile(cwd: string, config: AppConfig, profileName: string): Promise<AuthResult> {
  printWarning(`重新配置 "${profileName}"`);
  const profile = await promptProfileDetails(config.servers.profiles[profileName]?.url);
  config.servers.profiles[profileName] = profile;
  saveConfig(cwd, config);

  const service = new JenkinsService(profile);
  const s = spinner('验证 Jenkins 连接...');
  s.start();
  const ok = await service.testConnection();
  s.stop();

  if (ok) {
    printSuccess(`已连接到 ${profile.url} (${profileName})`);
    return { config, service, profileName };
  }

  printError('连接仍然失败，请检查配置后重试');
  process.exit(1);
}

async function newProfile(cwd: string): Promise<AuthResult> {
  console.log('未找到 Jenkins 配置，请进行初始配置：\n');

  const profile = await promptProfileDetails();
  const profileName = 'default';

  const config: AppConfig = {
    servers: {
      default: profileName,
      profiles: { [profileName]: profile },
    },
  };
  saveConfig(cwd, config);

  const service = new JenkinsService(profile);
  const s = spinner('验证 Jenkins 连接...');
  s.start();
  const ok = await service.testConnection();
  s.stop();

  if (ok) {
    printSuccess(`已连接到 ${profile.url}`);
    return { config, service, profileName };
  }

  printError('连接失败，请检查配置');
  const retry = await confirm('是否重新配置？');
  if (retry) {
    return newProfile(cwd);
  }
  process.exit(1);
}

async function promptProfileDetails(defaultUrl?: string): Promise<ServerProfile> {
  const url = await input('Jenkins URL:', defaultUrl || 'https://jenkins.example.com');
  const username = await input('用户名:');
  const authType = await select('认证方式:', [
    { name: 'API Token', value: 'token' },
    { name: '密码', value: 'password' },
  ]);

  const secret = authType === 'token' ? await password('API Token:') : await password('密码:');

  const profile: ServerProfile = { url: url.replace(/\/+$/, ''), username };
  if (authType === 'token') {
    profile.token = secret;
  } else {
    profile.password = secret;
  }
  return profile;
}
