import { seedCompileJobs } from "@/lib/domain/seed-data";
import type { CompileJob, CompileJobStatus, StringMetadata } from "@/lib/domain/types";

const compileJobsStore: CompileJob[] = structuredClone(seedCompileJobs);

type CreateCompileJobInput = {
  projectId: string;
  triggeredBy: string;
  status: CompileJobStatus;
  summary: string;
  affectedPageIds?: string[];
  sourceCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  metadata?: StringMetadata;
};

type UpdateCompileJobInput = Partial<
  Pick<
    CompileJob,
    "status" | "startedAt" | "completedAt" | "summary" | "affectedPageIds" | "sourceCount" | "metadata"
  >
>;

export interface CompileJobsRepository {
  listByProjectId(projectId: string): Promise<CompileJob[]>;
  getLatestByProjectId(projectId: string): Promise<CompileJob | null>;
  create(input: CreateCompileJobInput): Promise<CompileJob>;
  update(jobId: string, input: UpdateCompileJobInput): Promise<CompileJob | null>;
}

class InMemoryCompileJobsRepository implements CompileJobsRepository {
  async listByProjectId(projectId: string): Promise<CompileJob[]> {
    return structuredClone(
      compileJobsStore
        .filter((job) => job.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getLatestByProjectId(projectId: string): Promise<CompileJob | null> {
    const [latest] = compileJobsStore
      .filter((job) => job.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return latest ? structuredClone(latest) : null;
  }

  async create(input: CreateCompileJobInput): Promise<CompileJob> {
    const now = new Date().toISOString();
    const job: CompileJob = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      status: input.status,
      triggeredBy: input.triggeredBy,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      summary: input.summary,
      affectedPageIds: input.affectedPageIds ?? [],
      sourceCount: input.sourceCount ?? 0,
      metadata: input.metadata ?? {},
      createdAt: now,
    };

    compileJobsStore.unshift(job);
    return structuredClone(job);
  }

  async update(
    jobId: string,
    input: UpdateCompileJobInput,
  ): Promise<CompileJob | null> {
    const job = compileJobsStore.find((candidate) => candidate.id === jobId);

    if (!job) {
      return null;
    }

    if (input.status !== undefined) {
      job.status = input.status;
    }

    if (input.startedAt !== undefined) {
      job.startedAt = input.startedAt;
    }

    if (input.completedAt !== undefined) {
      job.completedAt = input.completedAt;
    }

    if (input.summary !== undefined) {
      job.summary = input.summary;
    }

    if (input.affectedPageIds !== undefined) {
      job.affectedPageIds = structuredClone(input.affectedPageIds);
    }

    if (input.sourceCount !== undefined) {
      job.sourceCount = input.sourceCount;
    }

    if (input.metadata !== undefined) {
      job.metadata = structuredClone(input.metadata);
    }

    return structuredClone(job);
  }
}

export const compileJobsRepository: CompileJobsRepository =
  new InMemoryCompileJobsRepository();
