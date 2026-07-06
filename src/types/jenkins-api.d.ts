declare module 'jenkins-api' {
  interface JenkinsApi {
    all_jobs(callback: (err: Error | null, data?: any) => void): void;
    job_info(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    build(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    build_with_params(jobName: string, params: Record<string, string>, callback: (err: Error | null, data?: any) => void): void;
    build_info(jobName: string, buildNumber: number, callback: (err: Error | null, data?: any) => void): void;
    last_build_info(jobName: string, callback: (err: Error | null, data?: any) => void): void;
    console_output(jobName: string, buildNumber: number, callback: (err: Error | null, data?: any) => void): void;
  }

  const jenkinsApi: {
    init(url: string): JenkinsApi;
  };
  export = jenkinsApi;
}
