import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type Tone = "danger" | "warn" | "info" | "success";

const tone: Record<Tone, { bar: string; bg: string; icon: string }> = {
  danger:  { bar: "bg-rose-500",    bg: "bg-rose-50",    icon: "text-rose-600" },
  warn:    { bar: "bg-amber-500",  bg: "bg-amber-50",   icon: "text-amber-600" },
  info:    { bar: "bg-sky-500",    bg: "bg-sky-50",     icon: "text-sky-600" },
  success: { bar: "bg-emerald-500",bg: "bg-emerald-50", icon: "text-emerald-600" },
};

export function KpiCard({
  title,
  value,
  subtitle,
  Icon,
  tone: t = "info",
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  Icon: LucideIcon;
  tone?: Tone;
}) {
  const s = tone[t];

  return (
    <Card className="relative overflow-hidden rounded-2xl border-border bg-white shadow-sm">
      <div className={cn("absolute left-0 top-0 h-full w-1.5", s.bar)} />
      <div className="p-4 pl-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-slate-500">{title}</div>
          <div className={cn("rounded-xl p-2", s.bg)}>
            <Icon className={cn("h-5 w-5", s.icon)} />
          </div>
        </div>

        <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>

        {subtitle && (
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        )}
      </div>
    </Card>
  );
}
