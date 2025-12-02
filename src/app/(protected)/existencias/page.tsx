"use client";

import { useMemo, useState } from "react";
import { useExistencias } from "@/hooks/use-existencias";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { RowSelectionState } from "@tanstack/react-table";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { existenciasColumns } from "./columns";
import { DatePickerField } from "@/components/filters/date-picker-field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type EditRow = {
  stock_minimo?: number;
  stock_critico?: number;
  stock_maximo?: number;
};

export default function ExistenciasPage() {
  const qc = useQueryClient();

  // filtros que editas en UI
  const [draft, setDraft] = useState({
    fechaDesde: "",
    fechaHasta: "",
    bodega: "",
    comuna: "",
    hospital: "",
    codigo: "",
    soloConExistencia: false,
  });

  // filtros aplicados (los que disparan query)
  const [applied, setApplied] = useState({
    ...draft,
    page: 1,
    size: 20,
    sort: "fechaCorte",
    dir: "desc" as "asc" | "desc",
    soloConExistencia: false,
  });

  const { data, isLoading, error } = useExistencias(applied);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [edited, setEdited] = useState<Record<number, EditRow>>({});

  const updatesToSend = useMemo(() => {
    const selectedIds = Object.entries(rowSelection)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));

    return selectedIds
      .map((id) => ({ id, ...edited[id] }))
      .filter(
        (u) =>
          u.stock_minimo !== undefined ||
          u.stock_critico !== undefined ||
          u.stock_maximo !== undefined
      );
  }, [rowSelection, edited]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/existencias/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updatesToSend }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || "Error guardando");
      return j;
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      setEdited({});
      setRowSelection({});
      qc.invalidateQueries({ queryKey: ["existencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSave = () => {
    if (updatesToSend.length === 0) {
      toast.message("No hay filas seleccionadas con cambios.");
      return;
    }
    saveMutation.mutate();
  };

  const onUndo = () => {
    setEdited({});
    toast.message("Cambios locales deshechos.");
  };

  const onApply = () => {
    setApplied((a) => ({ ...a, ...draft, page: 1 }));
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Existencias" className="bg-white border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 items-end">
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
            placeholder="Comuna"
            value={draft.comuna}
            onChange={(e) => setDraft((f) => ({ ...f, comuna: e.target.value }))}
            className="bg-white"
          />
          <Input
            placeholder="Hospital"
            value={draft.hospital}
            onChange={(e) =>
              setDraft((f) => ({ ...f, hospital: e.target.value }))
            }
            className="bg-white"
          />
          <Input
            placeholder="Código"
            value={draft.codigo}
            onChange={(e) => setDraft((f) => ({ ...f, codigo: e.target.value }))}
            className="bg-white"
          />
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox
              id="soloConExistencia"
              checked={draft.soloConExistencia}
              onCheckedChange={(v) =>
                setDraft((f) => ({ ...f, soloConExistencia: Boolean(v) }))
              }
            />
            <label htmlFor="soloConExistencia" className="cursor-pointer select-none">
              Solo con existencias &gt; 0
            </label>
          </div>

          <div className="col-span-2 md:col-span-4 xl:col-span-8 flex flex-wrap gap-2 pt-2">
            <Button onClick={onApply} variant="default">
              Aplicar búsqueda
            </Button>
            <Button onClick={onSave} disabled={saveMutation.isPending}>
              Guardar selección
            </Button>
            <Button variant="secondary" onClick={onUndo}>
              Deshacer cambios
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Resultados" className="bg-white border-slate-200">
        <DataTable
          columns={existenciasColumns}
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
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          meta={{ edited, setEdited, setRowSelection }}
          getRowId={(row: any) => String(row.id)}
        />

        {error && (
          <div className="text-sm text-rose-600 mt-2">
            {(error as any).message ?? "Error cargando existencias"}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
