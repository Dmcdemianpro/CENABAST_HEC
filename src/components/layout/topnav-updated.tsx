// src/components/layout/topnav.tsx
// Navegación principal actualizada con integración CENABAST

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  BookOpen,
  Cloud,
} from "lucide-react";

const items = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/existencias", label: "Existencias", icon: Boxes },
  { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/cenabast", label: "CENABAST", icon: Cloud },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {items.map((it) => {
        const active = pathname === it.href;
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
            )}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
