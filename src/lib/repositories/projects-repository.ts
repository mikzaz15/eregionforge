import { activeProjectId, seedProjects } from "@/lib/domain/seed-data";
import type { Project } from "@/lib/domain/types";
import {
  getPersistedRecord,
  getPersistedSetting,
  getPersistenceMode,
  listPersistedRecords,
} from "@/lib/persistence/database";

export interface ProjectsRepository {
  list(): Promise<Project[]>;
  getById(projectId: string): Promise<Project | null>;
  getActiveProjectId(): Promise<string>;
}

class InMemoryProjectsRepository implements ProjectsRepository {
  async list(): Promise<Project[]> {
    return structuredClone(seedProjects);
  }

  async getById(projectId: string): Promise<Project | null> {
    const project = seedProjects.find((candidate) => candidate.id === projectId);
    return project ? structuredClone(project) : null;
  }

  async getActiveProjectId(): Promise<string> {
    return activeProjectId;
  }
}

class SqliteProjectsRepository implements ProjectsRepository {
  async list(): Promise<Project[]> {
    return listPersistedRecords<Project>(
      "projects_store",
      "SELECT payload FROM projects_store ORDER BY created_at ASC, name ASC",
    );
  }

  async getById(projectId: string): Promise<Project | null> {
    return getPersistedRecord<Project>(
      "SELECT payload FROM projects_store WHERE id = ?",
      projectId,
    );
  }

  async getActiveProjectId(): Promise<string> {
    return getPersistedSetting("active_project_id") ?? activeProjectId;
  }
}

export const projectsRepository: ProjectsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteProjectsRepository()
    : new InMemoryProjectsRepository();
