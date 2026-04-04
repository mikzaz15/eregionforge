import type { ReactNode } from "react";

export type StatusTone = "neutral" | "accent" | "success" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-background/75 text-muted",
  accent: "border-accent/30 bg-accent-soft text-accent",
  success: "border-success/30 bg-[rgba(49,87,79,0.12)] text-success",
  danger: "border-danger/30 bg-[rgba(139,79,73,0.12)] text-danger",
};

export function PageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="space-y-7">
      <div className="rounded-[1.85rem] border border-border bg-background/72 px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.32)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="mono-label text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              {eyebrow}
            </p>
            <div className="space-y-2">
              <h1 className="display-title text-4xl leading-none tracking-tight text-foreground sm:text-[3.2rem]">
                {title}
              </h1>
              <p className="max-w-2xl text-balance text-sm leading-7 text-muted sm:text-[15px]">
                {description}
              </p>
            </div>
          </div>
          {actions ? <div className="shrink-0 xl:max-w-[40rem]">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section className="rounded-[1.85rem] border border-border bg-background/72 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)]">
      <div className="mb-6 space-y-2">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  note,
}: Readonly<{
  label: string;
  value: string;
  note: string;
}>) {
  return (
    <section className="rounded-[1.85rem] border border-border bg-background/72 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-3 max-w-[24rem] text-sm leading-6 text-muted">{note}</p>
    </section>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: Readonly<{
  tone?: StatusTone;
  children: ReactNode;
}>) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 mono-label text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
