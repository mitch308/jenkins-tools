declare module 'jenkins-api' {
  interface JenkinsApiOptions {
    baseUrl: string;
    headers?: Record<string, string>;
  }

  interface JenkinsApi {
    all_jobs(callback: (err: Error | null, data?: any) => void): void;
    job_info(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    build(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    build_with_params(jobName: string, params: Record<string, string>, callback: (err: Error | null, data?: any) => void): void;
    build_info(jobName: string, buildNumber: number, callback: (err: Error | null, data?: any) => void): void;
    last_build_info(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    console_output(jobName: string, buildNumber: number, callback: (err: Error | null, data?: any) => void): void;
  }

  function jenkins(options: JenkinsApiOptions): JenkinsApi;
  export = jenkins;
}
