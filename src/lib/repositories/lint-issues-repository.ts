import type {
  LintIssue,
  LintIssueDraft,
  LintIssueStatus,
} from "@/lib/domain/types";
import {
  deleteRecordsByIds,
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertLintIssueRecord,
} from "@/lib/persistence/database";

const lintIssuesStore: LintIssue[] = [];

function issueId(projectId: string, stableKey: string): string {
  return `lint-${projectId}-${stableKey}`;
}

export interface LintIssuesRepository {
  listByProjectId(projectId: string): Promise<LintIssue[]>;
  syncProjectIssues(projectId: string, issueDrafts: LintIssueDraft[]): Promise<LintIssue[]>;
  updateStatus(
    issueId: string,
    status: LintIssueStatus,
  ): Promise<LintIssue | null>;
}

class InMemoryLintIssuesRepository implements LintIssuesRepository {
  async listByProjectId(projectId: string): Promise<LintIssue[]> {
    return structuredClone(
      lintIssuesStore
        .filter((issue) => issue.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async syncProjectIssues(
    projectId: string,
    issueDrafts: LintIssueDraft[],
  ): Promise<LintIssue[]> {
    const now = new Date().toISOString();
    const existingById = new Map(
      lintIssuesStore
        .filter((issue) => issue.projectId === projectId)
        .map((issue) => [issue.id, issue] as const),
    );
    const nextIssues = issueDrafts.map<LintIssue>((draft) => {
      const id = issueId(projectId, draft.stableKey);
      const existing = existingById.get(id);

      if (existing) {
        existing.issueType = draft.issueType;
        existing.severity = draft.severity;
        existing.relatedPageId = draft.relatedPageId ?? null;
        existing.relatedClaimIds = structuredClone(draft.relatedClaimIds);
        existing.title = draft.title;
        existing.description = draft.description;
        existing.recommendedAction = draft.recommendedAction;
        existing.metadata = draft.metadata ? structuredClone(draft.metadata) : {};
        existing.updatedAt = now;
        return structuredClone(existing);
      }

      const created: LintIssue = {
        id,
        projectId,
        issueType: draft.issueType,
        severity: draft.severity,
        status: draft.status ?? "open",
        relatedPageId: draft.relatedPageId ?? null,
        relatedClaimIds: structuredClone(draft.relatedClaimIds),
        title: draft.title,
        description: draft.description,
        recommendedAction: draft.recommendedAction,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: now,
        updatedAt: now,
      };

      lintIssuesStore.push(created);
      return structuredClone(created);
    });

    const nextIssueIds = new Set(nextIssues.map((issue) => issue.id));

    for (let index = lintIssuesStore.length - 1; index >= 0; index -= 1) {
      const issue = lintIssuesStore[index];
      if (issue.projectId === projectId && !nextIssueIds.has(issue.id)) {
        lintIssuesStore.splice(index, 1);
      }
    }

    return structuredClone(
      lintIssuesStore
        .filter((issue) => issue.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async updateStatus(
    targetIssueId: string,
    status: LintIssueStatus,
  ): Promise<LintIssue | null> {
    const issue = lintIssuesStore.find((candidate) => candidate.id === targetIssueId);

    if (!issue) {
      return null;
    }

    issue.status = status;
    issue.updatedAt = new Date().toISOString();

    return structuredClone(issue);
  }
}

class SqliteLintIssuesRepository implements LintIssuesRepository {
  async listByProjectId(projectId: string): Promise<LintIssue[]> {
    return listPersistedRecords<LintIssue>(
      "lint_issues_store",
      `SELECT payload
       FROM lint_issues_store
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
      projectId,
    );
  }

  async syncProjectIssues(
    projectId: string,
    issueDrafts: LintIssueDraft[],
  ): Promise<LintIssue[]> {
    const now = new Date().toISOString();
    const existing = await this.listByProjectId(projectId);
    const existingById = new Map(existing.map((entry) => [entry.id, entry] as const));
    const nextIssues = issueDrafts.map<LintIssue>((draft) => {
      const id = issueId(projectId, draft.stableKey);
      const previous = existingById.get(id);
      const issue: LintIssue = {
        id,
        projectId,
        issueType: draft.issueType,
        severity: draft.severity,
        status: previous?.status ?? draft.status ?? "open",
        relatedPageId: draft.relatedPageId ?? null,
        relatedClaimIds: structuredClone(draft.relatedClaimIds),
        title: draft.title,
        description: draft.description,
        recommendedAction: draft.recommendedAction,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      upsertLintIssueRecord(issue);
      return issue;
    });

    const nextIds = new Set(nextIssues.map((entry) => entry.id));
    deleteRecordsByIds(
      "lint_issues_store",
      existing.filter((entry) => !nextIds.has(entry.id)).map((entry) => entry.id),
    );

    return this.listByProjectId(projectId);
  }

  async updateStatus(
    targetIssueId: string,
    status: LintIssueStatus,
  ): Promise<LintIssue | null> {
    const issue = getPersistedRecord<LintIssue>(
      "SELECT payload FROM lint_issues_store WHERE id = ?",
      targetIssueId,
    );

    if (!issue) {
      return null;
    }

    const updated: LintIssue = {
      ...issue,
      status,
      updatedAt: new Date().toISOString(),
    };

    upsertLintIssueRecord(updated);
    return structuredClone(updated);
  }
}

export const lintIssuesRepository: LintIssuesRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteLintIssuesRepository()
    : new InMemoryLintIssuesRepository();
