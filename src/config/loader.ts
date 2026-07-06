import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
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
