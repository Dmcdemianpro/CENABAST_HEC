"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart3, Boxes, PackageSearch, ArrowLeftRight } from "lucide-react";

const items = [
  { href: "/", label: "Resumen", icon: BarChart3 },
  { href: "/existencias", label: "Existencias", icon: Boxes },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/catalogo", label: "Catálogo", icon: PackageSearch },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-800 bg-slate-900/40">
      <div className="px-4 py-5 text-lg font-semibold tracking-tight">
        CENABAST • Control
      </div>
      <nav className="flex-1 px-2">
        {items.map((it) => {
          const active = path === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-slate-800/60",
                active && "bg-slate-800 text-white ring-1 ring-slate-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-xs text-slate-400">v1.0</div>
    </aside>
  );
}
