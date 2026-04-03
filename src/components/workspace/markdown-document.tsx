import type { ReactNode } from "react";

type MarkdownDocumentProps = {
  content: string;
};

function renderParagraph(text: string, key: string) {
  return (
    <p key={key} className="text-sm leading-7 text-foreground">
      {text}
    </p>
  );
}

export function MarkdownDocument({ content }: Readonly<MarkdownDocumentProps>) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    nodes.push(
      renderParagraph(paragraphLines.join(" "), `paragraph-${nodes.length}`),
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    nodes.push(
      <ul key={`list-${nodes.length}`} className="space-y-2 pl-5 text-sm leading-7 text-foreground">
        {listItems.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h1 key={`h1-${nodes.length}`} className="display-title text-3xl leading-none tracking-tight text-foreground">
          {trimmed.slice(2)}
        </h1>,
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      nodes.push(
        <h2 key={`h2-${nodes.length}`} className="pt-3 text-lg font-semibold tracking-tight text-foreground">
          {trimmed.slice(3)}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-4">{nodes}</div>;
}
