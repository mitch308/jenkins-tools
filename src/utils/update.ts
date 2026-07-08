import https from 'node:https';
import { createRequire } from 'node:module';
import chalk from 'chalk';

const require = createRequire(import.meta.url);
const { name, version: currentVersion } = require('../../package.json');

let updateAvailable = false;
let latestVersion = '';

/**
 * Async check for latest npm version. Non-blocking — fire and forget.
 * Call at program startup; result is printed by printUpdateNotice() at exit.
 */
export function checkUpdate(): void {
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
    });
  });
  req.on('error', () => { /* ignore */ });
  req.on('timeout', () => { req.destroy(); });
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
