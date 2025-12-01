import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportCSV<T extends object>(rows: T[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${filename}.csv`);
}

export function exportExcel<T extends object>(rows: T[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDF<T extends object>(rows: T[], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const cols = Object.keys(rows[0] ?? {});
  const body = rows.map(r => cols.map(c => String((r as any)[c] ?? "")));

  (doc as any).autoTable({ head: [cols], body });
  doc.save(`${filename}.pdf`);
}
