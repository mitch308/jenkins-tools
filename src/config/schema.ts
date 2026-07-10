export interface ServerProfile {
  url: string;
  username: string;
  token?: string;
  password?: string;
}

export interface JobConfig {
  server: string;
  name: string;
  params?: Record<string, string>;
}

export interface ServerConfig {
  default: string;
  profiles: Record<string, ServerProfile>;
}

export interface AppConfig {
  servers: ServerConfig;
  jobs?: Record<string, JobConfig>;
}

export interface HistoryEntry {
  lastParams: Record<string, string>;
  lastRun: string;
  paramDefs?: JobParamDef[];
}

export type HistoryData = Record<string, HistoryEntry>;

export interface HistoryMeta {
  lastJob?: string;
}

export interface BuildRecord {
  jobName: string;
  buildNumber?: number;
  params?: Record<string, string>;
  triggeredAt: string;
  server?: string;
  queueUrl?: string;
}

export interface JobParamDef {
  name: string;
  type: string;
  default?: string;
  description?: string;
  choices?: string[];
}
