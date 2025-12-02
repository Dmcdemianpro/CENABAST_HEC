// src/hooks/use-cenabast-scheduler.ts
// Hooks para gestión de tareas programadas y dashboard de envíos

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================================
// TIPOS
// ============================================================

export type TipoTarea = "STOCK" | "MOVIMIENTO_ENTRADA" | "MOVIMIENTO_SALIDA" | "REGLAS";
export type EstadoEjecucion = "PENDIENTE" | "EJECUTANDO" | "COMPLETADO" | "ERROR";
export type ModoEjecucion = "MANUAL" | "AUTOMATICO";

export type TareaProgramada = {
  id: number;
  nombre: string;
  tipo: TipoTarea;
  activo: boolean;
  hora_ejecucion: string;
  dias_semana: string;
  id_relacion: number;
  tipo_compra: "C" | "M";
  ultima_ejecucion: string | null;
  proxima_ejecucion: string | null;
  created_at: string;
  updated_at: string;
  ejecuciones_exitosas?: number;
  ejecuciones_fallidas?: number;
  ultima_ejecucion_real?: string;
};

export type LogEjecucion = {
  id: number;
  scheduler_id: number | null;
  tipo: TipoTarea;
  modo: ModoEjecucion;
  estado: EstadoEjecucion;
  fecha_inicio: string;
  fecha_fin: string | null;
  items_enviados: number;
  items_error: number;
  mensaje: string | null;
  detalle_respuesta: string | null;
  usuario: string;
  scheduler_nombre?: string;
};

export type LogsStats = {
  total_ejecuciones: number;
  completadas: number;
  errores: number;
  en_proceso: number;
  total_items_enviados: number;
  total_items_error: number;
  ultima_ejecucion: string | null;
};

export type NuevaTarea = Omit<TareaProgramada, "id" | "created_at" | "updated_at" | "ultima_ejecucion" | "proxima_ejecucion">;

// ============================================================
// TAREAS PROGRAMADAS
// ============================================================

export function useSchedulerTareas(incluirInactivos = false) {
  return useQuery<{ tareas: TareaProgramada[]; total: number }>({
    queryKey: ["cenabast-scheduler", incluirInactivos],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (incluirInactivos) params.set("incluirInactivos", "true");
      const res = await fetch(`/api/cenabast/scheduler?${params}`);
      if (!res.ok) throw new Error("Error cargando tareas");
      return res.json();
    },
    refetchInterval: 60000, // Refrescar cada minuto
  });
}

export function useCrearTarea() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tarea: NuevaTarea) => {
      const res = await fetch("/api/cenabast/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tarea),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error creando tarea");
      return data;
    },
    onSuccess: () => {
      toast.success("Tarea programada creada");
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActualizarTarea() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tarea: Partial<TareaProgramada> & { id: number }) => {
      const res = await fetch("/api/cenabast/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tarea),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error actualizando");
      return data;
    },
    onSuccess: () => {
      toast.success("Tarea actualizada");
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEliminarTarea() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cenabast/scheduler?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error eliminando");
      return data;
    },
    onSuccess: () => {
      toast.success("Tarea eliminada");
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleTarea() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const res = await fetch("/api/cenabast/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error actualizando");
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.activo ? "Tarea activada" : "Tarea pausada");
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ============================================================
// EJECUCIÓN DE TAREAS
// ============================================================

export function useEjecutarTarea() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tipo: TipoTarea;
      id_relacion: number;
      tipo_compra?: "C" | "M";
    }) => {
      const res = await fetch("/api/cenabast/scheduler/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error ejecutando");
      return data;
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(`Ejecutado: ${data.items} items enviados`);
      } else {
        toast.error(data.error || "Error en ejecución");
      }
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler-logs"] });
      qc.invalidateQueries({ queryKey: ["cenabast-health"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEjecutarPendientes() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cenabast/scheduler/execute");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error ejecutando");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.ejecutadas} tareas ejecutadas`);
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler"] });
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler-logs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ============================================================
// LOGS / HISTORIAL
// ============================================================

export type LogsFilters = {
  page?: number;
  size?: number;
  tipo?: TipoTarea | "";
  estado?: EstadoEjecucion | "";
  modo?: ModoEjecucion | "";
  fechaDesde?: string;
  fechaHasta?: string;
};

export function useSchedulerLogs(filters: LogsFilters = {}) {
  return useQuery<{
    logs: LogEjecucion[];
    total: number;
    page: number;
    size: number;
    stats: LogsStats;
  }>({
    queryKey: ["cenabast-scheduler-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.size) params.set("size", String(filters.size));
      if (filters.tipo) params.set("tipo", filters.tipo);
      if (filters.estado) params.set("estado", filters.estado);
      if (filters.modo) params.set("modo", filters.modo);
      if (filters.fechaDesde) params.set("fechaDesde", filters.fechaDesde);
      if (filters.fechaHasta) params.set("fechaHasta", filters.fechaHasta);

      const res = await fetch(`/api/cenabast/scheduler/logs?${params}`);
      if (!res.ok) throw new Error("Error cargando logs");
      return res.json();
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });
}

export function useLimpiarLogs() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dias: number = 30) => {
      const res = await fetch(`/api/cenabast/scheduler/logs?dias=${dias}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error limpiando");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.eliminados} registros eliminados`);
      qc.invalidateQueries({ queryKey: ["cenabast-scheduler-logs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ============================================================
// HELPERS
// ============================================================

export const TIPO_TAREA_LABELS: Record<TipoTarea, string> = {
  STOCK: "Stock Consolidado",
  MOVIMIENTO_ENTRADA: "Movimientos Entrada",
  MOVIMIENTO_SALIDA: "Movimientos Salida",
  REGLAS: "Reglas Min/Max",
};

export const ESTADO_LABELS: Record<EstadoEjecucion, { label: string; color: string }> = {
  PENDIENTE: { label: "Pendiente", color: "bg-slate-100 text-slate-700" },
  EJECUTANDO: { label: "Ejecutando", color: "bg-blue-100 text-blue-700" },
  COMPLETADO: { label: "Completado", color: "bg-emerald-100 text-emerald-700" },
  ERROR: { label: "Error", color: "bg-rose-100 text-rose-700" },
};

export const DIAS_SEMANA_LABELS: Record<string, string> = {
  "1": "Lun",
  "2": "Mar",
  "3": "Mié",
  "4": "Jue",
  "5": "Vie",
  "6": "Sáb",
  "7": "Dom",
};

export function formatDiasSemana(dias: string): string {
  return dias
    .split(",")
    .map((d) => DIAS_SEMANA_LABELS[d] || d)
    .join(", ");
}
