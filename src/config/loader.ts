import fs from 'node:fs';
import * as yaml from 'js-yaml';
import type { AppConfig } from './schema.js';
import { getConfigPath as getGlobalConfigPath, getConfigDir as getGlobalConfigDir } from './paths.js';

export function findConfigPath(): string {
  return getGlobalConfigPath();
}

export function loadConfig(): AppConfig | null {
  const configPath = findConfigPath();
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

export function saveConfig(config: AppConfig): void {
  const configPath = findConfigPath();
  const content = yaml.dump(config, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Get the config directory path (~/.jkt/).
 */
export function getConfigDir(): string {
  return getGlobalConfigDir();
}
