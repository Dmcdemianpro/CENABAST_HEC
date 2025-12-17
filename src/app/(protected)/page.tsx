"use client";

import { GlobalFilters } from "@/components/filters/global-filters";
import { useState } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent } from "@/components/ui/card";
import { TopRotacionBar } from "@/components/charts/top-rotacion-bar";
import { CenabastStatusWidget } from "@/components/widgets/cenabast-status-widget";
import { StockCenabastWidget } from "@/components/widgets/stock-cenabast-widget";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Package2, ArrowUpDown, Sparkles } from "lucide-react";

export default function HomePage() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const { data, isLoading } = useAnalytics(filters);

  const k = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <GlobalFilters value={filters} onChange={setFilters} />

      {/* KPIs principales - 4 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl bg-white" />
          ))
        ) : (
          <>
            <Kpi title="Stock crítico" value={k?.stock_critico_count ?? 0} icon={Activity} tone="rose" />
            <Kpi title="Bajo mínimo" value={k?.stock_minimo_count ?? 0} icon={Sparkles} tone="amber" />
            <Kpi title="Movimientos" value={k?.movimientos_total ?? 0} icon={ArrowUpDown} tone="sky" />
            <Kpi title="Top rotación (suma)" value={data?.topRotacion?.[0]?.rotacion ?? 0} icon={Package2} tone="violet" />
          </>
        )}
      </div>

      {/* Grid principal - 2 columnas en desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Columna izquierda - Widgets verticales */}
        <div className="space-y-6">
          {/* Top 10 Rotación */}
          <Card className="rounded-2xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 border-slate-200 shadow-lg shadow-sky-100/60">
            <CardContent className="p-5">
              <div className="mb-3 font-semibold text-slate-900 text-base">
                📊 Top 10 rotación
              </div>
              <TopRotacionBar
                data={data?.topRotacion ?? []}
                loading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Salud del Sistema */}
          <Card className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 border-emerald-100 shadow-lg shadow-emerald-100/70">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-emerald-700 font-semibold">💚 Salud del sistema</p>
                  <p className="text-xs text-emerald-600">Balance de existencias y movimientos</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/70 flex items-center justify-center text-emerald-600 font-semibold text-lg">
                  {(k?.movimientos_total ?? 0).toLocaleString("es-CL")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Existencias" value={k?.existencias_total ?? 0} tone="emerald" />
                <Metric label="Mov. hoy" value={k?.movimientos_hoy ?? 0} tone="sky" />
                <Metric label="Stock crítico" value={k?.stock_critico_count ?? 0} tone="rose" />
                <Metric label="Bajo mínimo" value={k?.stock_minimo_count ?? 0} tone="amber" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha - Widgets de CENABAST */}
        <div className="space-y-6">
          {/* Estado de Envíos CENABAST */}
          <CenabastStatusWidget />

          {/* Consulta de Stock CENABAST */}
          <StockCenabastWidget />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon: Icon,
  tone = "sky",
}: {
  title: string;
  value: number;
  icon: any;
  tone?: "sky" | "emerald" | "amber" | "rose" | "violet";
}) {
  const tones: Record<typeof tone, string> = {
    sky: "from-sky-500/10 to-sky-400/20 text-sky-900 border-sky-100",
    emerald: "from-emerald-500/10 to-emerald-400/20 text-emerald-900 border-emerald-100",
    amber: "from-amber-500/10 to-amber-400/20 text-amber-900 border-amber-100",
    rose: "from-rose-500/10 to-rose-400/20 text-rose-900 border-rose-100",
    violet: "from-violet-500/10 to-violet-400/20 text-violet-900 border-violet-100",
  };

  return (
    <Card className={`rounded-2xl border shadow-sm bg-gradient-to-br ${tones[tone]}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center text-lg">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs opacity-80">{title}</div>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
  };
  return (
    <div className="p-3 rounded-xl bg-white/70 border border-white/60 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${colors[tone || "emerald"]}`}>
        {value.toLocaleString("es-CL")}
      </div>
    </div>
  );
}
