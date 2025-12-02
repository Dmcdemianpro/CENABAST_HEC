// src/app/(protected)/cenabast/page.tsx
// Panel de integración CENABAST

"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  RefreshCw,
  Send,
  Shield,
  Database,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
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

export default function CenabastPage() {
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useCenabastHealth();
  const auth = useCenabastAuth();
  const stock = useInformarStock();
  const movimiento = useInformarMovimiento();
  const reglas = useReglasStock();

  // Estado del formulario de autenticación
  const [authForm, setAuthForm] = useState({ usuario: "", clave: "" });

  // Estado para informar stock
  const [stockForm, setStockForm] = useState({
    fecha: format(new Date(), "yyyy-MM-dd"),
    idRelacion: "1",
  });

  // Estado para informar movimiento
  const [movForm, setMovForm] = useState({
    fecha: format(new Date(), "yyyy-MM-dd"),
    idRelacion: "1",
    tipoMovimiento: "E" as "E" | "S",
    tipoCompra: "C" as "C" | "M",
  });

  // Estado para sincronizar reglas
  const [reglasForm, setReglasForm] = useState({
    rutSolicitante: process.env.NEXT_PUBLIC_CENABAST_RUT || "",
    idRelacion: "1",
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
                  <Shield className="h-5 w-5 text-slate-500" />
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
        <SectionCard title="Autenticación CENABAST">
          <div className="space-y-4">
            {auth.status?.hasToken ? (
              <div className="p-3 bg-emerald-50 rounded-lg text-sm">
                <p className="font-medium text-emerald-800">Token activo</p>
                <p className="text-emerald-600">
                  Expira: {auth.status.expiresAt ? format(new Date(auth.status.expiresAt), "dd/MM/yyyy HH:mm", { locale: es }) : "N/A"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => auth.refresh()}
                  disabled={auth.isRefreshing}
                >
                  <RefreshCw className={`mr-2 h-3 w-3 ${auth.isRefreshing ? "animate-spin" : ""}`} />
                  Refrescar token
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Usuario CENABAST</Label>
                  <Input
                    placeholder="usuario@cenabast.cl"
                    value={authForm.usuario}
                    onChange={(e) => setAuthForm({ ...authForm, usuario: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Clave</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={authForm.clave}
                    onChange={(e) => setAuthForm({ ...authForm, clave: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() => auth.login(authForm)}
                  disabled={auth.isLoggingIn || !authForm.usuario || !authForm.clave}
                >
                  {auth.isLoggingIn ? "Autenticando..." : "Iniciar sesión"}
                </Button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Informar Stock */}
        <SectionCard title="Informar Stock a CENABAST">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de stock</Label>
                <DatePickerField
                  value={stockForm.fecha}
                  onChange={(v) => setStockForm({ ...stockForm, fecha: v })}
                />
              </div>
              <div>
                <Label>ID Relación</Label>
                <Input
                  type="number"
                  value={stockForm.idRelacion}
                  onChange={(e) => setStockForm({ ...stockForm, idRelacion: e.target.value })}
                />
              </div>
            </div>

            <Button
              onClick={() =>
                stock.informar({
                  fecha_stock: stockForm.fecha,
                  id_relacion: Number(stockForm.idRelacion),
                })
              }
              disabled={stock.isLoading || !auth.status?.hasToken}
            >
              <Send className="mr-2 h-4 w-4" />
              {stock.isLoading ? "Enviando..." : "Enviar stock"}
            </Button>

            {!auth.status?.hasToken && (
              <p className="text-xs text-amber-600">
                Configure credenciales primero
              </p>
            )}
          </div>
        </SectionCard>

        {/* Informar Movimientos */}
        <SectionCard title="Informar Movimientos a CENABAST">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha</Label>
                <DatePickerField
                  value={movForm.fecha}
                  onChange={(v) => setMovForm({ ...movForm, fecha: v })}
                />
              </div>
              <div>
                <Label>ID Relación</Label>
                <Input
                  type="number"
                  value={movForm.idRelacion}
                  onChange={(e) => setMovForm({ ...movForm, idRelacion: e.target.value })}
                />
              </div>
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
              disabled={movimiento.isLoading || !auth.status?.hasToken}
            >
              <Send className="mr-2 h-4 w-4" />
              {movimiento.isLoading ? "Enviando..." : "Enviar movimientos"}
            </Button>
          </div>
        </SectionCard>

        {/* Sincronizar Reglas */}
        <SectionCard title="Sincronizar Reglas de Stock">
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Envía las reglas de stock mínimo/máximo configuradas localmente a CENABAST.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RUT Solicitante</Label>
                <Input
                  placeholder="12345678-9"
                  value={reglasForm.rutSolicitante}
                  onChange={(e) => setReglasForm({ ...reglasForm, rutSolicitante: e.target.value })}
                />
              </div>
              <div>
                <Label>ID Relación</Label>
                <Input
                  type="number"
                  value={reglasForm.idRelacion}
                  onChange={(e) => setReglasForm({ ...reglasForm, idRelacion: e.target.value })}
                />
              </div>
            </div>

            <Button
              onClick={() =>
                reglas.syncReglas({
                  rutSolicitante: reglasForm.rutSolicitante,
                  idRelacion: Number(reglasForm.idRelacion),
                })
              }
              disabled={reglas.isSyncing || !auth.status?.hasToken}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${reglas.isSyncing ? "animate-spin" : ""}`} />
              {reglas.isSyncing ? "Sincronizando..." : "Sincronizar reglas"}
            </Button>
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
