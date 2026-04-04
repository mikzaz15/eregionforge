import { seedTheses } from "@/lib/domain/seed-data";
import type { Thesis } from "@/lib/domain/types";

const thesesStore: Thesis[] = structuredClone(seedTheses);

export interface ThesesRepository {
  getByProjectId(projectId: string): Promise<Thesis | null>;
  upsertForProject(input: Omit<Thesis, "id" | "createdAt" | "updatedAt">): Promise<Thesis>;
}

class InMemoryThesesRepository implements ThesesRepository {
  async getByProjectId(projectId: string): Promise<Thesis | null> {
    const thesis = thesesStore.find((candidate) => candidate.projectId === projectId);
    return thesis ? structuredClone(thesis) : null;
  }

  async upsertForProject(
    input: Omit<Thesis, "id" | "createdAt" | "updatedAt">,
  ): Promise<Thesis> {
    const existing = thesesStore.find((candidate) => candidate.projectId === input.projectId);
    const now = new Date().toISOString();

    if (existing) {
      existing.title = input.title;
      existing.subjectName = input.subjectName;
      existing.ticker = input.ticker;
      existing.status = input.status;
      existing.overallStance = input.overallStance;
      existing.summary = input.summary;
      existing.bullCaseMarkdown = input.bullCaseMarkdown;
      existing.bearCaseMarkdown = input.bearCaseMarkdown;
      existing.variantViewMarkdown = input.variantViewMarkdown;
      existing.keyRisksMarkdown = input.keyRisksMarkdown;
      existing.keyUnknownsMarkdown = input.keyUnknownsMarkdown;
      existing.catalystSummaryMarkdown = input.catalystSummaryMarkdown;
      existing.confidence = input.confidence;
      existing.supportBySection = structuredClone(input.supportBySection);
      existing.metadata = input.metadata ? structuredClone(input.metadata) : {};
      existing.updatedAt = now;
      return structuredClone(existing);
    }

    const created: Thesis = {
      id: `thesis-${input.projectId}`,
      projectId: input.projectId,
      title: input.title,
      subjectName: input.subjectName,
      ticker: input.ticker,
      status: input.status,
      overallStance: input.overallStance,
      summary: input.summary,
      bullCaseMarkdown: input.bullCaseMarkdown,
      bearCaseMarkdown: input.bearCaseMarkdown,
      variantViewMarkdown: input.variantViewMarkdown,
      keyRisksMarkdown: input.keyRisksMarkdown,
      keyUnknownsMarkdown: input.keyUnknownsMarkdown,
      catalystSummaryMarkdown: input.catalystSummaryMarkdown,
      confidence: input.confidence,
      supportBySection: structuredClone(input.supportBySection),
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    thesesStore.unshift(created);
    return structuredClone(created);
  }
}

export const thesesRepository: ThesesRepository = new InMemoryThesesRepository();
