"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/tables/data-table";
import { DatePickerField } from "@/components/filters/date-picker-field";
import { useMovimientos } from "@/hooks/use-movimientos";
import { movimientosColumns } from "./columns";

export default function MovimientosPage() {
  const [draft, setDraft] = useState({
    fechaDesde: "",
    fechaHasta: "",
    bodega: "",
    tipoDocumento: "",
    rut: "",
    nombre: "",
    codigo: "",
    numero_lote: "",
    vencDesde: "",
    vencHasta: "",
  });

  const [applied, setApplied] = useState({
    ...draft,
    page: 1,
    size: 20,
    sort: "fechaMovimiento",
    dir: "desc" as "asc" | "desc",
  });

  const { data, isLoading, error } = useMovimientos(applied);

  const onApply = () => setApplied((a) => ({ ...a, ...draft, page: 1 }));

  return (
    <div className="space-y-4">
      <SectionCard title="Movimientos" className="bg-white border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <DatePickerField
            value={draft.fechaDesde}
            onChange={(v) => setDraft((f) => ({ ...f, fechaDesde: v }))}
            placeholder="Fecha desde"
          />
          <DatePickerField
            value={draft.fechaHasta}
            onChange={(v) => setDraft((f) => ({ ...f, fechaHasta: v }))}
            placeholder="Fecha hasta"
          />

          <Input
            placeholder="Bodega"
            value={draft.bodega}
            onChange={(e) => setDraft((f) => ({ ...f, bodega: e.target.value }))}
            className="bg-white"
          />
          <Input
            placeholder="Tipo doc."
            value={draft.tipoDocumento}
            onChange={(e) =>
              setDraft((f) => ({ ...f, tipoDocumento: e.target.value }))
            }
            className="bg-white"
          />
          <Input
            placeholder="RUT"
            value={draft.rut}
            onChange={(e) => setDraft((f) => ({ ...f, rut: e.target.value }))}
            className="bg-white"
          />
          <Input
            placeholder="Código/desc"
            value={draft.codigo}
            onChange={(e) => setDraft((f) => ({ ...f, codigo: e.target.value }))}
            className="bg-white"
          />

          <div className="md:col-span-6 flex gap-2 pt-2">
            <Button onClick={onApply}>Aplicar búsqueda</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Resultados" className="bg-white border-slate-200">
        <DataTable
          columns={movimientosColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          total={data?.total ?? 0}
          page={applied.page}
          size={applied.size}
          sorting={{ id: applied.sort, desc: applied.dir === "desc" }}
          onPageChange={(page) => setApplied((f) => ({ ...f, page }))}
          onSizeChange={(size) =>
            setApplied((f) => ({ ...f, size, page: 1 }))
          }
          onSortChange={(sort, dir) =>
            setApplied((f) => ({ ...f, sort, dir, page: 1 }))
          }
          getRowId={(row: any) => String(row.id_movimiento)}
        />

        {error && (
          <div className="text-sm text-rose-600 mt-2">
            {(error as any).message ?? "Error cargando movimientos"}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
