// src/lib/mirth-error-handler.ts
// Manejo centralizado de errores de respuestas Mirth/CENABAST

export interface MirthErrorResponse {
  statusCode: number;
  isSuccessful: boolean;
  result: any;
  errorMessage: string;
}

export interface ParsedMirthError {
  tipo: string;
  mensaje: string;
  detalles: string[];
  sugerencias: string[];
  esRecuperable: boolean;
  datosOriginales?: any;
}

/**
 * Parsea errores comunes de SQL Server en respuestas de Mirth
 */
export function parseMirthError(response: any): ParsedMirthError {
  const errorMsg = response?.errorMessage || response?.error || response?.message || '';

  // Error: SqlDateTime overflow
  if (errorMsg.includes('SqlDateTime overflow')) {
    return {
      tipo: 'FECHA_INVALIDA',
      mensaje: 'Una o más fechas son inválidas para SQL Server',
      detalles: [
        'SQL Server solo acepta fechas entre 1753-01-01 y 9999-12-31',
        'Fechas NULL o vacías causan este error',
        'Verifique campos: fecha_stock, fecha_movimiento, fecha_vencimiento',
      ],
      sugerencias: [
        'Revise que todas las fechas estén en formato YYYY-MM-DD',
        'Elimine o reemplace fechas NULL con valores válidos',
        'Use fechas dentro del rango válido de SQL Server',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error: Foreign key violation
  if (errorMsg.includes('FOREIGN KEY') || errorMsg.includes('FK_')) {
    return {
      tipo: 'RELACION_INVALIDA',
      mensaje: 'Error de relación con otra tabla (Foreign Key)',
      detalles: [
        'Un ID de referencia no existe en la tabla relacionada',
        'Verifique: id_relacion, codigo_producto, etc.',
      ],
      sugerencias: [
        'Verifique que el id_relacion exista en CENABAST',
        'Confirme que los códigos de producto sean válidos',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error: Null value not allowed
  if (errorMsg.includes('Cannot insert NULL') || errorMsg.includes('does not allow nulls')) {
    return {
      tipo: 'CAMPO_REQUERIDO_NULL',
      mensaje: 'Faltan campos obligatorios',
      detalles: [
        'Se intentó insertar NULL en un campo requerido',
        extractFieldName(errorMsg),
      ].filter(Boolean),
      sugerencias: [
        'Verifique que todos los campos obligatorios tengan valor',
        'Revise la estructura del payload según la guía CENABAST',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error: Conversion failed
  if (errorMsg.includes('Conversion failed') || errorMsg.includes('convert')) {
    return {
      tipo: 'CONVERSION_TIPO_DATOS',
      mensaje: 'Error al convertir tipos de datos',
      detalles: [
        'Un campo tiene un tipo de dato incorrecto',
        extractFieldName(errorMsg),
      ].filter(Boolean),
      sugerencias: [
        'Verifique que los números sean numéricos (no strings)',
        'Asegúrese que las fechas estén en formato correcto',
        'Revise campos como cantidad_stock, codigo_generico',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error: Timeout
  if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
    return {
      tipo: 'TIMEOUT',
      mensaje: 'Tiempo de espera agotado',
      detalles: [
        'La operación tardó demasiado tiempo',
        'El servidor Mirth/CENABAST no respondió a tiempo',
      ],
      sugerencias: [
        'Intente enviar menos registros por lote',
        'Verifique la conectividad con el servidor Mirth',
        'Reintente la operación',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error: Unauthorized (401)
  if (response?.statusCode === 401 || errorMsg.includes('Unauthorized') || errorMsg.includes('token')) {
    return {
      tipo: 'NO_AUTORIZADO',
      mensaje: 'Token de autenticación inválido o expirado',
      detalles: [
        'El token JWT ha expirado o es inválido',
        'Es necesario obtener un nuevo token',
      ],
      sugerencias: [
        'El sistema obtendrá un nuevo token automáticamente',
        'Si el problema persiste, verifique las credenciales CENABAST',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error: Not Found (404)
  if (response?.statusCode === 404) {
    return {
      tipo: 'NO_ENCONTRADO',
      mensaje: 'Recurso no encontrado',
      detalles: [
        'El endpoint o recurso solicitado no existe',
        'Verifique la configuración de Mirth',
      ],
      sugerencias: [
        'Verifique que los canales de Mirth estén activos',
        'Confirme la configuración de puertos y rutas',
      ],
      esRecuperable: false,
      datosOriginales: response,
    };
  }

  // Error: Internal Server Error (500)
  if (response?.statusCode === 500) {
    return {
      tipo: 'ERROR_SERVIDOR',
      mensaje: 'Error interno del servidor CENABAST/Mirth',
      detalles: [
        'Error en el procesamiento del lado del servidor',
        errorMsg.substring(0, 200), // Primeros 200 caracteres
      ],
      sugerencias: [
        'Revise los logs del servidor Mirth para más detalles',
        'Verifique la estructura del payload',
        'Contacte soporte CENABAST si el error persiste',
      ],
      esRecuperable: true,
      datosOriginales: response,
    };
  }

  // Error genérico
  return {
    tipo: 'ERROR_DESCONOCIDO',
    mensaje: errorMsg || 'Error desconocido al comunicarse con CENABAST',
    detalles: [
      `Status Code: ${response?.statusCode || 'N/A'}`,
      `isSuccessful: ${response?.isSuccessful || false}`,
    ],
    sugerencias: [
      'Revise los logs para más información',
      'Verifique la estructura del payload',
    ],
    esRecuperable: false,
    datosOriginales: response,
  };
}

/**
 * Extrae el nombre del campo del mensaje de error si es posible
 */
function extractFieldName(errorMsg: string): string | null {
  // Intentar extraer nombre de columna de mensajes como:
  // "Cannot insert NULL into column 'fecha_stock'"
  const columnMatch = errorMsg.match(/column ['"]?(\w+)['"]?/i);
  if (columnMatch) {
    return `Campo afectado: ${columnMatch[1]}`;
  }

  // Intentar extraer de mensajes de conversión
  const convertMatch = errorMsg.match(/converting.*to ['"]?(\w+)['"]?/i);
  if (convertMatch) {
    return `Tipo de dato esperado: ${convertMatch[1]}`;
  }

  return null;
}

/**
 * Formatea un error parseado para mostrar al usuario
 */
export function formatMirthErrorForUser(parsed: ParsedMirthError): string {
  let msg = `❌ ${parsed.mensaje}\n\n`;

  if (parsed.detalles.length > 0) {
    msg += `📋 Detalles:\n`;
    parsed.detalles.forEach((d) => {
      msg += `  • ${d}\n`;
    });
    msg += '\n';
  }

  if (parsed.sugerencias.length > 0) {
    msg += `💡 Sugerencias:\n`;
    parsed.sugerencias.forEach((s) => {
      msg += `  • ${s}\n`;
    });
  }

  return msg;
}

/**
 * Formatea un error parseado para logs del servidor
 */
export function formatMirthErrorForLog(parsed: ParsedMirthError): string {
  return JSON.stringify(
    {
      tipo: parsed.tipo,
      mensaje: parsed.mensaje,
      detalles: parsed.detalles,
      esRecuperable: parsed.esRecuperable,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  );
}

/**
 * Verifica si un error de Mirth es recuperable (se puede reintentar)
 */
export function isMirthErrorRecoverable(response: any): boolean {
  const parsed = parseMirthError(response);
  return parsed.esRecuperable;
}
