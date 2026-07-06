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
