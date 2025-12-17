"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockCenabast, useCurrentPeriod } from "@/hooks/use-stock-cenabast";
import { Search, RefreshCw, Calendar, Package, AlertCircle, CheckCircle2 } from "lucide-react";

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const ANIOS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

export function StockCenabastWidget() {
  const currentPeriod = useCurrentPeriod();
  const [mes, setMes] = useState(currentPeriod.mes);
  const [anio, setAnio] = useState(currentPeriod.anio);
  const [consultarEnabled, setConsultarEnabled] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useStockCenabast({
    mes,
    anio,
    enabled: consultarEnabled,
  });

  const handleConsultar = () => {
    setConsultarEnabled(true);
    refetch();
  };

  const stockItems = data?.data?.items || [];
  const totalItems = data?.data?.total || stockItems.length;

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-cyan-50/60 border-blue-100 shadow-lg shadow-blue-100/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-blue-600" />
          Stock en CENABAST
        </CardTitle>
        <CardDescription className="text-xs">
          Consulta el stock informado previamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros de Período - Compactos */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Mes</label>
            <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Año</label>
            <Select value={anio.toString()} onValueChange={(v) => setAnio(parseInt(v))}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANIOS.map((a) => (
                  <SelectItem key={a} value={a.toString()}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleConsultar}
              disabled={isLoading || isFetching}
              size="sm"
              className="h-9"
            >
              {isFetching ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Estado de Carga */}
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : "Error al consultar stock"}
            </AlertDescription>
          </Alert>
        )}

        {/* Error desde API */}
        {data?.error && !isLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">{data.error.message}</div>
              {data.error.detalles && data.error.detalles.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-sm">
                  {data.error.detalles.map((detalle, i) => (
                    <li key={i}>{detalle}</li>
                  ))}
                </ul>
              )}
              {data.error.sugerencias && data.error.sugerencias.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium text-sm">Sugerencias:</div>
                  <ul className="list-disc list-inside text-sm">
                    {data.error.sugerencias.map((sugerencia, i) => (
                      <li key={i}>{sugerencia}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Datos Exitosos */}
        {data?.success && !isLoading && (
          <>
            {/* Información del período - Compacta */}
            <div className="flex items-center justify-between p-2.5 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-xs font-semibold text-green-900 dark:text-green-100">
                    {data.consulta?.periodo || `${mes.toString().padStart(2, '0')}/${anio}`}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-gray-800 text-xs">
                {totalItems} prod.
              </Badge>
            </div>

            {/* Tabla de productos - Compacta */}
            {stockItems.length > 0 ? (
              <div className="rounded-md border max-h-[350px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-white dark:bg-gray-950 z-10">
                    <TableRow>
                      <TableHead className="text-xs py-2">Cód. Interno</TableHead>
                      <TableHead className="text-xs py-2">Cód. Gen.</TableHead>
                      <TableHead className="text-xs py-2">Descripción</TableHead>
                      <TableHead className="text-xs py-2 text-right">Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockItems.slice(0, 50).map((item: any, index: number) => (
                      <TableRow key={index} className="hover:bg-blue-50/50">
                        <TableCell className="font-mono text-xs py-2">
                          {item.codigoInterno || item.codigo_interno || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs py-2">
                          {item.codigoGenerico || item.codigo_generico || 0}
                        </TableCell>
                        <TableCell className="text-xs py-2 max-w-[200px] truncate">
                          {item.descripcionProducto || item.descripcion_producto || 'Sin descripción'}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right font-semibold">
                          {(item.cantidadStock || item.cantidad_stock || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  No se encontraron productos informados para este período.
                  <br />
                  <span className="text-sm text-muted-foreground">
                    Intenta con otro mes/año o verifica que hayas informado stock previamente.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Nota si hay más productos */}
            {stockItems.length > 50 && (
              <div className="text-xs text-center text-muted-foreground">
                Mostrando 50 de {totalItems} productos
              </div>
            )}
          </>
        )}

        {/* Estado inicial */}
        {!data && !isLoading && !error && (
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Selecciona un período y haz clic en <strong>Consultar</strong> para ver el stock informado a CENABAST.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
