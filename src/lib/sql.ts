export const EXISTENCIAS_SORT_WHITELIST = new Set([
  "fechaCorte", "fechaCarga", "existencia", "codigo", "bodega", "hospital", "comuna",
]);
export const MOVIMIENTOS_SORT_WHITELIST = new Set([
  "fechaMovimiento", "tipoDocumento", "bodega", "codigo", "cantidad",
]);
export const CATALOGO_SORT_WHITELIST = new Set([
  "codigo", "descripcion", "familia", "activo",
]);

export function safeSort(sort: string | null, dir: string | null, whitelist: Set<string>) {
  const s = sort && whitelist.has(sort) ? sort : null;
  const d = dir === "asc" || dir === "desc" ? dir : "desc";
  return { sort: s ?? "id", dir: d };
}
