import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional().nullable(),
  dir: z.enum(["asc", "desc"]).optional().nullable(),
});

export const existenciasFiltersSchema = z.object({
  fechaDesde: z.string().optional().nullable(),
  fechaHasta: z.string().optional().nullable(),
  comuna: z.string().optional().nullable(),
  hospital: z.string().optional().nullable(),
  bodega: z.string().optional().nullable(),
  codigo: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  soloConExistencia: z.coerce.boolean().optional().nullable(),
}).merge(paginationSchema);

export const movimientosFiltersSchema = z.object({
  fechaDesde: z.string().optional().nullable(),
  fechaHasta: z.string().optional().nullable(),
  bodega: z.string().optional().nullable(),
  tipoDocumento: z.string().optional().nullable(),
  rut: z.string().optional().nullable(),
  nombre: z.string().optional().nullable(),
  codigo: z.string().optional().nullable(),
  numero_lote: z.string().optional().nullable(),
  vencDesde: z.string().optional().nullable(),
  vencHasta: z.string().optional().nullable(),
}).merge(paginationSchema);

export const batchExistenciasSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int(),
    stock_minimo: z.number().min(0).optional(),
    stock_critico: z.number().min(0).optional(),
    stock_maximo: z.number().min(0).optional(),
  })).min(1),
}).superRefine((val, ctx) => {
  for (const u of val.updates) {
    // todos los campos opcionales, pero si se envían, respetar orden
    if (
      u.stock_minimo != null &&
      u.stock_critico != null &&
      u.stock_maximo != null &&
      !(u.stock_minimo <= u.stock_critico && u.stock_critico <= u.stock_maximo)
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Regla stock_minimo <= stock_critico <= stock_maximo incumplida (id ${u.id})`,
      });
    }
    if (
      u.stock_minimo == null &&
      u.stock_critico == null &&
      u.stock_maximo == null
    ) {
      ctx.addIssue({
        code: "custom",
        message: `Debe enviar al menos un valor para actualizar (id ${u.id})`,
      });
    }
  }
});

export const catalogoSchema = z.object({
  codigo: z.string().min(1).max(50),
  codigo_zgen: z.string().max(50).optional().nullable(),
  descripcion: z.string().min(1).max(255),
  unidad_medida: z.string().max(50).optional().nullable(),
  familia: z.string().max(100).optional().nullable(),
  subfamilia: z.string().max(100).optional().nullable(),
  activo: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(3),
});
