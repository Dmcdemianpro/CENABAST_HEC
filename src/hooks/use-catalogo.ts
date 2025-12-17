"use client";

import { useQuery } from "@tanstack/react-query";

export type CatalogoFilters = {
  codigo?: string;
  descripcion?: string;
  familia?: string;
  activo?: "" | "1" | "0";
  page?: number;
  size?: number;
  sort?: string;
  dir?: "asc" | "desc";
};

export type CatalogoRow = {
  id_producto: number;
  codigo: string;
  codigo_zgen?: string | null;
  descripcion: string;
  unidad_medida?: string | null;
  familia?: string | null;
  subfamilia?: string | null;
  activo: boolean;
  fecha_creacion?: string;
  fecha_actualiza?: string | null;
  usuario_actualiza?: string | null;
};

export type CatalogoResponse = {
  data: CatalogoRow[];
  total: number;
  page: number;
  size: number;
};

function buildQS(params: CatalogoFilters) {
  const qs = new URLSearchParams();

  if (params.codigo?.trim()) qs.set("codigo", params.codigo.trim());
  if (params.descripcion?.trim()) qs.set("descripcion", params.descripcion.trim());
  if (params.familia?.trim()) qs.set("familia", params.familia.trim());

  // activo solo si es "0" o "1"
  if (params.activo === "0" || params.activo === "1") {
    qs.set("activo", params.activo);
  }

  qs.set("page", String(params.page ?? 1));
  qs.set("size", String(params.size ?? 20));
  qs.set("sort", params.sort ?? "codigo");
  qs.set("dir", params.dir ?? "asc");

  return qs.toString();
}

export function useCatalogo(params: CatalogoFilters) {
  return useQuery<CatalogoResponse>({
    // ✅ misma key que invalidamos en page.tsx y sync
    queryKey: ["catalogo-productos", params],
    queryFn: async () => {
      const qs = buildQS(params);
      const res = await fetch(`/api/catalogo-productos?${qs}`, {
        headers: { Accept: "application/json" },
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error?.message || "Error cargando catálogo");
      }
      return j as CatalogoResponse;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });
}
