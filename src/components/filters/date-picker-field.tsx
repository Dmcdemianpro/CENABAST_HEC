"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  value?: string; // "yyyy-MM-dd"
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
};

export function DatePickerField({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  clearable = true,
}: Props) {
  // Parseamos en hora local para evitar desfasajes de UTC (ej. mostrar 02/12 y enviar 03/12)
  const date = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={cn("relative w-full", className)}>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-white border-slate-200 hover:bg-slate-50 text-slate-900",
              !date && "text-slate-400"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
            {date ? format(date, "dd-MM-yyyy", { locale: es }) : placeholder}
          </Button>

          {clearable && date && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Limpiar fecha"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="z-50 w-auto p-2 bg-white border border-slate-200 shadow-xl rounded-lg"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          initialFocus
          locale={es}
          className="bg-white rounded-md"
        />
      </PopoverContent>
    </Popover>
  );
}
