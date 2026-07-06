import jenkins from 'jenkins-api';
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
  private client: ReturnType<typeof jenkins>;

  constructor(private profile: ServerProfile) {
    const baseUrl = profile.url.replace(/\/+$/, '');
    const auth = profile.token
      ? Buffer.from(`${profile.username}:${profile.token}`).toString('base64')
      : Buffer.from(`${profile.username}:${profile.password}`).toString('base64');

    if (!profile.token && !profile.password) {
      throw new Error('Either token or password must be provided for authentication');
    }

    this.client = jenkins({
      baseUrl,
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
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
      this.client.job_info(jobName, (err: Error | null, data: any) => {
        if (err) {
          reject(new Error(`Failed to get job info for "${jobName}": ${err.message}`));
          return;
        }
        const params: JobParamDef[] = [];
        const property = data.property?.find((p: any) => p.parameterDefinitions);
        if (property?.parameterDefinitions) {
          for (const param of property.parameterDefinitions) {
            params.push({
              name: param.name,
              type: param.type || 'StringParameterDefinition',
              default: param.defaultParameterValue?.value?.toString(),
              description: param.description,
              choices: param.choices,
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
