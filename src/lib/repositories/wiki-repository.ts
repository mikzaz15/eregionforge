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
import {
  getPersistedRecord,
  getPersistenceDatabase,
  getPersistenceMode,
  listPersistedRecords,
  serializeRecord,
} from "@/lib/persistence/database";

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

class SqliteWikiRepository implements WikiRepository {
  async listPagesByProjectId(projectId: string): Promise<WikiPage[]> {
    return listPersistedRecords<WikiPage>(
      "wiki_pages_store",
      `SELECT payload
       FROM wiki_pages_store
       WHERE project_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      projectId,
    );
  }

  async listPagesByType(
    projectId: string,
    pageType: WikiPageType,
  ): Promise<WikiPage[]> {
    return listPersistedRecords<WikiPage>(
      "wiki_pages_store",
      `SELECT payload
       FROM wiki_pages_store
       WHERE project_id = ? AND page_type = ?
       ORDER BY updated_at DESC, created_at DESC`,
      projectId,
      pageType,
    );
  }

  async listPagesBySourceId(
    projectId: string,
    sourceId: string,
  ): Promise<WikiPage[]> {
    return listPersistedRecords<WikiPage>(
      "wiki_pages_store",
      `SELECT payload
       FROM wiki_pages_store
       WHERE project_id = ? AND source_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      projectId,
      sourceId,
    );
  }

  async getPageById(pageId: string): Promise<WikiPage | null> {
    return getPersistedRecord<WikiPage>(
      "SELECT payload FROM wiki_pages_store WHERE id = ?",
      pageId,
    );
  }

  async getPageByProjectAndSlug(
    projectId: string,
    slug: string,
  ): Promise<WikiPage | null> {
    return getPersistedRecord<WikiPage>(
      "SELECT payload FROM wiki_pages_store WHERE project_id = ? AND slug = ?",
      projectId,
      slug,
    );
  }

  async listRevisionsByPageId(pageId: string): Promise<WikiPageRevision[]> {
    return listPersistedRecords<WikiPageRevision>(
      "wiki_page_revisions_store",
      `SELECT payload
       FROM wiki_page_revisions_store
       WHERE page_id = ?
       ORDER BY created_at DESC`,
      pageId,
    );
  }

  async getCurrentRevision(pageId: string): Promise<WikiPageRevision | null> {
    const page = await this.getPageById(pageId);

    if (!page || !page.currentRevisionId) {
      return null;
    }

    return getPersistedRecord<WikiPageRevision>(
      "SELECT payload FROM wiki_page_revisions_store WHERE id = ?",
      page.currentRevisionId,
    );
  }

  async listSourceIdsForPage(pageId: string): Promise<string[]> {
    const database = getPersistenceDatabase();

    if (!database) {
      return [];
    }

    const rows = database
      .prepare(
        `SELECT source_id
         FROM wiki_page_source_links_store
         WHERE page_id = ?
         ORDER BY source_id ASC`,
      )
      .all(pageId);

    return rows
      .map((row) => (typeof row.source_id === "string" ? row.source_id : null))
      .filter((value): value is string => Boolean(value));
  }

  async createPage(input: CreateWikiPageInput): Promise<WikiPage> {
    const database = getPersistenceDatabase();
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

    if (database) {
      database
        .prepare(`
          INSERT INTO wiki_pages_store (
            id, project_id, slug, page_type, source_id, current_revision_id, status, created_at, updated_at, payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            project_id = excluded.project_id,
            slug = excluded.slug,
            page_type = excluded.page_type,
            source_id = excluded.source_id,
            current_revision_id = excluded.current_revision_id,
            status = excluded.status,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            payload = excluded.payload
        `)
        .run(
          page.id,
          page.projectId,
          page.slug,
          page.pageType,
          page.sourceId,
          page.currentRevisionId,
          page.status,
          page.createdAt,
          page.updatedAt,
          serializeRecord(page),
        );
    }

    return structuredClone(page);
  }

  async createRevision(
    input: CreateWikiPageRevisionInput,
  ): Promise<WikiPageRevision> {
    const database = getPersistenceDatabase();
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

    if (database) {
      database
        .prepare(`
          INSERT INTO wiki_page_revisions_store (
            id, page_id, created_at, payload
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            page_id = excluded.page_id,
            created_at = excluded.created_at,
            payload = excluded.payload
        `)
        .run(
          revision.id,
          revision.pageId,
          revision.createdAt,
          serializeRecord(revision),
        );
    }

    return structuredClone(revision);
  }

