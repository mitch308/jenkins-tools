# Jenkins CLI 工具库实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个交互式 Jenkins CLI 工具，支持分步认证、任务选择、参数配置、提交构建的全流程向导模式。

**Architecture:** 基于 Commander.js 的 CLI 框架，核心是 4 步交互式向导（auth → job-select → params → execute）。Jenkins API 通过 jenkins-api 库封装，配置通过 YAML 文件管理，历史参数通过 JSON 文件持久化。参数合并遵循三层优先级：Jenkins 默认值 < .jenkinsrc.yml 预设 < .jenkins-history.json 最近值。

**Tech Stack:** TypeScript, Commander.js, Inquirer, jenkins-api, js-yaml, chalk, ora

## Global Constraints

- Node.js >= 18
- TypeScript strict mode
- 所有源码在 `src/` 目录下
- 配置文件名：`.jenkinsrc.yml`，历史文件名：`.jenkins-history.json`
- CLI 命令名：`jkt`
- 支持 API Token 和用户名密码两种认证方式
- 参数合并优先级：Jenkins 默认值 < 配置文件预设 < 历史记录

---

## File Structure

| 文件 | 职责 |
|------|------|
| `package.json` | 项目元信息、依赖、bin 入口 |
| `tsconfig.json` | TypeScript 编译配置 |
| `.gitignore` | 忽略 node_modules、dist、配置文件 |
| `src/index.ts` | CLI 入口，注册所有命令 |
| `src/config/schema.ts` | 配置文件类型定义 |
| `src/config/loader.ts` | YAML 配置加载与校验 |
| `src/config/store.ts` | 历史参数 JSON 持久化 |
| `src/services/jenkins.ts` | Jenkins API 封装（认证、构建、查询） |
| `src/utils/output.ts` | 彩色输出、摘要框、状态图标 |
| `src/utils/prompt.ts` | Inquirer 交互提示封装 |
| `src/wizard/auth.ts` | Step 1: 认证向导 |
| `src/wizard/job-select.ts` | Step 2: 任务选择 |
| `src/wizard/params.ts` | Step 3: 参数配置 |
| `src/wizard/execute.ts` | Step 4: 提交执行 |
| `src/commands/run.ts` | 交互式向导主命令 |
| `src/commands/build.ts` | 快捷构建命令 |
| `src/commands/status.ts` | 构建状态查询命令 |
| `src/commands/config.ts` | 配置管理命令 |

---

