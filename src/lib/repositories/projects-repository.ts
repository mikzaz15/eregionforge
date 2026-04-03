import { activeProjectId, seedProjects } from "@/lib/domain/seed-data";
import type { Project } from "@/lib/domain/types";

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

export const projectsRepository: ProjectsRepository =
  new InMemoryProjectsRepository();
