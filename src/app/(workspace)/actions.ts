"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { WikiPageType } from "@/lib/domain/types";
import { getActiveProjectId } from "@/lib/services/workspace-service";
import { compileProject } from "@/lib/services/compiler-service";
import {
  createMissingExpectedPagePlaceholder,
  updateLintIssueStatus,
} from "@/lib/services/lint-service";
import { createSourceForProjectFromForm } from "@/lib/services/source-ingestion-service";

function refreshWorkspacePaths(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/sources");
  revalidatePath("/wiki");
  revalidatePath("/wiki/[pageId]", "page");
  revalidatePath("/lint");
  revalidatePath("/artifacts");
  revalidatePath("/ask");
  revalidatePath("/settings");
}

export async function createActiveProjectSourceAction(formData: FormData) {
  const projectId = await getActiveProjectId();
  await createSourceForProjectFromForm(projectId, formData);
  refreshWorkspacePaths(projectId);
  redirect("/sources");
}

export async function compileActiveProjectWikiAction() {
  const projectId = await getActiveProjectId();
  await compileProject(projectId, "workspace-user");
  refreshWorkspacePaths(projectId);
  redirect("/wiki");
}

export async function recompileProjectFromLintAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
const redirectTo = String(formData.get("redirectTo") ?? "/lint");

  if (!projectId) {
    throw new Error("Project id is required to recompile from lint.");
  }

  await compileProject(projectId, "knowledge-linter");
  refreshWorkspacePaths(projectId);
  redirect(redirectTo);
}

export async function markLintIssueResolvedAction(formData: FormData) {
  const issueId = String(formData.get("issueId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/lint");

  if (!issueId || !projectId) {
    throw new Error("Issue id and project id are required to resolve a lint issue.");
  }

  await updateLintIssueStatus(issueId, "resolved");
  refreshWorkspacePaths(projectId);
  redirect(redirectTo);
}

export async function createMissingExpectedPagePlaceholderAction(
  formData: FormData,
) {
  const projectId = String(formData.get("projectId") ?? "");
  const pageType = String(formData.get("pageType") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const title = String(formData.get("title") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/lint");

  if (!projectId || !pageType || !slug || !title) {
    throw new Error("Missing page placeholder inputs are incomplete.");
  }

  await createMissingExpectedPagePlaceholder({
    projectId,
    pageType: pageType as WikiPageType,
    slug,
    title,
  });
  refreshWorkspacePaths(projectId);
  redirect(redirectTo);
}
