"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavigationItem } from "@/lib/navigation";

export function SidebarNav({
  items,
}: Readonly<{
  items: NavigationItem[];
}>) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      <p className="mono-label mb-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        Research Surfaces
      </p>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-start gap-3 rounded-[1.4rem] border px-3.5 py-3.5 transition ${
              active
                ? "border-border-strong bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                : "border-transparent bg-transparent hover:border-border hover:bg-background/55"
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border mono-label text-[11px] font-semibold uppercase tracking-[0.24em] ${
                active
                  ? "border-accent/30 bg-accent-soft text-accent"
                  : "border-border bg-background/65 text-muted"
              }`}
            >
              {item.shortLabel}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold tracking-tight text-foreground">{item.label}</p>
              <p className="text-sm leading-5 text-muted">{item.description}</p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
