"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useExistencias(params: Record<string, any>) {
  return useQuery({
    queryKey: ["existencias", params],
    queryFn: async () => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([,v]) => v !== "" && v != null) as any
      ).toString();
      const res = await fetch(`/api/existencias?${qs}`);
      if (!res.ok) throw new Error("Error cargando existencias");
      return res.json();
    },
    keepPreviousData: true,
  });
}

export function useUpdateExistenciasBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { updates: any[] }) => {
      const res = await fetch("/api/existencias/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Error guardando");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["existencias"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
