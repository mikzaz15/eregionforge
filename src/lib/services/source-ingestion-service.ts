import type { Source, SourceInput } from "@/lib/domain/types";
import { parseSourceFragments } from "@/lib/domain/source-fragment-parser";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";

function normalizeText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function createSourceForProjectFromForm(
  projectId: string,
  formData: FormData,
): Promise<Source> {
  const sourceType = normalizeText(formData.get("sourceType"));
  const title = normalizeText(formData.get("title"));
  const url = normalizeText(formData.get("url"));
  const body = normalizeText(formData.get("body"));
  const filePath = normalizeText(formData.get("filePath"));
  const status = normalizeText(formData.get("status"));

  const resolvedTitle =
    title ||
    (sourceType === "text"
      ? "Untitled Pasted Source"
      : sourceType === "markdown"
        ? "Untitled Markdown Placeholder"
        : sourceType === "pdf"
          ? "Untitled PDF Placeholder"
          : "Untitled URL Record");

  const input: SourceInput = {
    title: resolvedTitle,
    sourceType:
      sourceType === "markdown" ||
      sourceType === "url" ||
      sourceType === "pdf"
        ? sourceType
        : "text",
    url: url || null,
    body:
      body ||
      (sourceType === "url"
        ? "URL placeholder recorded for future fetch and parsing."
        : sourceType === "pdf"
          ? "PDF placeholder recorded for future upload and parsing."
          : sourceType === "markdown"
            ? "Markdown placeholder recorded for future file or text ingestion."
            : null),
    filePath: filePath || null,
    status:
      status === "parsed" ||
      status === "extracted" ||
      status === "compiled" ||
      status === "failed"
        ? status
        : "pending",
  };

  const source = await sourcesRepository.create({
    ...input,
    projectId,
  });

  const fragments = parseSourceFragments(source);
  await sourceFragmentsRepository.replaceForSource(source.id, fragments);

  if (
    source.sourceType === "text" &&
    source.status === "pending" &&
    fragments.length > 0
  ) {
    return (
      (await sourcesRepository.updateStatus(source.id, "parsed")) ?? source
    );
  }

  return source;
}
