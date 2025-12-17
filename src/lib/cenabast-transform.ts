/**
 * Funciones de transformación para datos CENABAST según especificación v1.9
 *
 * PROBLEMA RESUELTO:
 * - codigo_generico: debe ser int > 0, no puede ser 0
 * - rut_proveedor: debe ser int sin DV (ej: 96519830, no "96519830-K")
 * - nro_factura: debe ser int, no string
 * - nro_guia_despacho: debe ser int, no string
 * - codigo_despacho: si es 0, debe omitirse
 */

/**
 * Limpia un RUT eliminando puntos, guiones y dígito verificador
 *
 * @param rut - RUT en cualquier formato ("96.519.830-K", "96519830-K", "96519830", 96519830)
 * @returns RUT como número entero sin DV, o undefined si es inválido
 *
 * @example
 * limpiarRut("96.519.830-K") // 96519830
 * limpiarRut("96519830-K")   // 96519830
 * limpiarRut(96519830)       // 96519830
 * limpiarRut("11-101")       // 11 (RUT interno - muy corto, probablemente inválido)
 */
export function limpiarRut(rut: string | number | null | undefined): number | undefined {
  if (!rut) return undefined;

  // Convertir a string y limpiar
  const rutStr = String(rut);

  // Remover puntos y guiones, tomar solo la parte antes del guión (sin DV)
  const rutLimpio = rutStr
    .replace(/\./g, '')  // Quitar puntos
    .split('-')[0]       // Tomar solo parte antes del guión (sin DV)
    .trim();

  // Convertir a número
  const rutNum = parseInt(rutLimpio, 10);

  // Validar que sea un número válido y razonable (más de 1 millón)
  if (isNaN(rutNum) || rutNum < 1000000) {
    return undefined;
  }

  return rutNum;
}

/**
 * Convierte un valor a entero, eliminando cualquier carácter no numérico
 *
 * @param valor - Valor a convertir (string, number, null, undefined)
 * @returns Número entero o undefined si es inválido/vacío
 *
 * @example
 * toInt("698201")  // 698201
 * toInt(698201)    // 698201
 * toInt("0")       // undefined (0 se considera vacío)
 * toInt(null)      // undefined
 */
export function toInt(valor: string | number | null | undefined): number | undefined {
  if (valor === null || valor === undefined || valor === '') {
    return undefined;
  }

  // Si ya es número, validarlo
  if (typeof valor === 'number') {
    return valor === 0 ? undefined : Math.floor(valor);
  }

  // Limpiar string: solo dígitos
  const valorLimpio = String(valor).replace(/\D/g, '');

  if (valorLimpio === '') {
    return undefined;
  }

  const num = parseInt(valorLimpio, 10);

  // 0 se considera vacío
  return (isNaN(num) || num === 0) ? undefined : num;
}

/**
 * Convierte un string de código ZGEN a número entero
 * IMPORTANTE: codigo_generico NO puede ser 0, debe ser un código ZGEN válido
 *
 * @param codigoZgen - Código ZGEN (puede venir como "100000122" o 100000122)
 * @returns Código ZGEN como número, o 0 si es inválido (para mantener compatibilidad)
 *
 * @example
 * toCodigoGenerico("100000122") // 100000122
 * toCodigoGenerico(100000122)   // 100000122
 * toCodigoGenerico("0")         // 0 (marca como inválido)
 * toCodigoGenerico(null)        // 0 (marca como inválido)
 */
