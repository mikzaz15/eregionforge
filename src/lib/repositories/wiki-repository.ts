import {
  seedWikiPageRevisions,
  seedWikiPageSourceLinks,
  seedWikiPages,
} from "@/lib/domain/seed-data";
import type {
  RevisionConfidence,
  StringMetadata,
  WikiPage,
  WikiPageRevision,
  WikiPageSourceLink,
  WikiPageStatus,
  WikiPageType,
} from "@/lib/domain/types";

const wikiPagesStore: WikiPage[] = structuredClone(seedWikiPages);
const wikiPageRevisionsStore: WikiPageRevision[] = structuredClone(seedWikiPageRevisions);
const wikiPageSourceLinksStore: WikiPageSourceLink[] = structuredClone(
  seedWikiPageSourceLinks,
);

type UpsertPageRevisionInput = {
  projectId: string;
  slug: string;
  title: string;
  pageType: WikiPageType;
  sourceId?: string | null;
  status: WikiPageStatus;
  markdownContent: string;
  summary: string;
  changeNote: string;
  confidence: RevisionConfidence | null;
  createdBy: string;
  generationMetadata?: StringMetadata;
};

type CreateWikiPageInput = {
  projectId: string;
  slug: string;
  title: string;
  pageType: WikiPageType;
  sourceId?: string | null;
  status: WikiPageStatus;
  generationMetadata?: StringMetadata;
};

type CreateWikiPageRevisionInput = {
  pageId: string;
  markdownContent: string;
  summary: string;
  changeNote: string;
  confidence: RevisionConfidence | null;
  createdBy: string;
  generationMetadata?: StringMetadata;
};

export interface WikiRepository {
  listPagesByProjectId(projectId: string): Promise<WikiPage[]>;
  listPagesByType(projectId: string, pageType: WikiPageType): Promise<WikiPage[]>;
  listPagesBySourceId(projectId: string, sourceId: string): Promise<WikiPage[]>;
  getPageById(pageId: string): Promise<WikiPage | null>;
  getPageByProjectAndSlug(projectId: string, slug: string): Promise<WikiPage | null>;
  listRevisionsByPageId(pageId: string): Promise<WikiPageRevision[]>;
  getCurrentRevision(pageId: string): Promise<WikiPageRevision | null>;
  listSourceIdsForPage(pageId: string): Promise<string[]>;
  createPage(input: CreateWikiPageInput): Promise<WikiPage>;
  createRevision(input: CreateWikiPageRevisionInput): Promise<WikiPageRevision>;
  updateCurrentRevision(
    pageId: string,
    revisionId: string,
    status?: WikiPageStatus,
    generationMetadata?: StringMetadata,
  ): Promise<WikiPage | null>;
  upsertPageRevision(input: UpsertPageRevisionInput): Promise<WikiPage>;
  replacePageSourceLinks(pageId: string, sourceIds: string[]): Promise<void>;
  replaceProjectSourceLinks(
    projectId: string,
    pageIds: string[],
    sourceIds: string[],
  ): Promise<void>;
}

class InMemoryWikiRepository implements WikiRepository {
  async listPagesByProjectId(projectId: string): Promise<WikiPage[]> {
    return structuredClone(
      wikiPagesStore.filter((page) => page.projectId === projectId),
    );
  }

  async listPagesByType(
    projectId: string,
    pageType: WikiPageType,
  ): Promise<WikiPage[]> {
    return structuredClone(
      wikiPagesStore.filter(
        (page) => page.projectId === projectId && page.pageType === pageType,
      ),
    );
  }

  async listPagesBySourceId(
    projectId: string,
    sourceId: string,
  ): Promise<WikiPage[]> {
    return structuredClone(
      wikiPagesStore.filter(
        (page) => page.projectId === projectId && page.sourceId === sourceId,
      ),
    );
  }

  async getPageById(pageId: string): Promise<WikiPage | null> {
    const page = wikiPagesStore.find((candidate) => candidate.id === pageId);
    return page ? structuredClone(page) : null;
  }

  async getPageByProjectAndSlug(
    projectId: string,
    slug: string,
  ): Promise<WikiPage | null> {
    const page = wikiPagesStore.find(
      (candidate) => candidate.projectId === projectId && candidate.slug === slug,
    );
    return page ? structuredClone(page) : null;
  }

  async listRevisionsByPageId(pageId: string): Promise<WikiPageRevision[]> {
    return structuredClone(
      wikiPageRevisionsStore.filter((revision) => revision.pageId === pageId),
    );
  }

  async getCurrentRevision(pageId: string): Promise<WikiPageRevision | null> {
    const page = wikiPagesStore.find((candidate) => candidate.id === pageId);

    if (!page) {
      return null;
    }

    const revision = wikiPageRevisionsStore.find(
      (candidate) => candidate.id === page.currentRevisionId,
    );

    return revision ? structuredClone(revision) : null;
  }

