import fs from 'node:fs';
import path from 'node:path';
import type { HistoryData, HistoryEntry, HistoryMeta, BuildRecord, JobParamDef } from './schema.js';
import { getHistoryPath } from './paths.js';

const MAX_BUILD_RECORDS = 50;

interface HistoryFile {
  meta?: HistoryMeta;
  jobs: HistoryData;
  buildRecords?: BuildRecord[];
}

function loadHistoryFile(): HistoryFile {
  const historyPath = getHistoryPath();
  if (!fs.existsSync(historyPath)) {
    return { meta: {}, jobs: {}, buildRecords: [] };
  }
  const content = fs.readFileSync(historyPath, 'utf-8');
  try {
    const parsed = JSON.parse(content);
    // Support old format (flat Record<string, HistoryEntry>) and new format
    if (parsed.meta || parsed.jobs) {
      return { ...parsed, buildRecords: parsed.buildRecords || [] };
    }
    // Old format: top-level is the jobs map
    return { meta: {}, jobs: parsed as HistoryData, buildRecords: [] };
  } catch {
    return { meta: {}, jobs: {}, buildRecords: [] };
  }
}

function saveHistoryFile(data: HistoryFile): void {
  const historyPath = getHistoryPath();
  fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadHistory(): HistoryData {
  return loadHistoryFile().jobs;
}

export function saveHistory(jobName: string, params: Record<string, string>): void {
  const file = loadHistoryFile();
  const entry: HistoryEntry = {
    lastParams: params,
    lastRun: new Date().toISOString(),
  };
  file.jobs[jobName] = entry;
  file.meta = { lastJob: jobName };
  saveHistoryFile(file);
}

export function getLastJob(): string | undefined {
  return loadHistoryFile().meta?.lastJob;
}

export function addBuildRecord(record: BuildRecord): void {
  const file = loadHistoryFile();
  if (!file.buildRecords) file.buildRecords = [];
  file.buildRecords.unshift(record);
  // Keep only last MAX_BUILD_RECORDS
  file.buildRecords = file.buildRecords.slice(0, MAX_BUILD_RECORDS);
  saveHistoryFile(file);
}

export function getBuildRecords(limit = 20): BuildRecord[] {
  return (loadHistoryFile().buildRecords || []).slice(0, limit);
}

export function loadParamDefs(jobName: string): JobParamDef[] | null {
  const file = loadHistoryFile();
  return file.jobs[jobName]?.paramDefs ?? null;
}

export function saveParamDefs(jobName: string, params: Record<string, string>, paramDefs: JobParamDef[]): void {
  const file = loadHistoryFile();
  if (!file.jobs[jobName]) {
    file.jobs[jobName] = { lastParams: params, lastRun: new Date().toISOString() };
  }
  file.jobs[jobName].paramDefs = paramDefs;
  file.meta = { lastJob: jobName };
  saveHistoryFile(file);
}
