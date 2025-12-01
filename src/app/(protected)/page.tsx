"use client";

import { GlobalFilters } from "@/components/filters/global-filters";
import { useState } from "react";
import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent } from "@/components/ui/card";
import { TopRotacionBar } from "@/components/charts/top-rotacion-bar";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const { data, isLoading } = useAnalytics(filters);

  const k = data?.kpis;

  return (
    <div className="space-y-4">
      <GlobalFilters value={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl bg-white" />
          ))
        ) : (
          <>
            <Kpi title="Stock crítico" value={k?.stock_critico_count ?? 0} />
            <Kpi title="Bajo mínimo" value={k?.stock_minimo_count ?? 0} />
            <Kpi title="Movimientos" value={k?.movimientos_total ?? 0} />
            <Kpi
              title="Top rotación (suma)"
              value={data?.topRotacion?.[0]?.rotacion ?? 0}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ✅ SIN GRIS: card blanca nítida */}
        <Card className="rounded-2xl bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="mb-2 font-semibold text-slate-900">
              Top 10 rotación
            </div>

            {/* wrapper blanco por si algo hereda color */}
            <div className="rounded-xl bg-white">
              <TopRotacionBar
                data={data?.topRotacion ?? []}
                loading={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Aquí montas los otros charts */}
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-2xl bg-white border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-3xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
