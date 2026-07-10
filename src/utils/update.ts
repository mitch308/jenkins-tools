import https from 'node:https';
import { createRequire } from 'node:module';
import chalk from 'chalk';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { name, version: currentVersion } = require('../../package.json');

/**
 * Check for latest npm version and optionally update.
 */
export async function checkAndUpdate(update: boolean): Promise<void> {
  const latestVersion = await fetchLatestVersion();

  if (!latestVersion) {
    console.log(chalk.yellow('无法检查更新，请检查网络连接'));
    return;
  }

  if (latestVersion === currentVersion) {
    console.log(chalk.green(`✔ 已是最新版本: ${currentVersion}`));
    return;
  }

  console.log(chalk.yellow(`⬆ 新版本可用: ${currentVersion} → ${latestVersion}`));

  if (update) {
    console.log(`正在更新 ${name}...`);
    try {
      execSync(`npm update -g ${name}`, { stdio: 'inherit' });
      console.log(chalk.green(`✔ 更新完成: ${currentVersion} → ${latestVersion}`));
    } catch {
      console.log(chalk.red('✖ 更新失败，请手动运行: npm update -g jenkins-tools-cli'));
    }
  } else {
    console.log(`运行 ${chalk.cyan('jkt update')} 或 ${chalk.cyan('npm update -g jenkins-tools-cli')} 更新`);
  }
}

function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${name}/latest`;
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.version || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => { resolve(null); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
