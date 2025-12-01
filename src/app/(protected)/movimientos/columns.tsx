"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type MovimientoRow = {
  id_movimiento: number;
  fechaMovimiento: string;
  bodega: string;
  tipoDocumento: string;
  numero: string;
  rut?: string | null;
  nombre?: string | null;
  codigo: string;
  codigo_zgen?: string | null;
  descripcion: string;
  numero_lote?: string | null;
  vencimiento?: string | null;
  cantidad: number;
};

function fmtDate(v?: string) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : format(d, "dd-MM-yyyy", { locale: es });
}

export const movimientosColumns: ColumnDef<MovimientoRow>[] = [
  {
    accessorKey: "fechaMovimiento",
    header: "Fecha mov.",
    cell: ({ getValue }) => fmtDate(getValue() as string),
  },
  { accessorKey: "bodega", header: "Bodega" },
  { accessorKey: "tipoDocumento", header: "Tipo doc." },
  { accessorKey: "numero", header: "Número" },
  { accessorKey: "rut", header: "RUT" },
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "codigo", header: "Código" },
  { accessorKey: "codigo_zgen", header: "ZGEN" },
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ row }) => (
      <div className="max-w-[520px] truncate">{row.original.descripcion}</div>
    ),
  },
  { accessorKey: "numero_lote", header: "Lote" },
  {
    accessorKey: "vencimiento",
    header: "Venc.",
    cell: ({ getValue }) => fmtDate(getValue() as string),
  },
  {
    accessorKey: "cantidad",
    header: "Cantidad",
    cell: ({ row }) => {
      const v = row.original.cantidad ?? 0;
      return (
        <span
          className={cn(
            "font-semibold",
            v < 0 ? "text-rose-600" : "text-emerald-700"
          )}
        >
          {v.toLocaleString("es-CL")}
        </span>
      );
    },
  },
];