  async updateCurrentRevision(
    pageId: string,
    revisionId: string,
    status?: WikiPageStatus,
    generationMetadata?: StringMetadata,
  ): Promise<WikiPage | null> {
    const database = getPersistenceDatabase();
    const page = await this.getPageById(pageId);

    if (!database || !page) {
      return null;
    }

    const updatedPage: WikiPage = {
      ...page,
      currentRevisionId: revisionId,
      status: status ?? page.status,
      generationMetadata: generationMetadata ?? page.generationMetadata,
      updatedAt: new Date().toISOString(),
    };

    database
      .prepare(`
        INSERT INTO wiki_pages_store (
          id, project_id, slug, page_type, source_id, current_revision_id, status, created_at, updated_at, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_id = excluded.project_id,
          slug = excluded.slug,
          page_type = excluded.page_type,
          source_id = excluded.source_id,
          current_revision_id = excluded.current_revision_id,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `)
      .run(
        updatedPage.id,
        updatedPage.projectId,
        updatedPage.slug,
        updatedPage.pageType,
        updatedPage.sourceId ?? null,
        updatedPage.currentRevisionId,
        updatedPage.status,
        updatedPage.createdAt,
        updatedPage.updatedAt,
        serializeRecord(updatedPage),
      );

    return structuredClone(updatedPage);
  }

  async upsertPageRevision(input: UpsertPageRevisionInput): Promise<WikiPage> {
    let page = await getPersistedRecord<WikiPage>(
      `SELECT payload
       FROM wiki_pages_store
       WHERE project_id = ? AND slug = ? AND COALESCE(source_id, '') = COALESCE(?, '')`,
      input.projectId,
      input.slug,
      input.sourceId ?? null,
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
      const database = getPersistenceDatabase();

      if (database) {
        const refreshedPage: WikiPage = {
          ...page,
          title: input.title,
          pageType: input.pageType,
          sourceId: input.sourceId ?? null,
        };

        database
          .prepare(`
            INSERT INTO wiki_pages_store (
              id, project_id, slug, page_type, source_id, current_revision_id, status, created_at, updated_at, payload
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              project_id = excluded.project_id,
              slug = excluded.slug,
              page_type = excluded.page_type,
              source_id = excluded.source_id,
              current_revision_id = excluded.current_revision_id,
              status = excluded.status,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              payload = excluded.payload
          `)
          .run(
            refreshedPage.id,
            refreshedPage.projectId,
            refreshedPage.slug,
            refreshedPage.pageType,
            refreshedPage.sourceId ?? null,
            refreshedPage.currentRevisionId,
            refreshedPage.status,
            refreshedPage.createdAt,
            refreshedPage.updatedAt,
            serializeRecord(refreshedPage),
          );

        page = refreshedPage;
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
    const database = getPersistenceDatabase();

    if (!database) {
      return;
    }

    const deleteStatement = database.prepare(
      "DELETE FROM wiki_page_source_links_store WHERE page_id = ?",
    );
    const insertStatement = database.prepare(`
      INSERT INTO wiki_page_source_links_store (
        page_id, source_id
      ) VALUES (?, ?)
      ON CONFLICT(page_id, source_id) DO NOTHING
    `);

    deleteStatement.run(pageId);

    for (const sourceId of Array.from(new Set(sourceIds))) {
      insertStatement.run(pageId, sourceId);
    }
  }

  async replaceProjectSourceLinks(
    projectId: string,
    pageIds: string[],
    sourceIds: string[],
  ): Promise<void> {
    const database = getPersistenceDatabase();

    if (!database) {
      return;
    }

    const projectPages = database
      .prepare("SELECT id FROM wiki_pages_store WHERE project_id = ?")
      .all(projectId)
      .map((row) => (typeof row.id === "string" ? row.id : null))
      .filter((value): value is string => Boolean(value));

    if (projectPages.length > 0) {
      const placeholders = projectPages.map(() => "?").join(", ");
      database
        .prepare(
          `DELETE FROM wiki_page_source_links_store WHERE page_id IN (${placeholders})`,
        )
        .run(...projectPages);
    }

    const insertStatement = database.prepare(`
      INSERT INTO wiki_page_source_links_store (
        page_id, source_id
      ) VALUES (?, ?)
      ON CONFLICT(page_id, source_id) DO NOTHING
    `);

    for (const pageId of Array.from(new Set(pageIds))) {
      for (const sourceId of Array.from(new Set(sourceIds))) {
        insertStatement.run(pageId, sourceId);
      }
    }
  }
}

export const wikiRepository: WikiRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteWikiRepository()
    : new InMemoryWikiRepository();
