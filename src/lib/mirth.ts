// src/lib/mirth.ts
// Configuración y cliente para comunicación con Mirth Connect

export const MIRTH_CONFIG = {
  host: process.env.MIRTH_HOST || "10.7.71.64",
  ports: {
    auth: 6661,
    productos: 6662,
    stock: 6663,
    movimiento: 6664,
  },
  // Token JWT de CENABAST (se obtiene del canal 001)
  // En producción, esto debería manejarse con un sistema de refresh
  jwtToken: process.env.CENABAST_JWT_TOKEN || "",
};

type MirthResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
};

/**
 * Cliente genérico para llamar a los canales de Mirth
 */
async function callMirth<T = any>(
  port: number,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: any;
    token?: string;
    timeout?: number;
  } = {}
): Promise<MirthResponse<T>> {
  const { method = "GET", body, token, timeout = 30000 } = options;
  const url = `http://${MIRTH_CONFIG.host}:${port}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: data?.error || data?.message || `HTTP ${res.status}`,
        statusCode: res.status,
      };
    }

    return {
      success: true,
      data,
      statusCode: res.status,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      return { success: false, error: "Timeout: Mirth no respondió" };
    }

    return {
      success: false,
      error: err.message || "Error de conexión con Mirth",
    };
  }
}

// ============================================================
// CANAL 001 - AUTENTICACIÓN
// ============================================================

export async function mirthAuth(credentials: {
  user: string;
  password: string;
}): Promise<MirthResponse<{ token: string; expires_in: number }>> {
  return callMirth(MIRTH_CONFIG.ports.auth, "/cenabast/auth", {
    method: "POST",
    body: credentials,
  });
}

export async function mirthRefreshToken(
  token: string
): Promise<MirthResponse<{ token: string }>> {
  return callMirth(MIRTH_CONFIG.ports.auth, "/cenabast/auth", {
    method: "POST",
    token,
  });
}

// ============================================================
// CANAL 002 - PRODUCTOS
// ============================================================

export async function mirthGetProductosPaginados(
  token: string,
  params?: { paginaActual?: number; elementosPorPagina?: number }
): Promise<MirthResponse<any[]>> {
  const qs = new URLSearchParams();
  if (params?.paginaActual) qs.set("paginaActual", String(params.paginaActual));
  if (params?.elementosPorPagina)
    qs.set("elementosPorPagina", String(params.elementosPorPagina));

  const path = `/cenabast/productos/paginados${
    qs.toString() ? `?${qs}` : ""
  }`;
  return callMirth(MIRTH_CONFIG.ports.productos, path, { token });
}

export async function mirthBuscarProductoPorNombre(
  token: string,
  nombre_producto: string
): Promise<MirthResponse<any>> {
  const qs = new URLSearchParams({
    nombre_producto,
  });
  return callMirth(
    MIRTH_CONFIG.ports.productos,
    `/cenabast/producto?${qs.toString()}`,
    { token }
  );
}

export async function mirthBuscarProductoPorCodigo(
  token: string,
  codigo_producto: string | number
): Promise<MirthResponse<any>> {
  const qs = new URLSearchParams({
    codigo_producto: String(codigo_producto),
  });
  return callMirth(
    MIRTH_CONFIG.ports.productos,
    `/cenabast/producto?${qs.toString()}`,
    { token }
  );
}

export async function mirthGetDestinatarios(
  token: string,
  solicitante: string
): Promise<MirthResponse<any>> {
  const qs = new URLSearchParams({ solicitante });
  return callMirth(
    MIRTH_CONFIG.ports.productos,
    `/cenabast/destinatarios?${qs.toString()}`,
    { token }
  );
}

// ============================================================
// CANAL 003 - STOCK
// ============================================================

export type StockDetalle = {
  codigo_interno: string;
  codigo_generico: number;
  cantidad_stock: number;
  codigo_despacho: number;
  codigo_gtin?: string;
  codigo_interno_despacho?: string;
  rut_proveedor?: string;
  descripcion_producto?: string;
  descripcion_marca_comercial?: string;
  pedido_compra_cenabast?: string;
};

export type InformarStockPayload = {
  id_relacion: number;
  fecha_stock: string; // YYYY-MM-DD
  stock_detalle: StockDetalle[];
};

/**
 * POST /v1/stock - Informar stock consolidado a CENABAST
 */
export async function mirthInformarStock(
  token: string,
  payload: InformarStockPayload
): Promise<MirthResponse> {
  return callMirth(MIRTH_CONFIG.ports.stock, "/cenabast/stock/informar", {
    method: "POST",
    token,
    body: payload,
  });
}

/**
 * GET /v1/stock/consulta/{solicitante}/{mes}-{anio}
 */
export async function mirthConsultarStock(
  token: string,
  params: { solicitante: string; mes: number; anio: number }
): Promise<MirthResponse> {
  const qs = new URLSearchParams({
    solicitante: params.solicitante,
    mes: String(params.mes),
    anio: String(params.anio),
  });
  return callMirth(
    MIRTH_CONFIG.ports.stock,
    `/cenabast/stock/consulta?${qs}`,
    { token }
  );
}

export type ReglaStock = {
  RutSolicitante: string;
  IdRelacion: number;
  CodigoProducto: string;
  StockMinimo: number;
  StockMaximo: number;
};

/**
 * POST /v1/stock/reglas - Configurar reglas min/max
 */
export async function mirthSetReglasStock(
  token: string,
  reglas: ReglaStock[]
): Promise<MirthResponse> {
  return callMirth(MIRTH_CONFIG.ports.stock, "/cenabast/stock/reglas", {
    method: "POST",
    token,
    body: reglas,
  });
}

/**
 * GET /v1/stock/reglas/{solicitante}/{idRelacion}/{codigoProducto}
 */
export async function mirthGetReglasStock(
  token: string,
  params: { solicitante: string; idRelacion: number; codigoProducto: string }
): Promise<MirthResponse> {
  const qs = new URLSearchParams({
    solicitante: params.solicitante,
    idRelacion: String(params.idRelacion),
    codigoProducto: params.codigoProducto,
  });
  return callMirth(MIRTH_CONFIG.ports.stock, `/cenabast/stock/reglas?${qs}`, {
    token,
  });
}

// ============================================================
// CANAL 004 - MOVIMIENTOS
// ============================================================

export type MovimientoDetalle = {
  codigo_interno: string;
  codigo_generico: number;
  cantidad: number;
  lote?: string;
  fecha_vencimiento?: string;
  rut_proveedor?: string;
  nro_factura?: string;
  nro_guia_despacho?: string;
  codigo_despacho: number;
};

export type InformarMovimientoPayload = {
  id_relacion: number;
  fecha_movimiento: string; // YYYY-MM-DD
  tipo_movimiento: "E" | "S"; // Entrada o Salida
  tipo_compra: "C" | "M"; // CENABAST o Mercado Público
  movimiento_detalle: MovimientoDetalle[];
};

/**
 * POST /v1/movimiento - Informar movimientos a CENABAST
 */
export async function mirthInformarMovimiento(
  token: string,
  movimientoData: {
    id_relacion: number;
    fecha_movimiento: string;
    tipo_movimiento: string;
    tipo_compra: string;
    movimiento_detalle: MovimientoDetalle[];
  }
): Promise<any> {
  const url = `http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.movimiento}/cenabast/movimiento`;

  const bodyString = JSON.stringify(movimientoData);

  console.log("[MIRTH] URL:", url);
  console.log("[MIRTH] Body:", bodyString);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: bodyString,
  });

  const responseText = await response.text();
  console.log("[MIRTH] Response status:", response.status);
  console.log("[MIRTH] Response body:", responseText);

  if (!response.ok) {
    throw new Error(`Error Mirth ${response.status}: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { message: responseText };
  }
}

