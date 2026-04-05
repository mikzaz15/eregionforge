import type {
  CompileJob,
  CompileJobType,
  OperationalAuditEvent,
  OperationalAuditEventType,
  OperationalObjectType,
  StringMetadata,
} from "@/lib/domain/types";
import { compileJobsRepository } from "@/lib/repositories/compile-jobs-repository";
import { operationalAuditEventsRepository } from "@/lib/repositories/operational-audit-events-repository";

type StartedJobInput = {
  projectId: string;
  jobType: CompileJobType;
  targetObjectType: OperationalObjectType;
  targetObjectId?: string | null;
  triggeredBy: string;
  summary: string;
  metadata?: StringMetadata;
};

type CompleteJobInput = {
  jobId: string;
  summary: string;
  metadata?: StringMetadata;
  targetObjectId?: string | null;
};

type AuditEventInput = {
  projectId: string;
  eventType: OperationalAuditEventType;
  title: string;
  description: string;
  relatedObjectType?: OperationalObjectType | null;
  relatedObjectId?: string | null;
  relatedJobId?: string | null;
  metadata?: StringMetadata;
};

export async function startOperationalJob(
  input: StartedJobInput,
): Promise<CompileJob> {
  return compileJobsRepository.create({
    projectId: input.projectId,
    jobType: input.jobType,
    targetObjectType: input.targetObjectType,
    targetObjectId: input.targetObjectId ?? null,
    triggeredBy: input.triggeredBy,
    status: "running",
    summary: input.summary,
    startedAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
  });
}

export async function completeOperationalJob(
  input: CompleteJobInput,
): Promise<CompileJob | null> {
  return compileJobsRepository.update(input.jobId, {
    status: "completed",
    completedAt: new Date().toISOString(),
    summary: input.summary,
    targetObjectId: input.targetObjectId ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function failOperationalJob(
  jobId: string,
  summary: string,
  metadata?: StringMetadata,
): Promise<CompileJob | null> {
  return compileJobsRepository.update(jobId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    summary,
    metadata: metadata ?? {},
  });
}

export async function recordOperationalAuditEvent(
  input: AuditEventInput,
): Promise<OperationalAuditEvent> {
  return operationalAuditEventsRepository.create({
    projectId: input.projectId,
    eventType: input.eventType,
    title: input.title,
    description: input.description,
    relatedObjectType: input.relatedObjectType ?? null,
    relatedObjectId: input.relatedObjectId ?? null,
    relatedJobId: input.relatedJobId ?? null,
    metadata: input.metadata ?? {},
  });
}