export function toCodigoGenerico(codigoZgen: string | number | null | undefined): number {
  if (!codigoZgen) return 0;

  if (typeof codigoZgen === 'number') {
    return Math.floor(codigoZgen);
  }

  const num = parseInt(String(codigoZgen), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Transforma un item de movimiento_detalle según especificación CENABAST v1.9
 *
 * Cambios aplicados:
 * - codigo_generico: convertido a int (TRY_CAST en SQL)
 * - rut_proveedor: limpiado (sin DV, sin puntos, como int)
 * - nro_factura: convertido a int
 * - nro_guia_despacho: convertido a int
 * - codigo_despacho: omitido si es 0
 * - Campos opcionales con undefined se omiten del JSON final
 *
 * @param item - Item del detalle desde la base de datos
 * @returns Item transformado según especificación CENABAST
 */
export function transformarItemMovimiento(item: any): any {
  const itemTransformado: any = {
    codigo_interno: String(item.codigo_interno || ''),
    codigo_generico: toCodigoGenerico(item.codigo_generico),
    cantidad: Number(item.cantidad) || 0,
  };

  // Campos opcionales - solo incluir si tienen valor válido

  // Lote
  if (item.lote && item.lote !== '') {
    itemTransformado.lote = String(item.lote);
  }

  // Fecha de vencimiento
  if (item.fecha_vencimiento) {
    itemTransformado.fecha_vencimiento = item.fecha_vencimiento;
  }

  // RUT proveedor (SIN dígito verificador, como int)
  const rutLimpio = limpiarRut(item.rut_proveedor);
  if (rutLimpio) {
    itemTransformado.rut_proveedor = rutLimpio;
  }

  // Número de factura (como int)
  const nroFactura = toInt(item.nro_factura || item.nro_doc);
  if (nroFactura) {
    itemTransformado.nro_factura = nroFactura;
  }

  // Número de guía de despacho (como int)
  const nroGuia = toInt(item.nro_guia_despacho);
  if (nroGuia) {
    itemTransformado.nro_guia_despacho = nroGuia;
  }

  // Código de despacho (omitir si es 0)
  const codigoDespacho = toInt(item.codigo_despacho);
  if (codigoDespacho) {
    itemTransformado.codigo_despacho = codigoDespacho;
  }

  // Código GTIN (opcional)
  if (item.codigo_gtin && item.codigo_gtin !== '') {
    itemTransformado.codigo_gtin = String(item.codigo_gtin);
  }

  return itemTransformado;
}

/**
 * Valida que un item de movimiento cumpla con las reglas CENABAST
 *
 * @param item - Item transformado
 * @returns Object con isValid y errors array
 */
export function validarItemMovimiento(item: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // codigo_generico es OBLIGATORIO y NO puede ser 0
  if (!item.codigo_generico || item.codigo_generico === 0) {
    errors.push(`Producto ${item.codigo_interno}: codigo_generico es obligatorio y no puede ser 0. Debe ser el código ZGEN de CENABAST.`);
  }

  // codigo_interno es obligatorio
  if (!item.codigo_interno || item.codigo_interno === '') {
    errors.push('codigo_interno es obligatorio');
  }

  // cantidad es obligatoria y debe ser > 0
  if (!item.cantidad || item.cantidad <= 0) {
    errors.push(`Producto ${item.codigo_interno}: cantidad debe ser mayor a 0`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Transforma el payload completo de movimiento según CENABAST v1.9
 *
 * @param movimientoData - Datos del movimiento
 * @returns Datos transformados listos para enviar a CENABAST
 */
export function transformarMovimientoParaCenabast(movimientoData: any): {
  data: any;
  errores: string[];
  warnings: string[];
} {
  const errores: string[] = [];
  const warnings: string[] = [];

  // Transformar cada item del detalle
  const detalleTransformado = movimientoData.movimiento_detalle.map((item: any) => {
    const itemTransformado = transformarItemMovimiento(item);

    // Validar
    const validacion = validarItemMovimiento(itemTransformado);
    if (!validacion.isValid) {
      errores.push(...validacion.errors);
    }

    // Warning si codigo_generico es 0
    if (itemTransformado.codigo_generico === 0) {
      warnings.push(`Producto ${itemTransformado.codigo_interno}: codigo_generico es 0. Este producto será rechazado por CENABAST.`);
    }

    return itemTransformado;
  });

  const dataTransformada = {
    id_relacion: Number(movimientoData.id_relacion),
    fecha_movimiento: movimientoData.fecha_movimiento,
    tipo_movimiento: movimientoData.tipo_movimiento,
    tipo_compra: movimientoData.tipo_compra,
    movimiento_detalle: detalleTransformado,
  };

  return {
    data: dataTransformada,
    errores,
    warnings,
  };
}
