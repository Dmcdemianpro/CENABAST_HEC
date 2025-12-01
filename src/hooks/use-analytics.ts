"use client";

import { useQuery } from "@tanstack/react-query";
import qs from "qs";

export type AnalyticsParams = Partial<{
  fechaDesde: string;
  fechaHasta: string;
  bodega: string;
  comuna: string;
  hospital: string;
  codigo: string;
}>;

export function useAnalytics(params: AnalyticsParams) {
  return useQuery({
    queryKey: ["analytics", params],
    queryFn: async () => {
      const q = qs.stringify(params, { skipNulls: true, addQueryPrefix: true });
      const res = await fetch(`/api/analytics/resumen${q}`);
      if (!res.ok) throw new Error("Error cargando resumen");
      return res.json();
    },
  });
}
