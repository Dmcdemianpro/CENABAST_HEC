// src/hooks/use-stock-cenabast.ts
import { useQuery } from "@tanstack/react-query";

export interface StockCenabastItem {
  codigoInterno: string;
  codigoGenerico: number;
  cantidadStock: number;
  descripcionProducto?: string;
  fechaInformado?: string;
  codigoDespacho?: number;
}

export interface StockCenabastResponse {
  success: boolean;
  data?: {
    items?: StockCenabastItem[];
    total?: number;
    periodo?: string;
    [key: string]: any; // Para campos adicionales que CENABAST pueda devolver
  };
  consulta?: {
    solicitante: string;
    mes: number;
    anio: number;
    periodo: string;
  };
  error?: {
    tipo?: string;
    message: string;
    detalles?: string[];
    sugerencias?: string[];
  };
}

export interface UseStockCenabastParams {
  mes: number;
  anio: number;
  enabled?: boolean; // Permite habilitar/deshabilitar la query
}

/**
 * Hook para consultar el stock informado a CENABAST
 * @param params - Parámetros de consulta (mes, año)
 * @returns Query result con los datos del stock
 */
export function useStockCenabast(params: UseStockCenabastParams) {
  const { mes, anio, enabled = true } = params;

  return useQuery<StockCenabastResponse>({
    queryKey: ["cenabast-stock-consulta", mes, anio],
    queryFn: async () => {
      const response = await fetch(
        `/api/cenabast/stock/consultar?mes=${mes}&anio=${anio}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: { message: `Error HTTP ${response.status}` }
        }));
        throw new Error(errorData.error?.message || "Error consultando stock");
      }

      return response.json();
    },
    enabled: enabled && mes >= 1 && mes <= 12 && anio >= 2020,
    staleTime: 5 * 60 * 1000, // 5 minutos - datos de CENABAST no cambian muy seguido
    retry: 2,
  });
}

/**
 * Hook para obtener el período actual (mes/año actual)
 */
export function useCurrentPeriod() {
  const now = new Date();
  return {
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
  };
}
