import https from 'node:https';
import { createRequire } from 'node:module';
import chalk from 'chalk';

const require = createRequire(import.meta.url);
const { name, version: currentVersion } = require('../../package.json');

let updateAvailable = false;
let latestVersion = '';
let checkPromise: Promise<void> | null = null;

/**
 * Async check for latest npm version. Non-blocking — fire and forget.
 * Call at program startup; result is printed by printUpdateNotice() at exit.
 */
export function checkUpdate(): void {
  checkPromise = new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${name}/latest`;
    const req = https.get(url, { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          latestVersion = data.version;
          if (latestVersion && latestVersion !== currentVersion) {
            updateAvailable = true;
          }
        } catch {
          // Ignore parse errors
        }
        resolve();
      });
    });
    req.on('error', () => { resolve(); });
    req.on('timeout', () => { req.destroy(); resolve(); });
  });
}

/**
 * Wait for the update check to complete (without printing).
 * Use before quick-exit commands (version, help) to ensure the
 * async check finishes before process.exit() fires the exit handler.
 */
export async function waitForUpdateCheck(): Promise<void> {
  if (checkPromise) {
    await checkPromise;
  }
}

/**
 * Print update notice if a newer version was found.
 * Call at process exit (after main output).
 */
export function printUpdateNotice(): void {
  if (!updateAvailable) return;
  console.log(
    `\n${chalk.yellow(`⬆ 新版本可用: ${currentVersion} → ${latestVersion}`)}  运行 ${chalk.cyan('npm update -g jenkins-tools-cli')} 更新`,
  );
}
