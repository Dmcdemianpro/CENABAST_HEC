"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { useCatalogo } from "@/hooks/use-catalogo";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { RefreshCw, Pencil, Trash2, Plus, Filter, RotateCcw } from "lucide-react";

export type Catalogo = {
  id_producto: number;
  codigo: string;
  codigo_zgen?: string | null;
  descripcion: string;
  unidad_medida?: string | null;
  familia?: string | null;
  subfamilia?: string | null;
  activo: boolean;
};

const catalogoSchema = z.object({
  codigo: z.string().min(1, "Código obligatorio"),
  codigo_zgen: z.string().optional().nullable(),
  descripcion: z.string().min(1, "Descripción obligatoria"),
  unidad_medida: z.string().optional().nullable(),
  familia: z.string().optional().nullable(),
  subfamilia: z.string().optional().nullable(),
  activo: z.boolean().default(true),
});

type CatalogoForm = z.infer<typeof catalogoSchema>;

export default function CatalogoPage() {
  const qc = useQueryClient();

  // filtros editables (NO disparan búsqueda inmediata)
  const [draft, setDraft] = useState({
    codigo: "",
    descripcion: "",
    familia: "",
    activo: "", // "" | "1" | "0"
  });

  // filtros aplicados (sí disparan query)
  const [filters, setFilters] = useState({
    ...draft,
    page: 1,
    size: 20,
    sort: "codigo",
    dir: "asc" as "asc" | "desc",
  });

  const { data, isLoading, error } = useCatalogo(filters);

  // ----------------------------
  // Sync manual (incremental)
  // ----------------------------
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/catalogo-productos/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "incremental" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || "Error sincronizando");
      return j;
    },
    onSuccess: (r) => {
      toast.success(`Sync OK: ${r.inserted} nuevos productos agregados.`);
      qc.invalidateQueries({ queryKey: ["catalogo-productos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ----------------------------
  // Dialog state (Create / Edit)
  // ----------------------------
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Catalogo | null>(null);
  const [form, setForm] = useState<CatalogoForm>({
    codigo: "",
    codigo_zgen: "",
    descripcion: "",
    unidad_medida: "",
    familia: "",
    subfamilia: "",
    activo: true,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      codigo: "",
      codigo_zgen: "",
      descripcion: "",
      unidad_medida: "",
      familia: "",
      subfamilia: "",
      activo: true,
    });
    setOpen(true);
  };

  const openEdit = (row: Catalogo) => {
    setEditing(row);
    setForm({
      codigo: row.codigo,
      codigo_zgen: row.codigo_zgen ?? "",
      descripcion: row.descripcion,
      unidad_medida: row.unidad_medida ?? "",
      familia: row.familia ?? "",
      subfamilia: row.subfamilia ?? "",
      activo: row.activo,
    });
    setOpen(true);
  };

  // ----------------------------
  // Mutations CRUD
  // ----------------------------
  const createMutation = useMutation({
    mutationFn: async (payload: CatalogoForm) => {
      const res = await fetch("/api/catalogo-productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, usuario_actualiza: "admin" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || "Error creando");
      return j;
    },
    onSuccess: () => {
      toast.success("Producto creado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["catalogo-productos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CatalogoForm) => {
      if (!editing) throw new Error("No hay producto en edición");
      const res = await fetch(`/api/catalogo-productos/${editing.id_producto}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, usuario_actualiza: "admin" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || "Error actualizando");
      return j;
    },
    onSuccess: () => {
      toast.success("Producto actualizado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["catalogo-productos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: Catalogo) => {
      const res = await fetch(`/api/catalogo-productos/${row.id_producto}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_actualiza: "admin" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || "Error eliminando");
      return j;
    },
    onSuccess: () => {
      toast.success("Producto desactivado");
      qc.invalidateQueries({ queryKey: ["catalogo-productos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = () => {
    const parsed = catalogoSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Formulario inválido");
      return;
    }

    if (editing) updateMutation.mutate(parsed.data);
    else createMutation.mutate(parsed.data);
  };

  // ----------------------------
  // Columns
  // ----------------------------
  const columns = useMemo<ColumnDef<Catalogo>[]>(() => [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "codigo_zgen", header: "ZGEN" },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "unidad_medida", header: "Unidad" },
    { accessorKey: "familia", header: "Familia" },
    { accessorKey: "subfamilia", header: "Subfamilia" },
    {
      accessorKey: "activo",
      header: "Activo",
      cell: ({ row }) => (row.original.activo ? "Sí" : "No"),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => openEdit(row.original)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => deleteMutation.mutate(row.original)}
            title="Desactivar"
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      ),
    },
  ], [deleteMutation]);

  // ----------------------------
  // Filter handlers
  // ----------------------------
  const applyFilters = () => {
    setFilters((f) => ({ ...f, ...draft, page: 1 }));
  };

  const clearFilters = () => {
    const cleared = { codigo: "", descripcion: "", familia: "", activo: "" };
    setDraft(cleared);
    setFilters((f) => ({ ...f, ...cleared, page: 1 }));
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl bg-white border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-lg font-semibold text-slate-900">
              Catálogo productos
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
                />
                {syncMutation.isPending
                  ? "Buscando nuevos fármacos..."
                  : "Buscar nuevos fármacos"}
              </Button>

              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo producto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input
              placeholder="Código"
              value={draft.codigo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, codigo: e.target.value }))
              }
            />
            <Input
              placeholder="Descripción"
              value={draft.descripcion}
              onChange={(e) =>
                setDraft((d) => ({ ...d, descripcion: e.target.value }))
              }
            />
            <Input
              placeholder="Familia"
              value={draft.familia}
              onChange={(e) =>
                setDraft((d) => ({ ...d, familia: e.target.value }))
              }
            />
            <Input
              placeholder="Activo (1/0)"
              value={draft.activo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, activo: e.target.value }))
              }
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={applyFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Aplicar búsqueda
            </Button>
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl bg-white" />
      ) : (
        <DataTable<Catalogo>
          columns={columns}
          data={data?.data ?? []}
          total={data?.total ?? 0}
          page={filters.page}
          size={filters.size}
          sorting={{ id: filters.sort, desc: filters.dir === "desc" }}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          onSizeChange={(s) => setFilters((f) => ({ ...f, size: s, page: 1 }))}
          onSortingChange={(sort, dir) =>
            setFilters((f) => ({ ...f, sort, dir, page: 1 }))
          }
          getRowId={(r) => String(r.id_producto)}
        />
      )}

      {error && (
        <Card className="rounded-2xl bg-rose-50 border-rose-200">
          <CardContent className="p-3 text-sm text-rose-700">
            {(error as any).message ?? "Error cargando catálogo"}
          </CardContent>
        </Card>
      )}

      {/* ---------------- Dialog Create/Edit ---------------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[640px] bg-white">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
            <Field label="Código *">
              <Input
                value={form.codigo}
                onChange={(e) =>
                  setForm((p) => ({ ...p, codigo: e.target.value }))
                }
              />
            </Field>

            <Field label="Código ZGEN">
              <Input
                value={form.codigo_zgen ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, codigo_zgen: e.target.value }))
                }
              />
            </Field>

            <Field label="Descripción *" className="md:col-span-2">
              <Input
                value={form.descripcion}
                onChange={(e) =>
                  setForm((p) => ({ ...p, descripcion: e.target.value }))
                }
              />
            </Field>

            <Field label="Unidad medida">
              <Input
                value={form.unidad_medida ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, unidad_medida: e.target.value }))
                }
              />
            </Field>

            <Field label="Familia">
              <Input
                value={form.familia ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, familia: e.target.value }))
                }
              />
            </Field>

            <Field label="Subfamilia">
              <Input
                value={form.subfamilia ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, subfamilia: e.target.value }))
                }
              />
            </Field>

            <Field label="Activo (true/false)">
              <Input
                value={String(form.activo)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    activo: e.target.value === "true",
                  }))
                }
              />
            </Field>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={onSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing
                ? updateMutation.isPending
                  ? "Guardando..."
                  : "Guardar cambios"
                : createMutation.isPending
                ? "Creando..."
                : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      {children}
    </div>
  );
}
