"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  size,
  sorting,
  rowSelection,
  onPageChange,
  onSizeChange,
  onSortingChange,
  onRowSelectionChange,
  getRowId,
  meta,
}: {
  columns: ColumnDef<T, any>[];
  data: T[];
  total: number;
  page: number;
  size: number;
  sorting: { id: string; desc: boolean };
  rowSelection?: RowSelectionState;
  onPageChange: (p: number) => void;
  onSizeChange: (s: number) => void;
  onSortingChange: (sort: string, dir: "asc" | "desc") => void;
  onRowSelectionChange?: (s: RowSelectionState) => void;
  getRowId: (row: T) => string;
  meta?: any;
}) {
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const selectionState = rowSelection ?? internalRowSelection;
  const sortingState: SortingState = [{ id: sorting.id, desc: sorting.desc }];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(total / size),
    state: {
      sorting: sortingState,
      rowSelection: selectionState,
    },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(selectionState) : updater;
      if (onRowSelectionChange) onRowSelectionChange(next);
      else setInternalRowSelection(next);
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sortingState) : updater;
      const s = next[0];
      if (!s) return;
      onSortingChange(String(s.id), s.desc ? "desc" : "asc");
    },
    getRowId,
    enableRowSelection: true,
    meta,
  });

  const pageCount = table.getPageCount();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" && " ▲"}
                    {h.column.getIsSorted() === "desc" && " ▼"}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="px-3 py-2 align-middle">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-white">
        <div className="text-xs text-slate-500">
          Página {page} de {pageCount} • Total {total}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="border border-slate-200 rounded-md px-2 py-1 text-sm"
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((s) => (
              <option key={s} value={s}>{s}/pág</option>
            ))}
          </select>

          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
