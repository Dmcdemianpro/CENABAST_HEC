export type Existencia = {
  id: number;
  fechaCorte: string;
  comuna: string | null;
  hospital: string | null;
  bodega: number | string;
  codigo: string;
  codigo_zgen: string | null;
  descripcion: string;
  existencia: number;
  stock_minimo: number;
  stock_critico: number;
  stock_maximo: number;
  fechaCarga: string;
};

export type Movimiento = {
  id_movimiento: number;
  fecha_registro: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  bodega: number | string;
  tipoDocumento: string | null;
  numero: string | null;
  fechaMovimiento: string;
  rut: string | null;
  nombre: string | null;
  codigo: string;
  codigo_zgen: string | null;
  descripcion: string | null;
  numero_lote: string | null;
  vencimiento: string | null;
  cantidad: number;
};

export type CatalogoProducto = {
  id_producto: number;
  codigo: string;
  codigo_zgen: string | null;
  descripcion: string;
  unidad_medida: string | null;
  familia: string | null;
  subfamilia: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualiza: string | null;
  usuario_actualiza: string | null;
};

export type Paged<T> = { data: T[]; total: number; page: number; size: number; };
