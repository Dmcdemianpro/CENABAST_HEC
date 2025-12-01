"use client";
import { useQuery } from "@tanstack/react-query";

export function useMovimientos(params: Record<string, any>) {
  return useQuery({
    queryKey: ["movimientos", params],
    queryFn: async () => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([,v]) => v !== "" && v != null) as any
      ).toString();
      const res = await fetch(`/api/movimientos?${qs}`);
      if (!res.ok) throw new Error("Error cargando movimientos");
      return res.json();
    },
    keepPreviousData: true,
  });
}
