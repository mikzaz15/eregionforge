import { seedCompileJobs } from "@/lib/domain/seed-data";
import type {
  CompileJob,
  CompileJobStatus,
  CompileJobType,
  OperationalObjectType,
  StringMetadata,
} from "@/lib/domain/types";
import {
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertCompileJobRecord,
} from "@/lib/persistence/database";

const compileJobsStore: CompileJob[] = structuredClone(seedCompileJobs);

type CreateCompileJobInput = {
  projectId: string;
  jobType: CompileJobType;
  targetObjectType: OperationalObjectType;
  targetObjectId?: string | null;
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
    | "status"
    | "startedAt"
    | "completedAt"
    | "summary"
    | "affectedPageIds"
    | "sourceCount"
    | "metadata"
    | "targetObjectId"
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
      jobType: input.jobType,
      targetObjectType: input.targetObjectType,
      targetObjectId: input.targetObjectId ?? null,
      status: input.status,
      triggeredBy: input.triggeredBy,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      summary: input.summary,
      affectedPageIds: input.affectedPageIds ?? [],
      sourceCount: input.sourceCount ?? 0,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
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

    if (input.targetObjectId !== undefined) {
      job.targetObjectId = input.targetObjectId;
    }

    job.updatedAt = new Date().toISOString();

    return structuredClone(job);
  }
}

class SqliteCompileJobsRepository implements CompileJobsRepository {
  async listByProjectId(projectId: string): Promise<CompileJob[]> {
    return listPersistedRecords<CompileJob>(
      "compile_jobs_store",
      `SELECT payload
       FROM compile_jobs_store
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      projectId,
    );
  }

  async getLatestByProjectId(projectId: string): Promise<CompileJob | null> {
    return getPersistedRecord<CompileJob>(
      `SELECT payload
       FROM compile_jobs_store
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      projectId,
    );
  }

  async create(input: CreateCompileJobInput): Promise<CompileJob> {
    const now = new Date().toISOString();
    const job: CompileJob = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      jobType: input.jobType,
      targetObjectType: input.targetObjectType,
      targetObjectId: input.targetObjectId ?? null,
      status: input.status,
      triggeredBy: input.triggeredBy,
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      summary: input.summary,
      affectedPageIds: input.affectedPageIds ?? [],
      sourceCount: input.sourceCount ?? 0,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    upsertCompileJobRecord(job);
    return structuredClone(job);
  }

  async update(jobId: string, input: UpdateCompileJobInput): Promise<CompileJob | null> {
    const existing = await getPersistedRecord<CompileJob>(
      "SELECT payload FROM compile_jobs_store WHERE id = ?",
      jobId,
    );

    if (!existing) {
      return null;
    }

    const updated: CompileJob = {
      ...existing,
      ...input,
      affectedPageIds:
        input.affectedPageIds !== undefined
          ? structuredClone(input.affectedPageIds)
          : existing.affectedPageIds,
      metadata:
        input.metadata !== undefined ? structuredClone(input.metadata) : existing.metadata,
      updatedAt: new Date().toISOString(),
    };

    upsertCompileJobRecord(updated);
    return structuredClone(updated);
  }
}

export const compileJobsRepository: CompileJobsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteCompileJobsRepository()
    : new InMemoryCompileJobsRepository();