/**
 * GET /v1/movimiento/consulta/{solicitante}/{mes}-{anio}
 */
export async function mirthConsultarMovimientos(
  token: string,
  params: { solicitante: string; mes: number; anio: number }
): Promise<MirthResponse> {
  const qs = new URLSearchParams({
    solicitante: params.solicitante,
    mes: String(params.mes),
    anio: String(params.anio),
  });
  return callMirth(
    MIRTH_CONFIG.ports.movimiento,
    `/cenabast/movimiento/consulta?${qs}`,
    { token }
  );
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Verifica si Mirth está disponible
 */
export async function checkMirthHealth(): Promise<{
  auth: boolean;
  productos: boolean;
  stock: boolean;
  movimiento: boolean;
}> {
  const solicitante =
    process.env.NEXT_PUBLIC_CENABAST_RUT ||
    process.env.CENABAST_RUT_SOLICITANTE ||
    "61980320";
  const checks = await Promise.all([
    fetch(`http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.auth}/cenabast/auth`).catch(() => null),
    fetch(`http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.productos}/cenabast/productos/paginados?paginaActual=1&elementosPorPagina=1`).catch(() => null),
    fetch(`http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.stock}/cenabast/stock/consulta?solicitante=${solicitante}&mes=12&anio=2025`).catch(() => null),
    fetch(`http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.movimiento}/cenabast/movimiento`).catch(() => null),
  ]);

  return {
    auth: checks[0]?.ok ?? false,
    productos: checks[1]?.ok ?? false,
    stock: checks[2]?.ok ?? false,
    movimiento: checks[3]?.ok ?? false,
  };
}
