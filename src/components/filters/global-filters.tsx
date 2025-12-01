"use client";

import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/filters/date-picker-field";

export function GlobalFilters({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <SectionCard
      title="Filtros globales"
      className="bg-white border-slate-200"
      right={
        <Button
          size="sm"
          onClick={() => onChange({ ...value, page: 1 })}
        >
          <Filter className="mr-2 h-4 w-4" />
          Aplicar
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <DatePickerField
          value={value.fechaDesde ?? ""}
          onChange={(v) => onChange({ ...value, fechaDesde: v, page: 1 })}
          placeholder="Fecha desde"
        />
        <DatePickerField
          value={value.fechaHasta ?? ""}
          onChange={(v) => onChange({ ...value, fechaHasta: v, page: 1 })}
          placeholder="Fecha hasta"
        />

        {[
          ["bodega", "Bodega"],
          ["comuna", "Comuna"],
          ["hospital", "Hospital"],
          ["codigo", "Código/Descripción"],
        ].map(([k, ph]) => (
          <Input
            key={k}
            placeholder={ph}
            value={value[k] ?? ""}
            onChange={(e) =>
              onChange({ ...value, [k]: e.target.value, page: 1 })
            }
            className="bg-white placeholder:text-slate-400 shadow-sm"
          />
        ))}
      </div>
    </SectionCard>
  );
}

