"use client";
import { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { DataTable } from "./data-table";
import { useExistencias, useBatchExistencias } from "@/hooks/use-existencias";
import { Existencia } from "@/types/cenabast";
import { fmtFecha, fmtNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { exportCSV, exportExcel, exportPDF } from "@/lib/export";
import toast from "react-hot-toast";

type Props = { filters: any; onFiltersChange: (f:any)=>void };

export function ExistenciasTable({ filters, onFiltersChange }: Props) {
  const { data, isLoading } = useExistencias(filters);
  const [edited, setEdited] = useState<Record<number, Partial<Existencia>>>({});
  const batch = useBatchExistencias();

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<Existencia>[]>(() => [
    {
      accessorKey: "codigo",
      header: "Código",
      cell: ({ row }) => row.original.codigo,
    },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "bodega", header: "Bodega" },
    {
      accessorKey: "fechaCorte",
      header: "Fecha corte",
      cell: ({ row }) => fmtFecha(row.original.fechaCorte),
    },
    {
      accessorKey: "existencia",
      header: "Existencia",
      cell: ({ row }) => {
        const e = row.original;
        const color =
          e.existencia <= e.stock_critico ? "bg-red-500/20 text-red-200" :
          e.existencia <= e.stock_minimo ? "bg-yellow-500/20 text-yellow-200" :
          "bg-emerald-500/15 text-emerald-200";
        return <span className={`px-2 py-1 rounded-lg text-xs ${color}`}>{fmtNumero(e.existencia)}</span>;
      },
    },
    ...(["stock_minimo","stock_critico","stock_maximo"] as const).map((k) => ({
      accessorKey: k,
      header: k.replace("_"," "),
      cell: ({ row }) => {
        const e = row.original;
        const val = edited[e.id]?.[k] ?? e[k];
        return (
          <input
            className="w-24 rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm"
            type="number"
            min={0}
            value={val as number}
            onChange={(ev) => {
              const v = Number(ev.target.value);
              setEdited(prev => ({ ...prev, [e.id]: { ...prev[e.id], [k]: v } }));
            }}
          />
        );
      },
    })),
  ], [edited]);

  function validateBatch() {
    for (const id of Object.keys(edited)) {
      const base = rows.find(r => r.id === Number(id));
      if (!base) continue;
      const u = { ...base, ...edited[Number(id)] };
      if (u.stock_minimo < 0 || u.stock_critico < 0 || u.stock_maximo < 0) return false;
      if (!(u.stock_minimo <= u.stock_critico && u.stock_critico <= u.stock_maximo)) return false;
    }
    return true;
  }

  const pendingUpdates = Object.entries(edited).map(([id, patch]) => ({
    id: Number(id),
    stock_minimo: patch.stock_minimo ?? rows.find(r => r.id===Number(id))!.stock_minimo,
    stock_critico: patch.stock_critico ?? rows.find(r => r.id===Number(id))!.stock_critico,
    stock_maximo: patch.stock_maximo ?? rows.find(r => r.id===Number(id))!.stock_maximo,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            if (!pendingUpdates.length) return toast("No hay cambios");
            if (!validateBatch()) return toast.error("Validación de stocks falló");
            batch.mutate(pendingUpdates);
            setEdited({});
          }}
          disabled={batch.isPending}
        >
          Guardar cambios
        </Button>

        <Button variant="secondary" onClick={() => setEdited({})}>
          Deshacer
        </Button>

        <Button variant="outline" onClick={() => exportCSV(rows, "existencias_filtradas")}>
          Exportar CSV
        </Button>
        <Button variant="outline" onClick={() => exportExcel(rows, "existencias_filtradas")}>
          Exportar Excel
        </Button>
        <Button variant="outline" onClick={() => exportPDF(rows, "existencias_filtradas")}>
          Exportar PDF
        </Button>
      </div>

      <DataTable columns={columns} data={rows} isLoading={isLoading} />
      {/* paginación server-side */}
      <div className="flex items-center justify-between text-sm text-slate-300">
        <div>
          Página {data?.page ?? 1} • {data?.total ?? 0} registros
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFiltersChange({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={(data?.page ?? 1) <= 1}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onFiltersChange({ ...filters, page: (filters.page ?? 1) + 1 })}
            disabled={(data?.page ?? 1) * (data?.size ?? 20) >= (data?.total ?? 0)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
