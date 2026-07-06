import fs from 'node:fs';
import path from 'node:path';
import type { HistoryData, HistoryEntry, HistoryMeta } from './schema.js';

const HISTORY_FILE = '.jenkins-history.json';

function findHistoryPath(cwd: string): string {
  return path.resolve(cwd, HISTORY_FILE);
}

interface HistoryFile {
  meta?: HistoryMeta;
  jobs: HistoryData;
}

function loadHistoryFile(cwd: string): HistoryFile {
  const historyPath = findHistoryPath(cwd);
  if (!fs.existsSync(historyPath)) {
    return { meta: {}, jobs: {} };
  }
  const content = fs.readFileSync(historyPath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    // Support old format (flat Record<string, HistoryEntry>) and new format
    if (parsed.meta || parsed.jobs) {
      return parsed as HistoryFile;
    }
    // Old format: top-level is the jobs map
    return { meta: {}, jobs: parsed as HistoryData };
  } catch {
    return { meta: {}, jobs: {} };
  }
}

function saveHistoryFile(cwd: string, data: HistoryFile): void {
  const historyPath = findHistoryPath(cwd);
  fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadHistory(cwd: string): HistoryData {
  return loadHistoryFile(cwd).jobs;
}

export function saveHistory(cwd: string, jobName: string, params: Record<string, string>): void {
  const file = loadHistoryFile(cwd);
  const entry: HistoryEntry = {
    lastParams: params,
    lastRun: new Date().toISOString(),
  };
  file.jobs[jobName] = entry;
  file.meta = { lastJob: jobName };
  saveHistoryFile(cwd, file);
}

export function getLastJob(cwd: string): string | undefined {
  return loadHistoryFile(cwd).meta?.lastJob;
}
