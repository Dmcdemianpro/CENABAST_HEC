"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type ExistenciaRow = {
  id: number;
  fechaCorte: string;
  comuna: string;
  hospital: string;
  bodega: string;
  codigo: string;
  codigo_zgen?: string | null;
  descripcion: string;
  existencia: number;
  stock_minimo?: number | null;
  stock_critico?: number | null;
  stock_maximo?: number | null;
};

function fmtDate(v?: string) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : format(d, "dd-MM-yyyy", { locale: es });
}

function EditableNumber({
  rowId,
  field,
  value,
  tableMeta,
}: {
  rowId: number;
  field: "stock_minimo" | "stock_critico" | "stock_maximo";
  value?: number | null;
  tableMeta: any;
}) {
  const edited = tableMeta?.edited?.[rowId]?.[field];
  const display = edited ?? value ?? "";

  return (
    <Input
      type="number"
      min={0}
      value={display}
      onChange={(e) => {
        const num = e.target.value === "" ? undefined : Number(e.target.value);
        tableMeta?.setEdited((prev: any) => ({
          ...prev,
          [rowId]: { ...prev[rowId], [field]: num },
        }));
      }}
      className="h-8 w-24 bg-white text-right"
    />
  );
}

export const existenciasColumns: ColumnDef<ExistenciaRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Seleccionar todo"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Seleccionar fila"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32,
  },
  {
    accessorKey: "fechaCorte",
    header: "Fecha corte",
    cell: ({ getValue }) => fmtDate(getValue() as string),
  },
  { accessorKey: "comuna", header: "Comuna" },
  { accessorKey: "hospital", header: "Hospital" },
  { accessorKey: "bodega", header: "Bodega" },
  { accessorKey: "codigo", header: "Código" },
  { accessorKey: "codigo_zgen", header: "ZGEN" },
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ row }) => (
      <div className="max-w-[520px] truncate">{row.original.descripcion}</div>
    ),
  },
  {
    accessorKey: "existencia",
    header: "Existencia",
    cell: ({ row }) => {
      const e = row.original.existencia ?? 0;
      const min = row.original.stock_minimo ?? 0;
      const crit = row.original.stock_critico ?? 0;

      const tone =
        e <= crit
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : e <= min
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";

      return (
        <span
          className={cn(
            "inline-flex min-w-[80px] justify-end rounded-md border px-2 py-1 font-semibold",
            tone
          )}
        >
          {e.toLocaleString("es-CL")}
        </span>
      );
    },
  },
  {
    accessorKey: "stock_minimo",
    header: "Stock mín.",
    cell: ({ row, table }) => (
      <EditableNumber
        rowId={row.original.id}
        field="stock_minimo"
        value={row.original.stock_minimo}
        tableMeta={table.options.meta}
      />
    ),
  },
  {
    accessorKey: "stock_critico",
    header: "Stock crít.",
    cell: ({ row, table }) => (
      <EditableNumber
        rowId={row.original.id}
        field="stock_critico"
        value={row.original.stock_critico}
        tableMeta={table.options.meta}
      />
    ),
  },
  {
    accessorKey: "stock_maximo",
    header: "Stock máx.",
    cell: ({ row, table }) => (
      <EditableNumber
        rowId={row.original.id}
        field="stock_maximo"
        value={row.original.stock_maximo}
        tableMeta={table.options.meta}
      />
    ),
  },
];
