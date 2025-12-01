"use client";

import { useMemo, useState } from "react";
import { GlobalFilters } from "@/components/filters/global-filters";
import { useAnalytics } from "@/hooks/use-analytics";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { Flame, AlertTriangle, ArrowLeftRight, Activity } from "lucide-react";
import { TopRotacionBar } from "@/components/charts/top-rotacion-bar";
import { Skeleton } from "@/components/ui/skeleton";

type AnalyticsTopItem = {
  codigo: string;
  codigo_zgen?: string | null;
  descripcion?: string | null;
  rotacion: number;
};

type AnalyticsKPIs = {
  stock_critico_count?: number;
  stock_minimo_count?: number;
  movimientos_total?: number;
};

type AnalyticsResponse = {
  kpis: AnalyticsKPIs;
  topRotacion: AnalyticsTopItem[];
};

const nfCL = new Intl.NumberFormat("es-CL");

export default function HomePage() {
  const [filters, setFilters] = useState({
    fechaDesde: "",
    fechaHasta: "",
    bodega: "",
    comuna: "",
    hospital: "",
    codigo: "",
  });

  const { data, isLoading, error } = useAnalytics(filters) as {
    data?: AnalyticsResponse;
    isLoading: boolean;
    error: unknown;
  };

  const kpis = data?.kpis ?? {};
  const top = data?.topRotacion ?? [];

  const topTotal = useMemo(
    () => top.reduce((acc, it) => acc + (it.rotacion ?? 0), 0),
    [top]
  );

  return (
    <div className="space-y-5">
      {/* Título / contexto */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
            Resumen CENABAST
          </h1>
          <p className="text-sm text-slate-500">
            Indicadores y rotación por el rango seleccionado.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <GlobalFilters value={filters} onChange={setFilters} />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl bg-white" />
          ))
        ) : (
          <>
            <KpiCard
              title="Productos stock crítico"
              value={nfCL.format(kpis.stock_critico_count ?? 0)}
              subtitle="existencia ≤ stock_critico"
              Icon={Flame}
              tone="danger"
            />
            <KpiCard
              title="Productos bajo mínimo"
              value={nfCL.format(kpis.stock_minimo_count ?? 0)}
              subtitle="existencia ≤ stock_minimo"
              Icon={AlertTriangle}
              tone="warn"
            />
            <KpiCard
              title="Movimientos"
              value={nfCL.format(kpis.movimientos_total ?? 0)}
              subtitle="en rango aplicado"
              Icon={ArrowLeftRight}
              tone="info"
            />
            <KpiCard
              title="Rotación total Top 10"
              value={nfCL.format(topTotal)}
              subtitle="suma cantidades"
              Icon={Activity}
              tone="success"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Rotación */}
        <SectionCard
          title="Top 10 rotación"
          className="bg-white/90 shadow-sm border-border"
        >
          {isLoading ? (
            <Skeleton className="h-[260px] w-full rounded-xl bg-slate-100" />
          ) : (
            <>
              <TopRotacionBar data={top} loading={false} />
              {top.length === 0 && (
                <div className="text-sm text-slate-500 mt-2">
                  Sin datos para el rango seleccionado.
                </div>
              )}
            </>
          )}
        </SectionCard>

        {/* Placeholder segundo gráfico */}
        <SectionCard
          title="Existencias por fecha de corte"
          className="bg-white/90 shadow-sm border-border"
        >
          {isLoading ? (
            <Skeleton className="h-[260px] w-full rounded-xl bg-slate-100" />
          ) : (
            <div className="h-[260px] grid place-items-center text-sm text-slate-500">
              Aquí va existencias por fechaCorte
            </div>
          )}
        </SectionCard>
      </div>

      {/* Error bonito */}
      {error && (
        <SectionCard
          className="border-rose-200 bg-rose-50"
          title="Error cargando resumen"
        >
          <div className="text-sm text-rose-700">
            {(error as any)?.message ?? "Error cargando resumen"}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
