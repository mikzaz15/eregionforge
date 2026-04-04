import { seedCompanyDossiers } from "@/lib/domain/seed-data";
import type { CompanyDossier } from "@/lib/domain/types";

const companyDossiersStore: CompanyDossier[] = structuredClone(seedCompanyDossiers);

export interface CompanyDossiersRepository {
  getByProjectId(projectId: string): Promise<CompanyDossier | null>;
  upsertForProject(
    input: Omit<CompanyDossier, "id" | "createdAt" | "updatedAt">,
  ): Promise<CompanyDossier>;
}

class InMemoryCompanyDossiersRepository implements CompanyDossiersRepository {
  async getByProjectId(projectId: string): Promise<CompanyDossier | null> {
    const dossier = companyDossiersStore.find((candidate) => candidate.projectId === projectId);
    return dossier ? structuredClone(dossier) : null;
  }

  async upsertForProject(
    input: Omit<CompanyDossier, "id" | "createdAt" | "updatedAt">,
  ): Promise<CompanyDossier> {
    const existing = companyDossiersStore.find(
      (candidate) => candidate.projectId === input.projectId,
    );
    const now = new Date().toISOString();

    if (existing) {
      existing.companyName = input.companyName;
      existing.ticker = input.ticker;
      existing.sector = input.sector;
      existing.geography = input.geography;
      existing.status = input.status;
      existing.businessOverviewMarkdown = input.businessOverviewMarkdown;
      existing.productsAndSegmentsMarkdown = input.productsAndSegmentsMarkdown;
      existing.managementAndOperatorsMarkdown = input.managementAndOperatorsMarkdown;
      existing.marketAndCompetitionMarkdown = input.marketAndCompetitionMarkdown;
      existing.keyMetricsAndFactsMarkdown = input.keyMetricsAndFactsMarkdown;
      existing.sourceCoverageSummaryMarkdown = input.sourceCoverageSummaryMarkdown;
      existing.confidence = input.confidence;
      existing.supportBySection = structuredClone(input.supportBySection);
      existing.metadata = input.metadata ? structuredClone(input.metadata) : {};
      existing.updatedAt = now;
      return structuredClone(existing);
    }

    const created: CompanyDossier = {
      id: `dossier-${input.projectId}`,
      projectId: input.projectId,
      companyName: input.companyName,
      ticker: input.ticker,
      sector: input.sector,
      geography: input.geography,
      status: input.status,
      businessOverviewMarkdown: input.businessOverviewMarkdown,
      productsAndSegmentsMarkdown: input.productsAndSegmentsMarkdown,
      managementAndOperatorsMarkdown: input.managementAndOperatorsMarkdown,
      marketAndCompetitionMarkdown: input.marketAndCompetitionMarkdown,
      keyMetricsAndFactsMarkdown: input.keyMetricsAndFactsMarkdown,
      sourceCoverageSummaryMarkdown: input.sourceCoverageSummaryMarkdown,
      confidence: input.confidence,
      supportBySection: structuredClone(input.supportBySection),
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    companyDossiersStore.unshift(created);
    return structuredClone(created);
  }
}

export const companyDossiersRepository: CompanyDossiersRepository =
  new InMemoryCompanyDossiersRepository();
