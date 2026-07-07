import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = '.jkt';

/**
 * Get the global jkt config directory (~/.jkt/).
 * Creates it if it doesn't exist.
 */
export function getConfigDir(): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, CONFIG_DIR);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

/**
 * Get the path to .jenkinsrc.yml in the global config directory.
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), '.jenkinsrc.yml');
}

/**
 * Get the path to .jenkins-history.json in the global config directory.
 */
export function getHistoryPath(): string {
  return path.join(getConfigDir(), '.jenkins-history.json');
}
