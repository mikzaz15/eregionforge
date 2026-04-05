import type {
  OperatorNote,
  OperatorNoteTargetObjectType,
  OperatorNoteType,
  OperationalAuditEventType,
  OperationalObjectType,
} from "@/lib/domain/types";
import { operatorNotesRepository } from "@/lib/repositories/operator-notes-repository";
import { recordOperationalAuditEvent } from "@/lib/services/operational-history-service";

export type OperatorNoteSummary = {
  notes: OperatorNote[];
  noteCount: number;
  latestNote: OperatorNote | null;
  latestNotePreview: string | null;
};

function notePreview(note: OperatorNote | null, length = 180): string | null {
  if (!note) {
    return null;
  }

  const normalized = note.noteBody.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

export function buildOperatorNoteSummaryMap(input: {
  notes: OperatorNote[];
  targetObjectType: OperatorNoteTargetObjectType;
}): Map<string, OperatorNoteSummary> {
  const notesByTarget = new Map<string, OperatorNote[]>();

  for (const note of input.notes) {
    if (note.targetObjectType !== input.targetObjectType) {
      continue;
    }

    notesByTarget.set(note.targetObjectId, [
      ...(notesByTarget.get(note.targetObjectId) ?? []),
      note,
    ]);
  }

  return new Map(
    Array.from(notesByTarget.entries()).map(([targetObjectId, notes]) => {
      const sorted = [...notes].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      const latestNote = sorted[0] ?? null;

      return [
        targetObjectId,
        {
          notes: sorted,
          noteCount: sorted.length,
          latestNote,
          latestNotePreview: notePreview(latestNote),
        },
      ] as const;
    }),
  );
}

export async function createOperatorNote(input: {
  projectId: string;
  targetObjectType: OperatorNoteTargetObjectType;
  targetObjectId: string;
  noteBody: string;
  noteType: OperatorNoteType;
  authoredBy?: string | null;
  auditEventType: OperationalAuditEventType;
  auditTitle: string;
  auditDescription: string;
  relatedObjectType: OperationalObjectType;
  relatedObjectId: string;
  metadata?: Record<string, string>;
}): Promise<OperatorNote | null> {
  const trimmed = input.noteBody.trim();

  if (!trimmed) {
    return null;
  }

  const note = await operatorNotesRepository.create({
    projectId: input.projectId,
    targetObjectType: input.targetObjectType,
    targetObjectId: input.targetObjectId,
    noteBody: trimmed,
    noteType: input.noteType,
    authoredBy: input.authoredBy ?? "workspace-operator",
    metadata: input.metadata,
  });

  await recordOperationalAuditEvent({
    projectId: input.projectId,
    eventType: input.auditEventType,
    title: input.auditTitle,
    description: input.auditDescription,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    metadata: {
      noteType: input.noteType,
      targetObjectType: input.targetObjectType,
      targetObjectId: input.targetObjectId,
      noteId: note.id,
      ...(input.metadata ?? {}),
    },
  });

  return note;
}
