// src/app/(protected)/cenabast/page.tsx
// Panel de integración CENABAST

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  RefreshCw,
  Send,
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DatePickerField } from "@/components/filters/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useCenabastHealth,
  useCenabastAuth,
  useInformarStock,
  useInformarMovimiento,
  useReglasStock,
} from "@/hooks/use-cenabast";

const DEFAULT_ID_RELACION = Number(
  process.env.NEXT_PUBLIC_CENABAST_ID_RELACION ||
    process.env.CENABAST_ID_RELACION ||
    1
);

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any }> = {
    ok: { variant: "default", icon: CheckCircle2 },
    healthy: { variant: "default", icon: CheckCircle2 },
    warning: { variant: "secondary", icon: AlertTriangle },
    degraded: { variant: "secondary", icon: AlertTriangle },
    error: { variant: "destructive", icon: XCircle },
    unhealthy: { variant: "destructive", icon: XCircle },
    partial: { variant: "secondary", icon: AlertTriangle },
  };

  const c = config[status] || config.error;
  const Icon = c.icon;

  return (
    <Badge variant={c.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function TokenCountdown({ expiresAt }: { expiresAt: string }) {
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - Date.now();
  if (isNaN(diffMs)) return null;
  const minutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const label =
    hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;

  return <span>Quedan {label}</span>;
}

function RelationPill({ value }: { value: string }) {
  return (
    <div className="text-xs text-slate-600">
      <div className="font-semibold text-slate-800">Relación</div>
      <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sky-700 border border-sky-100 shadow-sm">
        <Server className="h-4 w-4" />
        {value}
      </div>
    </div>
  );
}

export default function CenabastPage() {
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useCenabastHealth();
  const auth = useCenabastAuth();
  const stock = useInformarStock();
  const movimiento = useInformarMovimiento();
  const reglas = useReglasStock();

  // Estado para informar stock
  const [stockForm, setStockForm] = useState({
    fecha: format(new Date(), "yyyy-MM-dd"),
    idRelacion: String(DEFAULT_ID_RELACION),
  });

  // Estado para informar movimiento
  const [movForm, setMovForm] = useState({
    fecha: format(new Date(), "yyyy-MM-dd"),
    idRelacion: String(DEFAULT_ID_RELACION),
    tipoMovimiento: "E" as "E" | "S",
    tipoCompra: "C" as "C" | "M",
  });

  // Estado para sincronizar reglas
  const [reglasForm, setReglasForm] = useState({
    rutSolicitante: process.env.NEXT_PUBLIC_CENABAST_RUT || "",
    idRelacion: String(DEFAULT_ID_RELACION),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Integración CENABAST
          </h1>
          <p className="text-sm text-slate-500">
            Gestión de comunicación con API CENABAST vía Mirth Connect
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchHealth()}
          disabled={healthLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${healthLoading ? "animate-spin" : ""}`} />
          Actualizar estado
        </Button>
      </div>

      {/* Estado general */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {healthLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <SectionCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-slate-500" />
                  <span className="font-medium">Base de datos</span>
                </div>
                <StatusBadge status={health?.components?.database?.status || "error"} />
              </div>
            </SectionCard>

            <SectionCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-slate-500" />
                  <span className="font-medium">Token CENABAST</span>
                </div>
                <StatusBadge status={health?.components?.cenabast_token?.status || "error"} />
              </div>
              {health?.components?.cenabast_token?.hours_remaining != null && (
                <p className="text-xs text-slate-500 mt-1">
                  Expira en {health.components.cenabast_token.hours_remaining}h
                </p>
              )}
            </SectionCard>

            <SectionCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-slate-500" />
                  <span className="font-medium">Mirth Connect</span>
                </div>
                <StatusBadge status={health?.components?.mirth?.overall || "error"} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {health?.components?.mirth?.host}
              </p>
            </SectionCard>

            <SectionCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-slate-500" />
                  <span className="font-medium">Estado general</span>
                </div>
                <StatusBadge status={health?.status || "error"} />
              </div>
            </SectionCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Autenticación */}
        <SectionCard title="Token CENABAST (Mirth)" className="bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-sky-100">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Estado del token</p>
                  <p className="text-xs text-slate-500">
                    {auth.status?.hasToken
                      ? auth.status.expiresAt
                        ? `Expira ${format(new Date(auth.status.expiresAt), "dd/MM/yyyy HH:mm", { locale: es })}`
                        : "Token vigente"
                      : "Se solicitará automáticamente al enviar a CENABAST"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => auth.requestToken()}
                  disabled={auth.isRequesting}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {auth.isRequesting ? "Solicitando..." : "Pedir a Mirth"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => auth.refresh()}
                  disabled={auth.isRefreshing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${auth.isRefreshing ? "animate-spin" : ""}`} />
                  Refrescar
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <StatusBadge
                status={
                  auth.status?.hasToken
                    ? auth.status.isExpired
                    ? "warning"
                    : "ok"
                    : "warning"
                }
              />
              {auth.status?.expiresAt && (
                <TokenCountdown expiresAt={auth.status.expiresAt} />
              )}
              {auth.status?.message && <span>{auth.status.message}</span>}
            </div>
            <p className="text-xs text-slate-500">
              Esta acción pide un token a Mirth y lo guarda para todos los envíos hacia CENABAST.
            </p>
          </div>
        </SectionCard>

        {/* Informar Stock */}
        <SectionCard title="Informar Stock a CENABAST" className="bg-gradient-to-br from-white via-sky-50 to-white border-slate-200 shadow-sm">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Fecha de stock</Label>
                <DatePickerField
                  value={stockForm.fecha}
                  onChange={(v) => setStockForm({ ...stockForm, fecha: v })}
                />
              </div>
              <RelationPill value={stockForm.idRelacion} />
            </div>

            <Button
              onClick={() =>
                stock.informar({
                  fecha_stock: stockForm.fecha,
                  id_relacion: Number(stockForm.idRelacion),
                })
              }
              disabled={stock.isLoading}
            >
              <Send className="mr-2 h-4 w-4" />
              {stock.isLoading ? "Enviando..." : "Enviar stock"}
            </Button>
            <p className="text-xs text-slate-500">
              Envia el stock consolidado de la fecha seleccionada a CENABAST a través de Mirth.
            </p>
          </div>
        </SectionCard>

        {/* Informar Movimientos */}
        <SectionCard title="Informar Movimientos a CENABAST" className="bg-gradient-to-br from-white via-emerald-50 to-white border-slate-200 shadow-sm">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Fecha</Label>
                <DatePickerField
                  value={movForm.fecha}
                  onChange={(v) => setMovForm({ ...movForm, fecha: v })}
                />
              </div>
              <RelationPill value={movForm.idRelacion} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tipo movimiento</Label>
                <Select
                  value={movForm.tipoMovimiento}
                  onValueChange={(v) => setMovForm({ ...movForm, tipoMovimiento: v as "E" | "S" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="E">Entrada</SelectItem>
                    <SelectItem value="S">Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo compra</Label>
                <Select
                  value={movForm.tipoCompra}
                  onValueChange={(v) => setMovForm({ ...movForm, tipoCompra: v as "C" | "M" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C">CENABAST</SelectItem>
                    <SelectItem value="M">Mercado Público</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() =>
                movimiento.informar({
                  fecha_movimiento: movForm.fecha,
                  id_relacion: Number(movForm.idRelacion),
                  tipo_movimiento: movForm.tipoMovimiento,
                  tipo_compra: movForm.tipoCompra,
                })
              }
              disabled={movimiento.isLoading}
            >
              <Send className="mr-2 h-4 w-4" />
              {movimiento.isLoading ? "Enviando..." : "Enviar movimientos"}
            </Button>
            <p className="text-xs text-slate-500">
              Toma los movimientos del día y los envía al canal de movimientos en Mirth para CENABAST.
            </p>
          </div>
        </SectionCard>

        {/* Sincronizar Reglas */}
        <SectionCard title="Sincronizar Reglas de Stock" className="bg-gradient-to-br from-white via-indigo-50 to-white border-slate-200 shadow-sm">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Envía las reglas de stock mínimo/máximo configuradas localmente a CENABAST.
            </p>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>RUT Solicitante</Label>
                <Input
                  placeholder="12345678-9"
                  value={reglasForm.rutSolicitante}
                  onChange={(e) => setReglasForm({ ...reglasForm, rutSolicitante: e.target.value })}
                />
              </div>
              <RelationPill value={reglasForm.idRelacion} />
            </div>

            <Button
              onClick={() =>
                reglas.syncReglas({
                  rutSolicitante: reglasForm.rutSolicitante,
                  idRelacion: Number(reglasForm.idRelacion),
                })
              }
              disabled={reglas.isSyncing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${reglas.isSyncing ? "animate-spin" : ""}`} />
              {reglas.isSyncing ? "Sincronizando..." : "Sincronizar reglas"}
            </Button>
            <p className="text-xs text-slate-500">
              Envía los niveles mínimos y máximos configurados localmente al canal de reglas en Mirth.
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Canales Mirth */}
      <SectionCard title="Estado de Canales Mirth">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {health?.components?.mirth?.channels &&
            Object.entries(health.components.mirth.channels).map(([name, info]) => (
              <div
                key={name}
                className="p-3 border rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="font-medium capitalize">{name}</p>
                  <p className="text-xs text-slate-500">Puerto {info.port}</p>
                </div>
                <StatusBadge status={info.status} />
              </div>
            ))}
        </div>
      </SectionCard>

      {/* Operaciones recientes */}
      {health?.components?.recent_operations?.length > 0 && (
        <SectionCard title="Operaciones Recientes">
          <div className="space-y-2">
            {health.components.recent_operations.map((op, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <div>
                  <p className="text-sm font-medium">{op.accion}</p>
                  <p className="text-xs text-slate-500">{op.detalle}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {format(new Date(op.fecha), "dd/MM HH:mm", { locale: es })}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