  async listSourceIdsForPage(pageId: string): Promise<string[]> {
    return structuredClone(
      wikiPageSourceLinksStore
        .filter((link) => link.pageId === pageId)
        .map((link) => link.sourceId),
    );
  }

  async createPage(input: CreateWikiPageInput): Promise<WikiPage> {
    const now = new Date().toISOString();
    const page: WikiPage = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      slug: input.slug,
      title: input.title,
      pageType: input.pageType,
      sourceId: input.sourceId ?? null,
      currentRevisionId: "",
      status: input.status,
      generationMetadata: input.generationMetadata,
      createdAt: now,
      updatedAt: now,
    };

    wikiPagesStore.unshift(page);
    return structuredClone(page);
  }

  async createRevision(
    input: CreateWikiPageRevisionInput,
  ): Promise<WikiPageRevision> {
    const revision: WikiPageRevision = {
      id: crypto.randomUUID(),
      pageId: input.pageId,
      markdownContent: input.markdownContent,
      summary: input.summary,
      changeNote: input.changeNote,
      confidence: input.confidence,
      createdBy: input.createdBy,
      generationMetadata: input.generationMetadata,
      createdAt: new Date().toISOString(),
    };

    wikiPageRevisionsStore.unshift(revision);
    return structuredClone(revision);
  }

  async updateCurrentRevision(
    pageId: string,
    revisionId: string,
    status?: WikiPageStatus,
    generationMetadata?: StringMetadata,
  ): Promise<WikiPage | null> {
    const page = wikiPagesStore.find((candidate) => candidate.id === pageId);

    if (!page) {
      return null;
    }

    page.currentRevisionId = revisionId;
    page.updatedAt = new Date().toISOString();

    if (status) {
      page.status = status;
    }

    if (generationMetadata) {
      page.generationMetadata = generationMetadata;
    }

    return structuredClone(page);
  }

  async upsertPageRevision(input: UpsertPageRevisionInput): Promise<WikiPage> {
    let page = wikiPagesStore.find(
      (candidate) =>
        candidate.projectId === input.projectId &&
        candidate.slug === input.slug &&
        (candidate.sourceId ?? null) === (input.sourceId ?? null),
    );

    if (!page) {
      page = await this.createPage({
        projectId: input.projectId,
        slug: input.slug,
        title: input.title,
        pageType: input.pageType,
        sourceId: input.sourceId,
        status: input.status,
        generationMetadata: input.generationMetadata,
      });
    } else {
      const pageId = page.id;
      const storedPage = wikiPagesStore.find((candidate) => candidate.id === pageId);

      if (storedPage) {
        storedPage.title = input.title;
        storedPage.pageType = input.pageType;
        storedPage.sourceId = input.sourceId ?? null;
      }
    }

    const revision = await this.createRevision({
      pageId: page.id,
      markdownContent: input.markdownContent,
      summary: input.summary,
      changeNote: input.changeNote,
      confidence: input.confidence,
      createdBy: input.createdBy,
      generationMetadata: input.generationMetadata,
    });

    const updatedPage = await this.updateCurrentRevision(
      page.id,
      revision.id,
      input.status,
      input.generationMetadata,
    );

    if (!updatedPage) {
      throw new Error("Failed to set current revision for wiki page.");
    }

    return updatedPage;
  }

  async replacePageSourceLinks(pageId: string, sourceIds: string[]): Promise<void> {
    for (let index = wikiPageSourceLinksStore.length - 1; index >= 0; index -= 1) {
      if (wikiPageSourceLinksStore[index].pageId === pageId) {
        wikiPageSourceLinksStore.splice(index, 1);
      }
    }

    for (const sourceId of sourceIds) {
      wikiPageSourceLinksStore.push({ pageId, sourceId });
    }
  }

  async replaceProjectSourceLinks(
    projectId: string,
    pageIds: string[],
    sourceIds: string[],
  ): Promise<void> {
    const projectPageIds = new Set(
      wikiPagesStore
        .filter((page) => page.projectId === projectId)
        .map((page) => page.id),
    );

    for (let index = wikiPageSourceLinksStore.length - 1; index >= 0; index -= 1) {
      if (projectPageIds.has(wikiPageSourceLinksStore[index].pageId)) {
        wikiPageSourceLinksStore.splice(index, 1);
      }
    }

    for (const pageId of pageIds) {
      for (const sourceId of sourceIds) {
        wikiPageSourceLinksStore.push({ pageId, sourceId });
      }
    }
  }
}

export const wikiRepository: WikiRepository = new InMemoryWikiRepository();
