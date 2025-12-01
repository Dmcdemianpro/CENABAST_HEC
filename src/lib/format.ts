import { format } from "date-fns";

export function fmtFecha(d?: string | Date | null) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "dd-MM-yyyy");
}

export function fmtNumero(n?: number | null) {
  if (n == null) return "-";
  return new Intl.NumberFormat("es-CL").format(n);
}