### Task 1: 项目脚手架与基础配置

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`

**Interfaces:**
- Produces: 项目可编译运行，`jkt` 命令可用（显示 help）

- [ ] **Step 1: 初始化 package.json**

```bash
cd C:/workspace/jenkins-tools && npm init -y
```

然后修改 `package.json` 为以下内容：

```json
{
  "name": "jenkins-tools",
  "version": "0.1.0",
  "description": "Interactive Jenkins CLI tool with step-by-step build configuration",
  "type": "module",
  "bin": {
    "jkt": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "keywords": ["jenkins", "cli"],
  "license": "MIT"
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
dist/
.jenkinsrc.yml
.jenkins-history.json
*.js.map
```

- [ ] **Step 4: 安装依赖**

```bash
cd C:/workspace/jenkins-tools && npm install commander inquirer js-yaml chalk ora jenkins-api
```

```bash
cd C:/workspace/jenkins-tools && npm install -D typescript @types/node @types/inquirer @types/js-yaml
```

- [ ] **Step 5: 创建 src/index.ts 入口文件**

```typescript
#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('jkt')
  .description('Interactive Jenkins CLI tool')
  .version('0.1.0');

program.parse();
```

- [ ] **Step 6: 编译并验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc && node dist/index.js --help
```

Expected: 显示 `jkt` 的 help 信息

- [ ] **Step 7: Commit**

```bash
cd C:/workspace/jenkins-tools && git add package.json package-lock.json tsconfig.json .gitignore src/index.ts && git commit -m "feat: project scaffold with TypeScript and Commander.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 配置类型定义与加载器

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/loader.ts`
- Create: `src/config/store.ts`

**Interfaces:**
- Produces:
  - `ServerProfile` type: `{ url: string; username: string; token?: string; password?: string }`
  - `JobConfig` type: `{ server: string; name: string; params?: Record<string, string> }`
  - `AppConfig` type: `{ servers: { default: string; profiles: Record<string, ServerProfile> }; jobs?: Record<string, JobConfig> }`
  - `HistoryEntry` type: `{ lastParams: Record<string, string>; lastRun: string }`
  - `loadConfig(cwd: string): AppConfig | null` — 加载 .jenkinsrc.yml，不存在返回 null
  - `saveConfig(cwd: string, config: AppConfig): void` — 保存配置到 .jenkinsrc.yml
  - `loadHistory(cwd: string): Record<string, HistoryEntry>` — 加载历史
  - `saveHistory(cwd: string, jobName: string, params: Record<string, string>): void` — 保存历史

- [ ] **Step 1: 创建 src/config/schema.ts**

```typescript
export interface ServerProfile {
  url: string;
  username: string;
  token?: string;
  password?: string;
}

export interface JobConfig {
  server: string;
  name: string;
  params?: Record<string, string>;
}

export interface ServerConfig {
  default: string;
  profiles: Record<string, ServerProfile>;
}

export interface AppConfig {
  servers: ServerConfig;
  jobs?: Record<string, JobConfig>;
}

export interface HistoryEntry {
  lastParams: Record<string, string>;
  lastRun: string;
}

export type HistoryData = Record<string, HistoryEntry>;

export interface JobParamDef {
  name: string;
  type: string;
  default?: string;
  description?: string;
  choices?: string[];
}
```

- [ ] **Step 2: 创建 src/config/loader.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { AppConfig } from './schema.js';

const CONFIG_FILE = '.jenkinsrc.yml';

export function findConfigPath(cwd: string): string {
  return path.resolve(cwd, CONFIG_FILE);
}

export function loadConfig(cwd: string): AppConfig | null {
  const configPath = findConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.load(content) as AppConfig;
  if (!parsed.servers?.profiles || !parsed.servers?.default) {
    throw new Error('Invalid config: servers.profiles and servers.default are required');
  }
  return parsed;
}

export function saveConfig(cwd: string, config: AppConfig): void {
  const configPath = findConfigPath(cwd);
  const content = yaml.dump(config, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(configPath, content, 'utf-8');
}
```

- [ ] **Step 3: 创建 src/config/store.ts**

```typescript
import fs from 'node:fs';
import path from 'node:path';
import type { HistoryData, HistoryEntry } from './schema.js';

const HISTORY_FILE = '.jenkins-history.json';

function findHistoryPath(cwd: string): string {
  return path.resolve(cwd, HISTORY_FILE);
}

export function loadHistory(cwd: string): HistoryData {
  const historyPath = findHistoryPath(cwd);
  if (!fs.existsSync(historyPath)) {
    return {};
  }
  const content = fs.readFileSync(historyPath, 'utf-8');
  try {
    return JSON.parse(content) as HistoryData;
  } catch {
    return {};
  }
}

export function saveHistory(cwd: string, jobName: string, params: Record<string, string>): void {
  const historyPath = findHistoryPath(cwd);
  const history = loadHistory(cwd);
  const entry: HistoryEntry = {
    lastParams: params,
    lastRun: new Date().toISOString(),
  };
  history[jobName] = entry;
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
}
```

- [ ] **Step 4: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功，无错误

- [ ] **Step 5: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/config/ && git commit -m "feat: config schema, loader and history store

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Jenkins API 服务封装

**Files:**
- Create: `src/services/jenkins.ts`

**Interfaces:**
- Consumes: `ServerProfile` from `src/config/schema.ts`
- Produces:
  - `JenkinsService` class:
    - `constructor(profile: ServerProfile)` — 初始化客户端
    - `testConnection(): Promise<boolean>` — 测试连接
    - `getJobInfo(jobName: string): Promise<JobInfo>` — 获取 Job 信息
    - `build(jobName: string, params?: Record<string, string>): Promise<BuildResult>` — 触发构建
    - `getBuildStatus(jobName: string, buildNumber: number): Promise<BuildStatus>` — 查询构建状态
    - `getBuildLog(jobName: string, buildNumber: number): Promise<string>` — 获取构建日志
    - `getLastBuildNumber(jobName: string): Promise<number>` — 获取最近构建号
  - `JobInfo` type: `{ name: string; url: string; params: JobParamDef[]; buildable: boolean }`
  - `BuildResult` type: `{ queueUrl: string; buildNumber?: number }`
  - `BuildStatus` type: `{ number: number; result: string; building: boolean; url: string; timestamp: number; duration: number }`

- [ ] **Step 1: 创建 src/services/jenkins.ts**

```typescript
import jenkins from 'jenkins-api';
import type { ServerProfile, JobParamDef } from '../config/schema.js';

export interface JobInfo {
  name: string;
  url: string;
  params: JobParamDef[];
  buildable: boolean;
}

export interface BuildResult {
  queueUrl: string;
  buildNumber?: number;
}

export interface BuildStatus {
  number: number;
  result: string | null;
  building: boolean;
  url: string;
  timestamp: number;
  duration: number;
}

export class JenkinsService {
  private client: ReturnType<typeof jkins>;

  constructor(private profile: ServerProfile) {
    const baseUrl = profile.url.replace(/\/+$/, '');
    if (profile.token) {
      this.client = jenkins({
        baseUrl: `${baseUrl}`,
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${profile.username}:${profile.token}`).toString('base64'),
        },
      });
    } else if (profile.password) {
      this.client = jenkins({
        baseUrl: `${baseUrl}`,
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${profile.username}:${profile.password}`).toString('base64'),
        },
      });
    } else {
      throw new Error('Either token or password must be provided for authentication');
    }
  }

  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.all_jobs((err: Error | null) => {
        resolve(!err);
      });
    });
  }

  async getJobInfo(jobName: string): Promise<JobInfo> {
    return new Promise((resolve, reject) => {
      this.client.job_info(jobName, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get job info for "${jobName}": ${err.message}`));
          return;
        }
        const params: JobParamDef[] = [];
        const property = data.property?.find((p: any) => p.parameterDefinitions);
        if (property?.parameterDefinitions) {
          for (const param of property.parameterDefinitions) {
            params.push({
              name: param.name,
              type: param.type || 'StringParameterDefinition',
              default: param.defaultParameterValue?.value?.toString(),
              description: param.description,
              choices: param.choices,
            });
          }
        }
        resolve({
          name: data.name,
          url: data.url,
          params,
          buildable: data.buildable ?? true,
        });
      });
    });
  }

  async build(jobName: string, params?: Record<string, string>): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
      const callback = (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to trigger build for "${jobName}": ${err.message}`));
          return;
        }
        resolve({
          queueUrl: data?.location || '',
        });
      };
      if (params && Object.keys(params).length > 0) {
        this.client.build_with_params(jobName, params, callback);
      } else {
        this.client.build(jobName, callback);
      }
    });
  }

  async getBuildStatus(jobName: string, buildNumber: number): Promise<BuildStatus> {
    return new Promise((resolve, reject) => {
      this.client.build_info(jobName, buildNumber, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get build status: ${err.message}`));
          return;
        }
        resolve({
          number: data.number,
          result: data.result,
          building: data.building,
          url: data.url,
          timestamp: data.timestamp,
          duration: data.duration,
        });
      });
    });
  }

  async getBuildLog(jobName: string, buildNumber: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.console_output(jobName, buildNumber, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get build log: ${err.message}`));
          return;
        }
        resolve(data || '');
      });
    });
  }

  async getLastBuildNumber(jobName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.last_build_info(jobName, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get last build number: ${err.message}`));
          return;
        }
        resolve(data?.number || 0);
      });
    });
  }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 可能有 jenkins-api 类型警告但不阻断编译

- [ ] **Step 3: 如果 jenkins-api 缺少类型定义，创建声明文件**

创建 `src/types/jenkins-api.d.ts`：

```typescript
declare module 'jenkins-api' {
  interface JenkinsApiOptions {
    baseUrl: string;
    headers?: Record<string, string>;
  }

  interface JenkinsApi {
    all_jobs(callback: (err: Error | null, data?: any) => void): void;
    job_info(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    build(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    build_with_params(jobName: string, params: Record<string, string>, callback: (err: Error | null, data?: any) => void): void;
    build_info(jobName: string, buildNumber: number, callback: (err: Error | null, data?: any) => void): void;
    last_build_info(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    console_output(jobName: string, buildNumber: number, callback: (err: Error | null, data?: any) => void): void;
  }

  function jenkins(options: JenkinsApiOptions): JenkinsApi;
  export = jenkins;
}
```

- [ ] **Step 4: 重新编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 5: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/services/ src/types/ && git commit -m "feat: Jenkins API service with auth, build, and status methods

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 工具函数（输出格式化与交互提示封装）

**Files:**
- Create: `src/utils/output.ts`
- Create: `src/utils/prompt.ts`

**Interfaces:**
- Consumes: chalk, ora, inquirer
- Produces:
  - `output.ts`: `printSuccess(msg)`, `printError(msg)`, `printInfo(msg)`, `printWarning(msg)`, `printSummary(title, items: {label, value}[])`, `spinner(text): Ora`
  - `prompt.ts`: `confirm(msg)`, `select(msg, choices)`, `input(msg, default?)`, `password(msg)`

- [ ] **Step 1: 创建 src/utils/output.ts**

```typescript
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export function printSuccess(msg: string): void {
  console.log(chalk.green('✔'), msg);
}

export function printError(msg: string): void {
  console.log(chalk.red('✖'), msg);
}

export function printInfo(msg: string): void {
  console.log(chalk.blue('ℹ'), msg);
}

export function printWarning(msg: string): void {
  console.log(chalk.yellow('⚠'), msg);
}

export function printSummary(title: string, items: Array<{ label: string; value: string }>): void {
  const maxLabelLen = Math.max(...items.map((i) => i.label.length));
  const lines = items.map((i) => `  ${i.label.padEnd(maxLabelLen + 2)}= ${i.value}`);
  const width = Math.max(title.length + 4, ...lines.map((l) => l.length)) + 4;

  const top = '┌' + '─'.repeat(width - 2) + '┐';
  const mid = '├' + '─'.repeat(width - 2) + '┤';
  const bot = '└' + '─'.repeat(width - 2) + '┘';
  const titleLine = '│ ' + chalk.bold(title) + ' '.repeat(width - title.length - 3) + '│';

  console.log();
  console.log(top);
  console.log(titleLine);
  console.log(mid);
  for (const line of lines) {
    console.log('│' + line + ' '.repeat(width - line.length - 1) + '│');
  }
  console.log(bot);
  console.log();
}

export function spinner(text: string): Ora {
  return ora({ text, spinner: 'dots' });
}
```

- [ ] **Step 2: 创建 src/utils/prompt.ts**

```typescript
import inquirer from 'inquirer';

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { result } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'result',
      message,
      default: defaultValue,
    },
  ]);
  return result;
}

export async function select<T = string>(message: string, choices: Array<{ name: string; value: T }>): Promise<T> {
  const { result } = await inquirer.prompt([
    {
      type: 'list',
      name: 'result',
      message,
      choices,
    },
  ]);
  return result;
}

export async function input(message: string, defaultValue?: string): Promise<string> {
  const { result } = await inquirer.prompt([
    {
      type: 'input',
      name: 'result',
      message,
      default: defaultValue,
    },
  ]);
  return result;
}

export async function password(message: string): Promise<string> {
  const { result } = await inquirer.prompt([
    {
      type: 'password',
      name: 'result',
      message,
      mask: '*',
    },
  ]);
  return result;
}
```

- [ ] **Step 3: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/utils/ && git commit -m "feat: output formatting and interactive prompt utilities

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 向导 Step 1 — 认证

**Files:**
- Create: `src/wizard/auth.ts`

**Interfaces:**
- Consumes: `loadConfig`, `saveConfig` from `src/config/loader.ts`; `AppConfig`, `ServerProfile` from `src/config/schema.ts`; `JenkinsService` from `src/services/jenkins.ts`; prompts from `src/utils/prompt.ts`; output from `src/utils/output.ts`
- Produces:
  - `runAuthWizard(cwd: string): Promise<{ config: AppConfig; service: JenkinsService }>` — 执行认证流程，返回已验证的配置和服务实例

- [ ] **Step 1: 创建 src/wizard/auth.ts**

```typescript
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
```

- [ ] **Step 2: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/wizard/auth.ts && git commit -m "feat: wizard step 1 - authentication with connection verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 向导 Step 2 — 任务选择

**Files:**
- Create: `src/wizard/job-select.ts`

**Interfaces:**
- Consumes: `AppConfig`, `JobConfig` from `src/config/schema.ts`; `JenkinsService` from `src/services/jenkins.ts`; prompts from `src/utils/prompt.ts`
- Produces:
  - `runJobSelectWizard(config: AppConfig, service: JenkinsService, preselectedJob?: string): Promise<{ jobName: string; jobAlias?: string; serverProfile: string }>` — 返回选中的 Jenkins job 路径和别名

- [ ] **Step 1: 创建 src/wizard/job-select.ts**

```typescript
import type { AppConfig } from '../config/schema.js';
import type { JenkinsService } from '../services/jenkins.js';
import { select, input } from '../utils/prompt.js';

export interface JobSelection {
  jobName: string;       // Jenkins job 路径，如 "frontend/deploy-main"
  jobAlias?: string;     // 配置文件中的别名，如 "frontend-deploy"
  serverProfile: string; // 使用的服务器 profile 名
}

export async function runJobSelectWizard(
  config: AppConfig,
  _service: JenkinsService,
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

  const choices = jobKeys.map((key) => ({
    name: `${key} (${jobs[key].name}) [${jobs[key].server}]`,
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
```

- [ ] **Step 2: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/wizard/job-select.ts && git commit -m "feat: wizard step 2 - job selection with presets and manual input

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 向导 Step 3 — 参数配置

**Files:**
- Create: `src/wizard/params.ts`

**Interfaces:**
- Consumes: `JenkinsService`, `JobInfo` from `src/services/jenkins.ts`; `AppConfig`, `JobParamDef` from `src/config/schema.ts`; `loadHistory`, `saveHistory` from `src/config/store.ts`; prompts from `src/utils/prompt.ts`; output from `src/utils/output.ts`
- Produces:
  - `runParamsWizard(service: JenkinsService, jobName: string, config: AppConfig, cwd: string, jobAlias?: string): Promise<Record<string, string>>` — 返回用户确认的参数键值对

- [ ] **Step 1: 创建 src/wizard/params.ts**

```typescript
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
```

- [ ] **Step 2: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/wizard/params.ts && git commit -m "feat: wizard step 3 - parameter configuration with three-layer merge

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 向导 Step 4 — 提交执行

**Files:**
- Create: `src/wizard/execute.ts`

**Interfaces:**
- Consumes: `JenkinsService`, `BuildResult` from `src/services/jenkins.ts`; prompts from `src/utils/prompt.ts`; output from `src/utils/output.ts`
- Produces:
  - `runExecuteWizard(service: JenkinsService, jobName: string, params: Record<string, string>, serverProfile: string): Promise<BuildResult | null>` — 确认后执行，取消返回 null

- [ ] **Step 1: 创建 src/wizard/execute.ts**

```typescript
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
```

- [ ] **Step 2: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/wizard/execute.ts && git commit -m "feat: wizard step 4 - build execution with confirmation summary

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: CLI 命令注册 — run, build, status, config

**Files:**
- Create: `src/commands/run.ts`
- Create: `src/commands/build.ts`
- Create: `src/commands/status.ts`
- Create: `src/commands/config.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: All wizard modules, all config modules, JenkinsService, output/prompt utils
- Produces: 完整可用的 CLI 命令集

- [ ] **Step 1: 创建 src/commands/run.ts**

```typescript
import { Command } from 'commander';
import { runAuthWizard } from '../wizard/auth.js';
import { runJobSelectWizard } from '../wizard/job-select.js';
import { runParamsWizard } from '../wizard/params.js';
import { runExecuteWizard } from '../wizard/execute.js';
import { printError } from '../utils/output.js';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('启动交互式构建向导')
    .option('-j, --job <job>', '预选任务（跳过任务选择步骤）')
    .action(async (options: { job?: string }) => {
      try {
        const cwd = process.cwd();

        // Step 1: 认证
        const { config, service, profileName } = await runAuthWizard(cwd);

        // Step 2: 选择任务
        const selection = await runJobSelectWizard(config, service, options.job);

        // Step 3: 配置参数
        const params = await runParamsWizard(service, selection.jobName, config, cwd, selection.jobAlias);

        // Step 4: 提交执行
        const result = await runExecuteWizard(service, selection.jobName, params, selection.serverProfile);
        if (!result) {
          printError('构建已取消');
        }
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 2: 创建 src/commands/build.ts**

```typescript
import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printSuccess, printError, spinner } from '../utils/output.js';

export function registerBuildCommand(program: Command): void {
  program
    .command('build <job>')
    .description('快捷构建（跳过向导，直接触发）')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .option('-p, --param <params...>', '构建参数，格式: KEY=VALUE')
    .action(async (job: string, options: { server?: string; param?: string[] }) => {
      try {
        const cwd = process.cwd();
        const config = loadConfig(cwd);
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

        // 解析参数
        const params: Record<string, string> = {};
        if (options.param) {
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
        }

        // 如果 job 是别名，解析为实际路径
        let jobName = job;
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
        }

        const service = new JenkinsService(profile);
        const s = spinner(`正在构建 ${jobName}...`);
        s.start();
        const result = await service.build(jobName, Object.keys(params).length > 0 ? params : undefined);
        s.stop();

        printSuccess(`构建已提交！队列地址: ${result.queueUrl || '(已触发)'}`);
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 3: 创建 src/commands/status.ts**

```typescript
import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printSuccess, printError, printInfo, spinner } from '../utils/output.js';
import chalk from 'chalk';

export function registerStatusCommand(program: Command): void {
  program
    .command('status <job>')
    .description('查询构建状态')
    .option('-n, --number <buildNumber>', '构建号', parseInt)
    .option('-l, --log', '查看构建日志')
    .option('-s, --server <profile>', '服务器 Profile 名称')
    .action(async (job: string, options: { number?: number; log?: boolean; server?: string }) => {
      try {
        const cwd = process.cwd();
        const config = loadConfig(cwd);
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

        // 解析 job 别名
        let jobName = job;
        if (config.jobs?.[job]) {
          jobName = config.jobs[job].name;
        }

        const service = new JenkinsService(profile);

        // 获取构建号
        let buildNumber = options.number;
        if (!buildNumber) {
          const s = spinner('查询最近构建...');
          s.start();
          buildNumber = await service.getLastBuildNumber(jobName);
          s.stop();
        }

        if (!buildNumber) {
          printInfo('没有找到构建记录');
          return;
        }

        // 查看日志
        if (options.log) {
          const s = spinner(`获取构建 #${buildNumber} 日志...`);
          s.start();
          const log = await service.getBuildLog(jobName, buildNumber);
          s.stop();
          console.log(log);
          return;
        }

        // 查询状态
        const s = spinner(`查询构建 #${buildNumber} 状态...`);
        s.start();
        const status = await service.getBuildStatus(jobName, buildNumber);
        s.stop();

        const statusIcon = status.building
          ? chalk.yellow('⏳ 构建中')
          : status.result === 'SUCCESS'
            ? chalk.green('✔ 成功')
            : status.result === 'FAILURE'
              ? chalk.red('✖ 失败')
              : status.result === 'ABORTED'
                ? chalk.gray('⊘ 中止')
                : chalk.blue(`ℹ ${status.result || '未知'}`);

        console.log(`\n构建 #${status.number}  ${statusIcon}`);
        console.log(`URL: ${status.url}`);
        console.log(`耗时: ${Math.round(status.duration / 1000)}s`);
        console.log();
      } catch (err: any) {
        printError(err.message);
        process.exit(1);
      }
    });
}
```

- [ ] **Step 4: 创建 src/commands/config.ts**

```typescript
import { Command } from 'commander';
import { loadConfig, saveConfig, findConfigPath } from '../config/loader.js';
import { JenkinsService } from '../services/jenkins.js';
import { printSuccess, printError, printInfo, printWarning, spinner } from '../utils/output.js';
import { input, password, select, confirm } from '../utils/prompt.js';
import type { AppConfig, ServerProfile } from '../config/schema.js';
import fs from 'node:fs';

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
```

- [ ] **Step 5: 更新 src/index.ts 注册所有命令**

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { registerRunCommand } from './commands/run.js';
import { registerBuildCommand } from './commands/build.js';
import { registerStatusCommand } from './commands/status.js';
import { registerConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('jkt')
  .description('Interactive Jenkins CLI tool')
  .version('0.1.0');

// 默认命令：启动向导
program.action(async () => {
  const { runAuthWizard } = await import('./wizard/auth.js');
  const { runJobSelectWizard } = await import('./wizard/job-select.js');
  const { runParamsWizard } = await import('./wizard/params.js');
  const { runExecuteWizard } = await import('./wizard/execute.js');
  const { printError } = await import('./utils/output.js');

  try {
    const cwd = process.cwd();

    const { config, service, profileName } = await runAuthWizard(cwd);
    const selection = await runJobSelectWizard(config, service);
    const params = await runParamsWizard(service, selection.jobName, config, cwd, selection.jobAlias);
    const result = await runExecuteWizard(service, selection.jobName, params, selection.serverProfile);
    if (!result) {
      printError('构建已取消');
    }
  } catch (err: any) {
    printError(err.message);
    process.exit(1);
  }
});

registerRunCommand(program);
registerBuildCommand(program);
registerStatusCommand(program);
registerConfigCommand(program);

program.parse();
```

- [ ] **Step 6: 编译验证**

```bash
cd C:/workspace/jenkins-tools && npx tsc
```

Expected: 编译成功

- [ ] **Step 7: 运行验证**

```bash
cd C:/workspace/jenkins-tools && node dist/index.js --help
```

Expected: 显示所有命令的帮助信息，包含 run、build、status、config

- [ ] **Step 8: Commit**

```bash
cd C:/workspace/jenkins-tools && git add src/ && git commit -m "feat: register all CLI commands - run, build, status, config

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: README 文档与 .jenkinsrc.yml 示例

**Files:**
- Create: `README.md`
- Create: `.jenkinsrc.example.yml`

**Interfaces:**
- Produces: 项目文档和配置示例

- [ ] **Step 1: 创建 .jenkinsrc.example.yml**

```yaml
# Jenkins CLI 工具配置文件示例
# 复制为 .jenkinsrc.yml 并修改

servers:
  default: production
  profiles:
    production:
      url: https://jenkins.example.com
      username: your-user
      token: your-api-token
    staging:
      url: https://staging-jenkins.example.com
      username: your-user
      password: your-password

jobs:
  # frontend-deploy 是任务别名，用于 CLI 中快速引用
  frontend-deploy:
    server: production
    name: frontend/deploy-main
  backend-test:
    server: staging
    name: backend/run-tests
```

- [ ] **Step 2: 创建 README.md**

```markdown
# Jenkins Tools

交互式 Jenkins CLI 工具，支持分步配置参数、触发构建和查询构建状态。

## 安装

```bash
npm install
npm run build
npm link
```

## 使用

### 交互式向导（推荐）

```bash
jkt                    # 启动交互式向导
jkt run                # 同上
jkt run --job frontend-deploy  # 跳过任务选择步骤
```

向导流程：
1. **认证** — 首次使用引导配置，已配置则自动验证
2. **选择任务** — 从预配置列表选择或手动输入
3. **配置参数** — 自动合并 Jenkins 默认值 + 配置文件预设 + 历史记录
4. **提交执行** — 确认摘要后触发构建

### 快捷构建

```bash
jkt build frontend-deploy -p ENV=staging -p BRANCH=dev
```

### 查询状态

```bash
jkt status frontend-deploy         # 最近构建状态
jkt status frontend-deploy -n 42   # 指定构建号
jkt status frontend-deploy --log   # 查看构建日志
```

### 配置管理

```bash
jkt config init    # 初始化配置文件
jkt config test    # 测试 Jenkins 连接
jkt config list    # 列出配置信息
```

## 配置

复制 `.jenkinsrc.example.yml` 为 `.jenkinsrc.yml` 并修改：

```yaml
servers:
  default: production
  profiles:
    production:
      url: https://jenkins.example.com
      username: your-user
      token: your-api-token

jobs:
  frontend-deploy:
    server: production
    name: frontend/deploy-main
```

### 参数合并优先级

构建参数按以下优先级合并（后者覆盖前者）：

1. Jenkins 参数定义的默认值
2. `.jenkinsrc.yml` 中预设的参数值
3. `.jenkins-history.json` 中最近一次的参数值

## 开发

```bash
npm run dev      # 监听模式编译
npm run build    # 编译
npm start        # 运行
```
```

- [ ] **Step 3: Commit**

```bash
cd C:/workspace/jenkins-tools && git add README.md .jenkinsrc.example.yml && git commit -m "docs: add README and example config file

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: 端到端编译与 link 测试

**Files:**
- Modify: 可能修复编译错误

**Interfaces:**
- Produces: 可全局使用的 `jkt` 命令

- [ ] **Step 1: 清理并完整编译**

```bash
cd C:/workspace/jenkins-tools && rm -rf dist && npx tsc
```

Expected: 编译成功

- [ ] **Step 2: 测试 CLI help**

```bash
cd C:/workspace/jenkins-tools && node dist/index.js --help
node dist/index.js run --help
node dist/index.js build --help
node dist/index.js status --help
node dist/index.js config --help
```

Expected: 所有子命令的帮助信息正常显示

- [ ] **Step 3: npm link 全局安装**

```bash
cd C:/workspace/jenkins-tools && npm link
```

然后测试：

```bash
jkt --help
jkt config --help
```

Expected: `jkt` 命令全局可用

- [ ] **Step 4: 测试 config init（交互式，手动验证）**

```bash
jkt config init
```

Expected: 出现交互式配置引导

- [ ] **Step 5: Commit（如有修复）**

```bash
cd C:/workspace/jenkins-tools && git add -A && git commit -m "fix: resolve compilation and runtime issues

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
