// src/hooks/use-cenabast-logs.ts
// Hook para obtener logs y estadísticas de envíos a CENABAST

"use client";

import { useQuery } from "@tanstack/react-query";

export type CenabastLog = {
  id: number;
  scheduler_id: number | null;
  tipo: string;
  modo: "MANUAL" | "AUTOMATICO";
  estado: "COMPLETADO" | "ERROR" | "PENDIENTE" | "EJECUTANDO";
  fecha_inicio: string;
  fecha_fin: string | null;
  items_enviados: number;
  items_error: number;
  mensaje: string | null;
  detalle_respuesta: string | null;
  usuario: string;
  tarea_nombre: string | null;
};

export type CenabastLogsStats = {
  total_ejecuciones: number;
  completadas: number;
  errores: number;
  en_proceso: number;
  total_items_enviados: number;
  total_items_error: number;
  ultima_ejecucion: string | null;
};

export type CenabastLogsResponse = {
  logs: CenabastLog[];
  total: number;
  page: number;
  size: number;
  stats: CenabastLogsStats;
};

export function useCenabastLogs(params?: {
  page?: number;
  size?: number;
  tipo?: string;
  estado?: string;
  modo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  return useQuery<CenabastLogsResponse>({
    queryKey: ["cenabast-logs", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.size) qs.set("size", String(params.size));
      if (params?.tipo) qs.set("tipo", params.tipo);
      if (params?.estado) qs.set("estado", params.estado);
      if (params?.modo) qs.set("modo", params.modo);
      if (params?.fechaDesde) qs.set("fechaDesde", params.fechaDesde);
      if (params?.fechaHasta) qs.set("fechaHasta", params.fechaHasta);

      const res = await fetch(`/api/cenabast/scheduler/logs?${qs}`);
      if (!res.ok) throw new Error("Error obteniendo logs");
      return res.json();
    },
    refetchInterval: 30000, // Actualizar cada 30 segundos
    staleTime: 15000,
  });
}
