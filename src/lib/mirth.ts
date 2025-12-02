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
  usuario: string;
  clave: string;
}): Promise<MirthResponse<{ token: string; expires_in: number }>> {
  return callMirth(MIRTH_CONFIG.ports.auth, "/cenabast/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export async function mirthRefreshToken(
  token: string
): Promise<MirthResponse<{ token: string }>> {
  return callMirth(MIRTH_CONFIG.ports.auth, "/cenabast/auth/refresh", {
    method: "POST",
    token,
  });
}

// ============================================================
// CANAL 002 - PRODUCTOS
// ============================================================

export async function mirthGetProductos(
  token: string,
  params?: { page?: number; size?: number }
): Promise<MirthResponse<any[]>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.size) qs.set("size", String(params.size));

  const path = `/cenabast/productos${qs.toString() ? `?${qs}` : ""}`;
  return callMirth(MIRTH_CONFIG.ports.productos, path, { token });
}

export async function mirthGetProductoById(
  token: string,
  id: string
): Promise<MirthResponse<any>> {
  return callMirth(MIRTH_CONFIG.ports.productos, `/cenabast/productos/${id}`, {
    token,
  });
}

// ============================================================
// CANAL 003 - STOCK
// ============================================================

export type StockDetalle = {
  codigo_interno: string;
  codigo_generico: string;
  cantidad: number;
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
  codigo_generico: string;
  cantidad: number;
  lote?: string;
  fecha_vencimiento?: string;
  rut_proveedor?: string;
  nro_factura?: string;
  nro_guia_despacho?: string;
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
  payload: InformarMovimientoPayload
): Promise<MirthResponse> {
  return callMirth(
    MIRTH_CONFIG.ports.movimiento,
    "/cenabast/movimiento/informar",
    {
      method: "POST",
      token,
      body: payload,
    }
  );
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
  const checks = await Promise.all([
    fetch(
      `http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.auth}/health`
    ).catch(() => null),
    fetch(
      `http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.productos}/health`
    ).catch(() => null),
    fetch(
      `http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.stock}/health`
    ).catch(() => null),
    fetch(
      `http://${MIRTH_CONFIG.host}:${MIRTH_CONFIG.ports.movimiento}/health`
    ).catch(() => null),
  ]);

  return {
    auth: checks[0]?.ok ?? false,
    productos: checks[1]?.ok ?? false,
    stock: checks[2]?.ok ?? false,
    movimiento: checks[3]?.ok ?? false,
  };
}
