import jenkinsApi from 'jenkins-api';
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
  private client: ReturnType<typeof jenkinsApi.init>;
  private authUrl: string;

  constructor(private profile: ServerProfile) {
    const baseUrl = profile.url.replace(/\/+$/, '');

    if (!profile.token && !profile.password) {
      throw new Error('Either token or password must be provided for authentication');
    }

    // jenkins-api init() only accepts a URL string with embedded credentials
    const secret = profile.token || profile.password!;
    this.authUrl = baseUrl.replace(
      /^(https?:\/\/)/,
      `$1${encodeURIComponent(profile.username)}:${encodeURIComponent(secret)}@`,
    );

    this.client = jenkinsApi.init(this.authUrl);
  }

  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.all_jobs((err: Error | null) => {
        resolve(!err);
      });
    });
  }

  async getJobInfo(jobName: string): Promise<JobInfo> {
    return new Promise((resolve, reject) => {
      this.client.job_info(jobName, async (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get job info for "${jobName}": ${err.message}`));
          return;
        }
        const params: JobParamDef[] = [];
        const property = data.property?.find((p: any) => p.parameterDefinitions);
        if (property?.parameterDefinitions) {
          // Check if any ChoiceParameter exists (uno-choice plugin) — need HTML scraping
          const hasChoiceParam = property.parameterDefinitions.some(
            (p: any) => p.type === 'ChoiceParameter' && !p.choices,
          );

          let htmlChoices: Record<string, string[]> = {};
          if (hasChoiceParam) {
            try {
              htmlChoices = await this.fetchChoiceParamsFromHtml(jobName);
            } catch {
              // If HTML scraping fails, continue without choices
            }
          }

          for (const param of property.parameterDefinitions) {
            const choices = param.choices || htmlChoices[param.name] || undefined;
            params.push({
              name: param.name,
              type: param.type || 'StringParameterDefinition',
              default: param.defaultParameterValue?.value?.toString(),
              description: param.description,
              choices,
            });
          }
        }
        resolve({
          name: data.name,
          url: data.url,
          params,
          buildable: data.buildable ?? true,
        });
      });
    });
  }

  /**
   * Fetch choice parameter options from the build form HTML page.
   * The uno-choice plugin's ChoiceParameter does not expose choices via the JSON API,
   * so we parse them from the HTML form at /job/<name>/build.
   */
  private async fetchChoiceParamsFromHtml(jobName: string): Promise<Record<string, string[]>> {
    const url = `${this.authUrl}/job/${encodeURIComponent(jobName)}/build`;
    const html = await this.httpGet(url);
    const result: Record<string, string[]> = {};

    // Find all radio/checkbox inputs grouped by name attribute
    // Pattern: name="PARAM_NAME" ... value="option_value"
    const radioRegex = /name="([^"]+)"[^>]*type="radio"[^>]*value="([^"]+)"/g;
    let match;
    while ((match = radioRegex.exec(html)) !== null) {
      const [, paramName, value] = match;
      if (!result[paramName]) {
        result[paramName] = [];
      }
      result[paramName].push(value);
    }

    // Also try select/option elements
    const selectRegex = /<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g;
    const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>/g;
    let selectMatch;
    while ((selectMatch = selectRegex.exec(html)) !== null) {
      const [, paramName, optionsHtml] = selectMatch;
      if (!result[paramName]) {
        result[paramName] = [];
      }
      let optionMatch;
      const optionRegex2 = new RegExp(optionRegex.source, 'g');
      while ((optionMatch = optionRegex2.exec(optionsHtml)) !== null) {
        result[paramName].push(optionMatch[1]);
      }
    }

    return result;
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      lib.get(url, { headers: { Accept: 'text/html' } }, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.httpGet(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  async build(jobName: string, params?: Record<string, string>): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
      const callback = (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to trigger build for "${jobName}": ${err.message}`));
          return;
        }
        resolve({
          queueUrl: data?.location || '',
        });
      };
      if (params && Object.keys(params).length > 0) {
        this.client.build_with_params(jobName, params, callback);
      } else {
        this.client.build(jobName, callback);
      }
    });
  }

  async getBuildStatus(jobName: string, buildNumber: number): Promise<BuildStatus> {
    return new Promise((resolve, reject) => {
      this.client.build_info(jobName, buildNumber, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get build status: ${err.message}`));
          return;
        }
        resolve({
          number: data.number,
          result: data.result,
          building: data.building,
          url: data.url,
          timestamp: data.timestamp,
          duration: data.duration,
        });
      });
    });
  }

  async getBuildLog(jobName: string, buildNumber: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.console_output(jobName, buildNumber, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get build log: ${err.message}`));
          return;
        }
        resolve(data || '');
      });
    });
  }

  async getLastBuildNumber(jobName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.last_build_info(jobName, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get last build number: ${err.message}`));
          return;
        }
        resolve(data?.number || 0);
      });
    });
  }
}
