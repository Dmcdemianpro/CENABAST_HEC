// src/hooks/use-cenabast.ts
// Hooks para integración con CENABAST vía Mirth

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================================
// TIPOS
// ============================================================

export type CenabastHealthStatus = {
  timestamp: string;
  status: "healthy" | "degraded" | "unhealthy";
  components: {
    database: { status: string };
    cenabast_token: {
      status: string;
      expires_at?: string;
      hours_remaining?: number;
      message?: string;
    };
    mirth: {
      host: string;
      overall: string;
      channels: Record<string, { port: number; status: string }>;
    };
    data: {
      counts: { existencias: number; movimientos: number; productos: number };
      latest: { existencia: string; movimiento: string };
    };
    recent_operations: Array<{ accion: string; detalle: string; fecha: string }>;
  };
};

export type InformarStockParams = {
  fecha_stock: string;
  id_relacion: number;
  productos?: Array<{
    codigo_interno: string;
    codigo_generico: string;
    cantidad: number;
  }>;
};

export type InformarMovimientoParams = {
  fecha_movimiento: string;
  id_relacion: number;
  tipo_movimiento: "E" | "S";
  tipo_compra: "C" | "M";
  detalles?: Array<{
    codigo_interno: string;
    codigo_generico: string;
    cantidad: number;
    lote?: string;
    fecha_vencimiento?: string;
  }>;
};

// ============================================================
// HEALTH CHECK
// ============================================================

export function useCenabastHealth() {
  return useQuery<CenabastHealthStatus>({
    queryKey: ["cenabast-health"],
    queryFn: async () => {
      const res = await fetch("/api/cenabast/health");
      if (!res.ok) throw new Error("Error verificando estado");
      return res.json();
    },
    refetchInterval: 60000, // Cada minuto
    staleTime: 30000,
  });
}

// ============================================================
// AUTENTICACIÓN
// ============================================================

export function useCenabastAuth() {
  const qc = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["cenabast-auth-status"],
    queryFn: async () => {
      const res = await fetch("/api/cenabast/auth");
      return res.json();
    },
    staleTime: 60000,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { usuario: string; clave: string }) => {
      const res = await fetch("/api/cenabast/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error autenticando");
      return data;
    },
    onSuccess: () => {
      toast.success("Autenticación CENABAST exitosa");
      qc.invalidateQueries({ queryKey: ["cenabast-auth-status"] });
      qc.invalidateQueries({ queryKey: ["cenabast-health"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cenabast/auth", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error refrescando token");
      return data;
    },
    onSuccess: () => {
      toast.success("Token CENABAST refrescado");
      qc.invalidateQueries({ queryKey: ["cenabast-auth-status"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  };
}

// ============================================================
// INFORMAR STOCK
// ============================================================

export function useInformarStock() {
  const qc = useQueryClient();

  const previewQuery = (fecha: string) =>
    useQuery({
      queryKey: ["cenabast-stock-preview", fecha],
      queryFn: async () => {
        const res = await fetch(`/api/cenabast/stock/informar?fecha=${fecha}`);
        return res.json();
      },
      enabled: !!fecha,
    });

  const mutation = useMutation({
    mutationFn: async (params: InformarStockParams) => {
      const res = await fetch("/api/cenabast/stock/informar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error informando stock");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Stock informado: ${data.productos_enviados} productos`);
      qc.invalidateQueries({ queryKey: ["cenabast-health"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    preview: previewQuery,
    informar: mutation.mutate,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
  };
}

// ============================================================
// INFORMAR MOVIMIENTOS
// ============================================================

export function useInformarMovimiento() {
  const qc = useQueryClient();

  const previewQuery = (fecha: string, tipo: "E" | "S") =>
    useQuery({
      queryKey: ["cenabast-movimiento-preview", fecha, tipo],
      queryFn: async () => {
        const res = await fetch(
          `/api/cenabast/movimiento/informar?fecha=${fecha}&tipo=${tipo}`
        );
        return res.json();
      },
      enabled: !!fecha,
    });

  const mutation = useMutation({
    mutationFn: async (params: InformarMovimientoParams) => {
      const res = await fetch("/api/cenabast/movimiento/informar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error informando movimiento");
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Movimientos informados: ${data.items_enviados} items (${data.tipo_movimiento === "E" ? "Entradas" : "Salidas"})`
      );
      qc.invalidateQueries({ queryKey: ["cenabast-health"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    preview: previewQuery,
    informar: mutation.mutate,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
  };
}

// ============================================================
// REGLAS DE STOCK
// ============================================================

export function useReglasStock() {
  const qc = useQueryClient();

  const getRegla = (solicitante: string, idRelacion: number, codigoProducto: string) =>
    useQuery({
      queryKey: ["cenabast-regla", solicitante, idRelacion, codigoProducto],
      queryFn: async () => {
        const params = new URLSearchParams({
          solicitante,
          idRelacion: String(idRelacion),
          codigoProducto,
        });
        const res = await fetch(`/api/cenabast/stock/reglas?${params}`);
        return res.json();
      },
      enabled: !!solicitante && !!codigoProducto,
    });

  const setReglasMutation = useMutation({
    mutationFn: async (
      reglas: Array<{
        RutSolicitante: string;
        IdRelacion: number;
        CodigoProducto: string;
        StockMinimo: number;
        StockMaximo: number;
      }>
    ) => {
      const res = await fetch("/api/cenabast/stock/reglas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reglas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error configurando reglas");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Reglas configuradas: ${data.reglas_enviadas}`);
      qc.invalidateQueries({ queryKey: ["cenabast-regla"] });
      qc.invalidateQueries({ queryKey: ["existencias"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const syncReglasMutation = useMutation({
    mutationFn: async (params: { rutSolicitante: string; idRelacion: number }) => {
      const qs = new URLSearchParams({
        rutSolicitante: params.rutSolicitante,
        idRelacion: String(params.idRelacion),
      });
      const res = await fetch(`/api/cenabast/stock/reglas?${qs}`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Error sincronizando");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronizadas ${data.sincronizadas} reglas con CENABAST`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    getRegla,
    setReglas: setReglasMutation.mutate,
    isSettingReglas: setReglasMutation.isPending,
    syncReglas: syncReglasMutation.mutate,
    isSyncing: syncReglasMutation.isPending,
  };
}
