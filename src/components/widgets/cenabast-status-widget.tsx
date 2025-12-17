// src/components/widgets/cenabast-status-widget.tsx
// Widget visual para mostrar estado de envíos a CENABAST

"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCenabastLogs } from "@/hooks/use-cenabast-logs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Send,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function CenabastStatusWidget() {
  const { data, isLoading } = useCenabastLogs({ size: 5 });

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-slate-200 shadow-lg">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats;
  const logs = data?.logs || [];

  const tasaExito =
    stats && stats.total_ejecuciones > 0
      ? Math.round((stats.completadas / stats.total_ejecuciones) * 100)
      : 0;

  const healthStatus =
    tasaExito >= 90 ? "healthy" : tasaExito >= 70 ? "warning" : "critical";

  return (
    <Card className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-purple-50/60 border-indigo-100 shadow-lg shadow-indigo-100/70 overflow-hidden">
      {/* Header compacto */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base">🚀 Envíos CENABAST</h3>
              <p className="text-[10px] text-indigo-100">Estado en tiempo real</p>
            </div>
          </div>
          <StatusIndicator status={healthStatus} />
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Estadísticas principales */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={CheckCircle2}
            label="Exitosos"
            value={stats?.completadas || 0}
            color="emerald"
          />
          <StatCard
            icon={XCircle}
            label="Fallidos"
            value={stats?.errores || 0}
            color="rose"
          />
          <StatCard
            icon={TrendingUp}
            label="Items"
            value={stats?.total_items_enviados || 0}
            color="blue"
          />
        </div>

        {/* Barra de progreso de tasa de éxito */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Tasa de éxito</span>
            <span className="font-semibold text-slate-900">{tasaExito}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthStatus === "healthy"
                  ? "bg-emerald-500"
                  : healthStatus === "warning"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${tasaExito}%` }}
            />
          </div>
        </div>

        {/* Últimas operaciones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700">
              Últimas operaciones
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {logs.length}
            </Badge>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay operaciones recientes</p>
              </div>
            ) : (
              logs.map((log) => <LogItem key={log.id} log={log} />)
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusIndicator({ status }: { status: "healthy" | "warning" | "critical" }) {
  const config = {
    healthy: {
      color: "bg-emerald-400",
      label: "Operativo",
      icon: CheckCircle2,
    },
    warning: {
      color: "bg-amber-400",
      label: "Advertencia",
      icon: AlertTriangle,
    },
    critical: {
      color: "bg-rose-400",
      label: "Crítico",
      icon: XCircle,
    },
  };

  const { color, label, icon: Icon } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`h-3 w-3 rounded-full ${color} animate-pulse`} />
        <div className={`absolute inset-0 h-3 w-3 rounded-full ${color} opacity-30 animate-ping`} />
      </div>
      <span className="text-xs font-medium text-white/90">{label}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: "emerald" | "rose" | "blue";
}) {
  const colors = {
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200",
    rose: "from-rose-50 to-rose-100 text-rose-700 border-rose-200",
    blue: "from-blue-50 to-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <div
      className={`p-2.5 rounded-xl border bg-gradient-to-br ${colors[color]} shadow-sm`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium opacity-80">{label}</span>
      </div>
      <div className="text-xl font-bold">
        {value.toLocaleString("es-CL")}
      </div>
    </div>
  );
}

function LogItem({ log }: { log: any }) {
  const isSuccess = log.estado === "COMPLETADO";
  const isError = log.estado === "ERROR";
  const isPending = log.estado === "PENDIENTE" || log.estado === "EJECUTANDO";

  const tipoLabel = {
    STOCK: "Stock",
    MOVIMIENTO_ENTRADA: "Entrada",
    MOVIMIENTO_SALIDA: "Salida",
    REGLAS: "Reglas",
  }[log.tipo] || log.tipo;

  const timeAgo = log.fecha_inicio
    ? formatDistanceToNow(new Date(log.fecha_inicio), {
        addSuffix: true,
        locale: es,
      })
    : "-";

  return (
    <div
      className={`p-2 rounded-lg border transition-all hover:shadow-sm ${
        isSuccess
          ? "bg-emerald-50/50 border-emerald-200"
          : isError
          ? "bg-rose-50/50 border-rose-200"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {isSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
            ) : isError ? (
              <XCircle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 animate-pulse" />
            )}
            <span className="text-xs font-medium text-slate-900 truncate">
              {tipoLabel}
            </span>
            <Badge
              variant={log.modo === "AUTOMATICO" ? "default" : "outline"}
              className="text-[9px] py-0 px-1.5 h-4"
            >
              {log.modo === "AUTOMATICO" ? "AUTO" : "MAN"}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span>{timeAgo}</span>
            {log.items_enviados > 0 && (
              <>
                <span>•</span>
                <span className="font-medium text-slate-700">
                  {log.items_enviados} items
                </span>
              </>
            )}
          </div>
        </div>

        <Badge
          variant={isSuccess ? "default" : isError ? "destructive" : "secondary"}
          className="text-[9px] flex-shrink-0 py-0 px-1.5 h-4"
        >
          {isSuccess ? "✓" : isError ? "✗" : "⋯"}
        </Badge>
      </div>
    </div>
  );
}
