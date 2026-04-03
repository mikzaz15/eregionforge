import type {
  Source,
  SourceFragmentPayload,
  SourceFragmentType,
} from "@/lib/domain/types";

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function lineExcerpt(value: string, length = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= length) {
    return normalized;
  }

  return `${normalized.slice(0, length).trimEnd()}...`;
}

function countTokens(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function fragmentPayload(input: {
  source: Source;
  index: number;
  fragmentType: SourceFragmentType;
  text: string;
  title?: string | null;
  metadata?: Record<string, string>;
}): SourceFragmentPayload {
  return {
    sourceId: input.source.id,
    projectId: input.source.projectId,
    index: input.index,
    fragmentType: input.fragmentType,
    title: input.title ?? null,
    text: input.text,
    excerpt: lineExcerpt(input.text),
    tokenCount: countTokens(input.text),
    charCount: input.text.length,
    metadata: input.metadata ?? {},
  };
}

function fallbackChunks(source: Source, body: string): SourceFragmentPayload[] {
  const chunks = body
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk, index) =>
    fragmentPayload({
      source,
      index,
      fragmentType: "fallback-chunk",
      text: chunk,
    }),
  );
}

export function parseSourceFragments(source: Source): SourceFragmentPayload[] {
  const body = normalizeWhitespace(source.body ?? "");

  if (!body) {
    return [];
  }

  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const fragments: SourceFragmentPayload[] = [];
  let index = 0;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    const headingMatch = lines[0].match(/^#{1,6}\s+(.+)$/);
    const setextHeadingMatch =
      lines.length >= 2 && /^(=+|-+)$/.test(lines[1]) ? lines[0] : null;

    if (headingMatch) {
      const headingTitle = headingMatch[1].trim();

      fragments.push(
        fragmentPayload({
          source,
          index,
          fragmentType: "heading",
          title: headingTitle,
          text: headingTitle,
          metadata: { markdownLevel: String(lines[0].match(/^#+/)?.[0].length ?? 1) },
        }),
      );
      index += 1;

      const remainder = lines.slice(1).join(" ").trim();

      if (remainder) {
        fragments.push(
          fragmentPayload({
            source,
            index,
            fragmentType: "paragraph",
            title: headingTitle,
            text: remainder,
          }),
        );
        index += 1;
      }

      continue;
    }

    if (setextHeadingMatch) {
      fragments.push(
        fragmentPayload({
          source,
          index,
          fragmentType: "heading",
          title: setextHeadingMatch,
          text: setextHeadingMatch,
          metadata: { markdownStyle: "setext" },
        }),
      );
      index += 1;

      const remainder = lines.slice(2).join(" ").trim();

      if (remainder) {
        fragments.push(
          fragmentPayload({
            source,
            index,
            fragmentType: "paragraph",
            title: setextHeadingMatch,
            text: remainder,
          }),
        );
        index += 1;
      }

      continue;
    }

    if (lines.length === 1 && lines[0].length <= 72 && !/[.!?]$/.test(lines[0])) {
      fragments.push(
        fragmentPayload({
          source,
          index,
          fragmentType: "heading",
          title: lines[0],
          text: lines[0],
        }),
      );
      index += 1;
      continue;
    }

    fragments.push(
      fragmentPayload({
        source,
        index,
        fragmentType: "paragraph",
        text: lines.join(" "),
      }),
    );
    index += 1;
  }

  if (
    fragments.length === 0 ||
    fragments.every((fragment) => fragment.fragmentType === "paragraph")
  ) {
    return fallbackChunks(source, body);
  }

  return fragments;
}
