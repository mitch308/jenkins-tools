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
