"use strict";

class JobManager {
  constructor() {
    this.jobs = new Map();
  }

  start(type, runner) {
    const id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const job = {
      schema: "agenttrail.job.v1",
      id,
      type,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null
    };
    this.jobs.set(id, job);

    setTimeout(async () => {
      job.status = "running";
      job.startedAt = new Date().toISOString();
      job.progress = 15;
      try {
        const result = await runner({
          update: (progress, message) => {
            job.progress = Math.max(job.progress, Math.min(99, Number(progress) || job.progress));
            if (message) {
              job.message = message;
            }
          }
        });
        job.result = result;
        job.progress = 100;
        job.status = "completed";
      } catch (error) {
        job.error = error.message || "Job failed";
        job.status = "failed";
      } finally {
        job.finishedAt = new Date().toISOString();
      }
    }, 0);

    return job;
  }

  list() {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id) {
    return this.jobs.get(id) || null;
  }
}

module.exports = {
  JobManager
};
