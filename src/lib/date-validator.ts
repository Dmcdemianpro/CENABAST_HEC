// src/lib/date-validator.ts
// Validación y sanitización de fechas para SQL Server

/**
 * Rango válido de fechas para SQL Server DATETIME
 * SQL Server: 1753-01-01 00:00:00 a 9999-12-31 23:59:59
 */
const SQL_MIN_DATE = new Date('1753-01-01');
const SQL_MAX_DATE = new Date('9999-12-31');

/**
 * Valida si una fecha está dentro del rango permitido por SQL Server
 */
export function isValidSqlDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;

  const d = typeof date === 'string' ? new Date(date) : date;

  // Verificar si es una fecha válida
  if (isNaN(d.getTime())) return false;

  // Verificar rango SQL Server
  return d >= SQL_MIN_DATE && d <= SQL_MAX_DATE;
}

/**
 * Convierte una fecha a formato YYYY-MM-DD validando que sea válida para SQL
 * @returns fecha en formato YYYY-MM-DD o null si es inválida
 */
export function toSqlDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;

  // Si viene como string YYYY-MM-DD, parsear sin zona horaria para evitar desfases de un día
  if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [_, y, mo, da] = m;
      const year = Number(y);
      const month = Number(mo);
      const day = Number(da);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (isNaN(parsed.getTime())) return null;
      return `${y}-${mo}-${da}`;
    }
  }

  const d = typeof date === 'string' ? new Date(date) : date;

  if (!isValidSqlDate(d)) return null;

  // Formato YYYY-MM-DD (usando UTC para evitar desfases por zona horaria)
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Sanitiza una fecha: si es válida retorna formato YYYY-MM-DD, si no retorna undefined
 * Útil para campos opcionales que no deben enviarse si son inválidos
 */
export function sanitizeSqlDate(date: Date | string | null | undefined): string | undefined {
  const sqlDate = toSqlDate(date);
  return sqlDate || undefined;
}

/**
 * Valida formato de fecha string YYYY-MM-DD
 */
export function isValidDateFormat(dateStr: string): boolean {
  if (!dateStr) return false;

  // Verificar formato YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  // Verificar que sea una fecha válida
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    isValidSqlDate(date)
  );
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD válido para SQL
 */
export function getCurrentSqlDate(): string {
  return toSqlDate(new Date()) || new Date().toISOString().split('T')[0];
}

/**
 * Valida y sanitiza un objeto completo reemplazando fechas inválidas
 */
export function sanitizeDateFields<T extends Record<string, any>>(
  obj: T,
  dateFields: (keyof T)[]
): T {
  const sanitized = { ...obj };

  for (const field of dateFields) {
    const value = sanitized[field];

    if (value !== null && value !== undefined) {
      const sanitizedDate = sanitizeSqlDate(value as any);

      if (sanitizedDate) {
        sanitized[field] = sanitizedDate as any;
      } else {
        // Eliminar el campo si la fecha es inválida
        delete sanitized[field];
      }
    }
  }

  return sanitized;
}

/**
 * Información de diagnóstico para errores de fecha
 */
export function getDateDiagnostic(date: any): {
  value: any;
  type: string;
  isValid: boolean;
  reason?: string;
} {
  if (date === null) {
    return { value: null, type: 'null', isValid: false, reason: 'Fecha es null' };
  }

  if (date === undefined) {
    return { value: undefined, type: 'undefined', isValid: false, reason: 'Fecha es undefined' };
  }

  if (typeof date === 'string') {
    if (!date.trim()) {
      return { value: date, type: 'string', isValid: false, reason: 'String vacío' };
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return { value: date, type: 'string', isValid: false, reason: 'No se puede parsear como fecha' };
    }

    if (d < SQL_MIN_DATE) {
      return { value: date, type: 'string', isValid: false, reason: `Fecha menor a ${SQL_MIN_DATE.toISOString()}` };
    }

    if (d > SQL_MAX_DATE) {
      return { value: date, type: 'string', isValid: false, reason: `Fecha mayor a ${SQL_MAX_DATE.toISOString()}` };
    }

    return { value: date, type: 'string', isValid: true };
  }

  if (date instanceof Date) {
    if (isNaN(date.getTime())) {
      return { value: date, type: 'Date', isValid: false, reason: 'Fecha inválida' };
    }

    if (date < SQL_MIN_DATE) {
      return { value: date, type: 'Date', isValid: false, reason: `Fecha menor a ${SQL_MIN_DATE.toISOString()}` };
    }

    if (date > SQL_MAX_DATE) {
      return { value: date, type: 'Date', isValid: false, reason: `Fecha mayor a ${SQL_MAX_DATE.toISOString()}` };
    }

    return { value: date, type: 'Date', isValid: true };
  }

  return { value: date, type: typeof date, isValid: false, reason: 'Tipo no soportado' };
}
