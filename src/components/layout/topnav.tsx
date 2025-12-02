// src/components/layout/topnav.tsx
// Navegación principal con integración CENABAST completa

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Gauge,
  Boxes,
  ArrowLeftRight,
  BookOpenText,
  CloudCog,
  CalendarClock,
} from "lucide-react";

const palette: Record<
  "sky" | "emerald" | "amber" | "violet" | "indigo" | "slate",
  { fg: string; bg: string }
> = {
  sky: { fg: "text-sky-600", bg: "bg-sky-50" },
  emerald: { fg: "text-emerald-600", bg: "bg-emerald-50" },
  amber: { fg: "text-amber-600", bg: "bg-amber-50" },
  violet: { fg: "text-violet-600", bg: "bg-violet-50" },
  indigo: { fg: "text-indigo-600", bg: "bg-indigo-50" },
  slate: { fg: "text-slate-700", bg: "bg-slate-100" },
};

const items = [
  { href: "/", label: "Resumen", icon: Gauge, tone: "sky" as const },
  { href: "/existencias", label: "Existencias", icon: Boxes, tone: "emerald" as const },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight, tone: "amber" as const },
  { href: "/catalogo", label: "Catálogo", icon: BookOpenText, tone: "indigo" as const },
  { href: "/cenabast", label: "CENABAST", icon: CloudCog, tone: "violet" as const },
  { href: "/cenabast/envios", label: "Envíos Auto", icon: CalendarClock, tone: "slate" as const },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-xl bg-slate-100 p-1 overflow-x-auto">
      {items.map((it) => {
        const active = pathname === it.href || 
          (it.href !== "/" && pathname.startsWith(it.href));
        const Icon = it.icon;
        const tone = palette[it.tone] || palette.sky;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition whitespace-nowrap",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition",
                active ? tone.bg : "bg-white/0",
                tone.fg
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
