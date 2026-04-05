import { seedOperatorNotes } from "@/lib/domain/seed-data";
import type {
  OperatorNote,
  OperatorNotePayload,
  OperatorNoteTargetObjectType,
} from "@/lib/domain/types";
import {
  getPersistenceMode,
  listPersistedRecords,
  upsertOperatorNoteRecord,
} from "@/lib/persistence/database";

const operatorNotesStore: OperatorNote[] = structuredClone(seedOperatorNotes);

export interface OperatorNotesRepository {
  listByProjectId(projectId: string): Promise<OperatorNote[]>;
  listByTarget(
    targetObjectType: OperatorNoteTargetObjectType,
    targetObjectId: string,
  ): Promise<OperatorNote[]>;
  create(input: OperatorNotePayload): Promise<OperatorNote>;
}

class InMemoryOperatorNotesRepository implements OperatorNotesRepository {
  async listByProjectId(projectId: string): Promise<OperatorNote[]> {
    return structuredClone(
      operatorNotesStore
        .filter((note) => note.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async listByTarget(
    targetObjectType: OperatorNoteTargetObjectType,
    targetObjectId: string,
  ): Promise<OperatorNote[]> {
    return structuredClone(
      operatorNotesStore
        .filter(
          (note) =>
            note.targetObjectType === targetObjectType &&
            note.targetObjectId === targetObjectId,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async create(input: OperatorNotePayload): Promise<OperatorNote> {
    const now = new Date().toISOString();
    const note: OperatorNote = {
      id: crypto.randomUUID(),
      ...input,
      authoredBy: input.authoredBy ?? null,
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    operatorNotesStore.unshift(note);
    return structuredClone(note);
  }
}

class SqliteOperatorNotesRepository implements OperatorNotesRepository {
  async listByProjectId(projectId: string): Promise<OperatorNote[]> {
    return listPersistedRecords<OperatorNote>(
      "operator_notes_store",
      `SELECT payload
       FROM operator_notes_store
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      projectId,
    );
  }

  async listByTarget(
    targetObjectType: OperatorNoteTargetObjectType,
    targetObjectId: string,
  ): Promise<OperatorNote[]> {
    return listPersistedRecords<OperatorNote>(
      "operator_notes_store",
      `SELECT payload
       FROM operator_notes_store
       WHERE target_object_type = ? AND target_object_id = ?
       ORDER BY created_at DESC`,
      targetObjectType,
      targetObjectId,
    );
  }

  async create(input: OperatorNotePayload): Promise<OperatorNote> {
    const now = new Date().toISOString();
    const note: OperatorNote = {
      id: crypto.randomUUID(),
      ...input,
      authoredBy: input.authoredBy ?? null,
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    upsertOperatorNoteRecord(note);
    return structuredClone(note);
  }
}

export const operatorNotesRepository: OperatorNotesRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteOperatorNotesRepository()
    : new InMemoryOperatorNotesRepository();
