import http from 'node:http';
import https from 'node:https';
import type { ServerProfile, JobParamDef } from '../config/schema.js';

export interface JobInfo {
  name: string;
  url: string;
  params: JobParamDef[];
  buildable: boolean;
}

export interface BuildResult {
  queueUrl: string;
  buildNumber?: number;
}

export interface BuildStatus {
  number: number;
  result: string | null;
  building: boolean;
  url: string;
  timestamp: number;
  duration: number;
}

export class JenkinsService {
  private baseUrl: string;
  private authHeader: string;

  constructor(private profile: ServerProfile) {
    this.baseUrl = profile.url.replace(/\/+$/, '');

    if (!profile.token && !profile.password) {
      throw new Error('Either token or password must be provided for authentication');
    }

    const secret = profile.token || profile.password!;
    this.authHeader = 'Basic ' + Buffer.from(`${profile.username}:${secret}`).toString('base64');
  }

  // ── Low-level HTTP helpers ──────────────────────────────────────

  private async request(path: string, options?: { method?: string; body?: string; contentType?: string }): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: string }> {
    const url = new URL(path, this.baseUrl);
    const lib = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request(url, {
        method: options?.method || 'GET',
        headers: {
          Authorization: this.authHeader,
          ...(options?.contentType ? { 'Content-Type': options.contentType } : {}),
        },
      }, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, this.baseUrl).toString();
          const redirectLib = redirectUrl.startsWith('https') ? https : http;
          redirectLib.get(redirectUrl, { headers: { Authorization: this.authHeader } }, (redirectRes) => {
            let body = '';
            redirectRes.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            redirectRes.on('end', () => resolve({ statusCode: redirectRes.statusCode || 0, headers: redirectRes.headers as any, body }));
            redirectRes.on('error', reject);
          }).on('error', reject);
          return;
        }

        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, headers: res.headers as any, body }));
        res.on('error', reject);
      });

      req.on('error', reject);
      if (options?.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  private async getJson<T>(path: string): Promise<T> {
    const { statusCode, body } = await this.request(path);
    if (statusCode >= 400) {
      throw new Error(`Jenkins API error: HTTP ${statusCode} for ${path}`);
    }
    return JSON.parse(body) as T;
  }

  private async getXml(path: string): Promise<string> {
    const { statusCode, body } = await this.request(path);
    if (statusCode >= 400) {
      throw new Error(`Jenkins API error: HTTP ${statusCode} for ${path}`);
    }
    return body;
  }

  private async post(path: string, body?: string, contentType?: string): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined> }> {
    const result = await this.request(path, { method: 'POST', body, contentType });
    return { statusCode: result.statusCode, headers: result.headers };
  }

  // ── Public API ──────────────────────────────────────────────────

  async testConnection(): Promise<boolean> {
    try {
      const { statusCode } = await this.request('/api/json');
      return statusCode === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get all job names from Jenkins.
   */
  async getJobNames(): Promise<string[]> {
    const data = await this.getJson<any>('/api/json?tree=jobs[name]');
    return (data.jobs || []).map((j: any) => j.name);
  }

  async getJobInfo(jobName: string): Promise<JobInfo> {
    // 1. Get basic job info from JSON API
    const data = await this.getJson<any>(`/job/${encodeURIComponent(jobName)}/api/json`);

    // 2. Get config.xml for full parameter definitions (including uno-choice)
    let configParams: JobParamDef[] = [];
    try {
      const xml = await this.getXml(`/job/${encodeURIComponent(jobName)}/config.xml`);
      configParams = this.parseParamsFromXml(xml);
    } catch {
      // Fallback: extract from JSON API if config.xml fails
      configParams = this.parseParamsFromJson(data);
    }

    return {
      name: data.name,
      url: data.url,
      params: configParams,
      buildable: data.buildable ?? true,
    };
  }

  async build(jobName: string, params?: Record<string, string>): Promise<BuildResult> {
    const jobPath = `/job/${encodeURIComponent(jobName)}`;

    let result;
    if (params && Object.keys(params).length > 0) {
      const formBody = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      result = await this.post(`${jobPath}/buildWithParameters`, formBody, 'application/x-www-form-urlencoded');
    } else {
      result = await this.post(`${jobPath}/build`);
    }

    if (result.statusCode >= 400) {
      throw new Error(`Failed to trigger build for "${jobName}": HTTP ${result.statusCode}`);
    }

    const queueUrl = typeof result.headers.location === 'string'
      ? result.headers.location
      : Array.isArray(result.headers.location)
        ? result.headers.location[0]
        : '';

    // Poll queue API to get build number (wait up to 10s)
    let buildNumber: number | undefined;
    if (queueUrl) {
      buildNumber = await this.waitForBuildNumber(queueUrl, 10000);
    }

    return { queueUrl, buildNumber };
  }

  /**
   * Wait for Jenkins queue to assign a build number.
   * Polls the queue item API until executable.buildNumber appears.
   */
  private async waitForBuildNumber(queueUrl: string, timeoutMs: number): Promise<number | undefined> {
    // Convert queue URL to API URL: http://host/queue/item/123/ → http://host/queue/item/123/api/json
    const apiUrl = queueUrl.replace(/\/$/, '') + '/api/json';
    const deadline = Date.now() + timeoutMs;
    const interval = 1000;

    while (Date.now() < deadline) {
      try {
        const data = await this.getJson<any>(apiUrl);
        if (data?.executable?.number) {
          return data.executable.number;
        }
        // Still queued, wait and retry
        if (data?.why) {
          await new Promise((r) => setTimeout(r, interval));
          continue;
        }
      } catch {
        // Queue item might not be ready yet
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    return undefined;
  }

  async getBuildStatus(jobName: string, buildNumber: number): Promise<BuildStatus> {
    const data = await this.getJson<any>(`/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`);
    return {
      number: data.number,
      result: data.result,
      building: data.building,
      url: data.url,
      timestamp: data.timestamp,
      duration: data.duration,
    };
  }

  /**
   * Abort a running build.
   */
  async abortBuild(jobName: string, buildNumber: number): Promise<void> {
    const { statusCode } = await this.request(
      `/job/${encodeURIComponent(jobName)}/${buildNumber}/stop`,
      { method: 'POST' },
    );
    if (statusCode >= 400) {
      throw new Error(`Failed to abort build #${buildNumber}: HTTP ${statusCode}`);
    }
  }

  /**
   * Delete a build record from Jenkins.
   */
  async deleteBuild(jobName: string, buildNumber: number): Promise<void> {
    const { statusCode } = await this.request(
      `/job/${encodeURIComponent(jobName)}/${buildNumber}/doDelete`,
      { method: 'POST' },
    );
    if (statusCode >= 400) {
      throw new Error(`Failed to delete build #${buildNumber}: HTTP ${statusCode}`);
    }
  }

  async getBuildLog(jobName: string, buildNumber: number): Promise<string> {
    const { body } = await this.request(`/job/${encodeURIComponent(jobName)}/${buildNumber}/consoleText`);
    return body;
  }

  async getLastBuildNumber(jobName: string): Promise<number> {
    try {
      const data = await this.getJson<any>(`/job/${encodeURIComponent(jobName)}/lastBuild/api/json`);
      return data?.number || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get last build summary: number, result, timestamp, duration.
   * Returns null if no build exists.
   */
  async getLastBuildSummary(jobName: string): Promise<BuildStatus | null> {
    try {
      const data = await this.getJson<any>(`/job/${encodeURIComponent(jobName)}/lastBuild/api/json`);
      if (!data) return null;
      return {
        number: data.number,
        result: data.result,
        building: data.building,
        url: data.url,
        timestamp: data.timestamp,
        duration: data.duration,
      };
    } catch {
      return null;
    }
  }

  // ── XML Parsing ─────────────────────────────────────────────────

  /**
   * Parse parameter definitions from config.xml, preserving XML order.
   */
  private parseParamsFromXml(xml: string): JobParamDef[] {
    const params: JobParamDef[] = [];

    // Extract the <parameterDefinitions> block
    const pdMatch = xml.match(/<parameterDefinitions>([\s\S]*?)<\/parameterDefinitions>/);
    if (!pdMatch) return params;

    const pdBlock = pdMatch[1];

    // Split into individual parameter blocks by matching each top-level tag
    // in the order they appear in the XML
    const paramTagPattern = /<(hudson\.model\.StringParameterDefinition|hudson\.model\.BooleanParameterDefinition|hudson\.model\.ChoiceParameterDefinition|org\.biouno\.unochoice\.ChoiceParameter)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;

    let match;
    while ((match = paramTagPattern.exec(pdBlock)) !== null) {
      const tag = match[1];
      const inner = match[2];

      if (tag.startsWith('hudson.model.StringParameterDefinition')) {
        const inner = match[2];
        params.push({
          name: this.extractXmlValue(inner, 'name') || '',
          type: 'StringParameterDefinition',
          default: this.extractXmlValue(inner, 'defaultValue'),
          description: this.extractXmlValue(inner, 'description'),
        });
      } else if (tag.startsWith('hudson.model.BooleanParameterDefinition')) {
        const inner = match[2];
        params.push({
          name: this.extractXmlValue(inner, 'name') || '',
          type: 'BooleanParameterDefinition',
          default: this.extractXmlValue(inner, 'defaultValue'),
          description: this.extractXmlValue(inner, 'description'),
        });
      } else if (tag.startsWith('hudson.model.ChoiceParameterDefinition')) {
        const inner = match[2];
        const choices: string[] = [];
        const choiceItemRegex = /<string>([^<]+)<\/string>/g;
        let choiceMatch;
        while ((choiceMatch = choiceItemRegex.exec(inner)) !== null) {
          choices.push(choiceMatch[1]);
        }
        params.push({
          name: this.extractXmlValue(inner, 'name') || '',
          type: 'ChoiceParameterDefinition',
          default: choices[0],
          description: this.extractXmlValue(inner, 'description'),
          choices,
        });
      } else if (tag.startsWith('org.biouno.unochoice.ChoiceParameter')) {
        const name = this.extractXmlValue(inner, 'name') || '';
        const description = this.extractXmlValue(inner, 'description');
        const choiceType = this.extractXmlValue(inner, 'choiceType') || 'PT_RADIO';
        const choices = this.parseUnoChoiceScript(inner);

        params.push({
          name,
          type: `ChoiceParameter:${choiceType}`,
          default: choices.find((c) => c.includes(':selected'))?.replace(':selected', '') || choices[0],
          description,
          choices: choices.map((c) => c.replace(':selected', '')),
        });
      }
    }

    return params;
  }

  /**
   * Parse uno-choice Groovy script to extract choice options.
   * Script format: return ['option1:selected', 'option2', ...]
   */
  private parseUnoChoiceScript(block: string): string[] {
    // Find the <script> content inside <secureScript>
    const scriptMatch = block.match(/<secureScript[^>]*>[\s\S]*?<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) return [];

    // Decode XML entities (&apos; → ', &quot; → ", &amp; → &, etc.)
    const script = scriptMatch[1]
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // Match Groovy list literal: return ['val1', 'val2', ...]
    const listMatch = script.match(/return\s*\[([\s\S]*?)\]/);
    if (!listMatch) return [];

    const listContent = listMatch[1];

    // Extract quoted strings
    const items: string[] = [];
    const itemRegex = /'([^']*)'/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(listContent)) !== null) {
      items.push(itemMatch[1]);
    }

    return items;
  }

  /**
   * Fallback: parse params from JSON API response.
   */
  private parseParamsFromJson(data: any): JobParamDef[] {
    const params: JobParamDef[] = [];
    const property = data.property?.find((p: any) => p.parameterDefinitions);
    if (!property?.parameterDefinitions) return params;

    for (const param of property.parameterDefinitions) {
      params.push({
        name: param.name,
        type: param.type || 'StringParameterDefinition',
        default: param.defaultParameterValue?.value?.toString(),
        description: param.description,
        choices: param.choices,
      });
    }
    return params;
  }

  private extractXmlValue(block: string, tag: string): string | undefined {
    const match = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1] : undefined;
  }
}
