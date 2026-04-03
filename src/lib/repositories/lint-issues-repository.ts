import type {
  LintIssue,
  LintIssueDraft,
  LintIssueStatus,
} from "@/lib/domain/types";

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

export const lintIssuesRepository: LintIssuesRepository =
  new InMemoryLintIssuesRepository();
