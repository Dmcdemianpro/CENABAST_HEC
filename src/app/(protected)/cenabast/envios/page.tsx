// src/app/(protected)/cenabast/envios/page.tsx
// Dashboard de envíos automáticos CENABAST

"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Settings,
  Zap,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sliders,
} from "lucide-react";

import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  useSchedulerTareas,
  useSchedulerLogs,
  useCrearTarea,
  useActualizarTarea,
  useEliminarTarea,
  useToggleTarea,
  useEjecutarTarea,
  useEjecutarPendientes,
  useLimpiarLogs,
  TIPO_TAREA_LABELS,
  ESTADO_LABELS,
  formatDiasSemana,
  type TipoTarea,
  type EstadoEjecucion,
  type ModoEjecucion,
  type TareaProgramada,
  type LogsFilters,
} from "@/hooks/use-cenabast-scheduler";

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  color?: "blue" | "green" | "red" | "amber" | "slate";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-50 text-slate-600",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TipoTareaIcon({ tipo }: { tipo: TipoTarea }) {
  const icons: Record<TipoTarea, any> = {
    STOCK: Package,
    MOVIMIENTO_ENTRADA: ArrowDownToLine,
    MOVIMIENTO_SALIDA: ArrowUpFromLine,
    REGLAS: Sliders,
  };
  const Icon = icons[tipo] || Package;
  return <Icon className="h-4 w-4" />;
}

function EstadoBadge({ estado }: { estado: string }) {
  const config = ESTADO_LABELS[estado as keyof typeof ESTADO_LABELS] || {
    label: estado,
    color: "bg-slate-100 text-slate-700",
  };
  return <Badge className={config.color}>{config.label}</Badge>;
}

// ============================================================
// FORMULARIO DE TAREA
// ============================================================

function TareaDialog({
  open,
  onClose,
  tarea,
}: {
  open: boolean;
  onClose: () => void;
  tarea?: TareaProgramada | null;
}) {
  const crear = useCrearTarea();
  const actualizar = useActualizarTarea();

  const [form, setForm] = useState({
    nombre: tarea?.nombre || "",
    tipo: tarea?.tipo || ("STOCK" as TipoTarea),
    hora_ejecucion: tarea?.hora_ejecucion || "08:00",
    dias_semana: tarea?.dias_semana || "1,2,3,4,5",
    id_relacion: tarea?.id_relacion || Number(process.env.NEXT_PUBLIC_CENABAST_ID_RELACION || 286),
    tipo_compra: tarea?.tipo_compra || ("C" as "C" | "M"),
    activo: tarea?.activo ?? true,
  });

  const diasSeleccionados = form.dias_semana.split(",");

  const toggleDia = (dia: string) => {
    const dias = new Set(diasSeleccionados);
    if (dias.has(dia)) {
      dias.delete(dia);
    } else {
      dias.add(dia);
    }
    setForm({ ...form, dias_semana: Array.from(dias).sort().join(",") });
  };

  const handleSubmit = () => {
    if (tarea?.id) {
      actualizar.mutate({ id: tarea.id, ...form }, { onSuccess: onClose });
    } else {
      crear.mutate(form, { onSuccess: onClose });
    }
  };

  const isLoading = crear.isPending || actualizar.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle>
            {tarea ? "Editar tarea programada" : "Nueva tarea programada"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nombre de la tarea</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Envío stock diario"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de envío</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as TipoTarea })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_TAREA_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Hora de ejecución</Label>
              <Input
                type="time"
                value={form.hora_ejecucion}
                onChange={(e) => setForm({ ...form, hora_ejecucion: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Días de ejecución</Label>
            <div className="flex gap-2 mt-2">
              {[
                { key: "1", label: "L" },
                { key: "2", label: "M" },
                { key: "3", label: "X" },
                { key: "4", label: "J" },
                { key: "5", label: "V" },
                { key: "6", label: "S" },
                { key: "7", label: "D" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDia(key)}
                  className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                    diasSeleccionados.includes(key)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ID Relación CENABAST</Label>
              <Input
                type="number"
                value={form.id_relacion}
                onChange={(e) => setForm({ ...form, id_relacion: Number(e.target.value) })}
              />
            </div>

            {(form.tipo === "MOVIMIENTO_ENTRADA" || form.tipo === "MOVIMIENTO_SALIDA") && (
              <div>
                <Label>Tipo de compra</Label>
                <Select
                  value={form.tipo_compra}
                  onValueChange={(v) => setForm({ ...form, tipo_compra: v as "C" | "M" })}
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
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label>Tarea activa</Label>
            <Switch
              checked={form.activo}
              onCheckedChange={(v) => setForm({ ...form, activo: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !form.nombre}>
            {isLoading ? "Guardando..." : tarea ? "Guardar cambios" : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function EnviosPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tareaEditar, setTareaEditar] = useState<TareaProgramada | null>(null);
  const [logsFilters, setLogsFilters] = useState<LogsFilters>({
    page: 1,
    size: 15,
    tipo: "",
    estado: "",
    modo: "",
  });

  const { data: tareasData, isLoading: loadingTareas, refetch: refetchTareas } = useSchedulerTareas(true);
  const { data: logsData, isLoading: loadingLogs, refetch: refetchLogs } = useSchedulerLogs(logsFilters);
  
  const toggleTarea = useToggleTarea();
  const eliminarTarea = useEliminarTarea();
  const ejecutarTarea = useEjecutarTarea();
  const ejecutarPendientes = useEjecutarPendientes();
  const limpiarLogs = useLimpiarLogs();

  const stats = logsData?.stats;
  const tareas = tareasData?.tareas || [];
  const logs = logsData?.logs || [];

  const handleNuevaTarea = () => {
    setTareaEditar(null);
    setDialogOpen(true);
  };

  const handleEditarTarea = (tarea: TareaProgramada) => {
    setTareaEditar(tarea);
    setDialogOpen(true);
  };

  const handleEjecutarManual = (tarea: TareaProgramada) => {
    ejecutarTarea.mutate({
      tipo: tarea.tipo,
      id_relacion: tarea.id_relacion,
      tipo_compra: tarea.tipo_compra,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Envíos Automáticos
          </h1>
          <p className="text-sm text-slate-500">
            Configura y monitorea los envíos programados a CENABAST
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchTareas();
              refetchLogs();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            onClick={() => ejecutarPendientes.mutate()}
            disabled={ejecutarPendientes.isPending}
          >
            <Zap className={`mr-2 h-4 w-4 ${ejecutarPendientes.isPending ? "animate-pulse" : ""}`} />
            Ejecutar pendientes
          </Button>
          <Button onClick={handleNuevaTarea}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva tarea
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {loadingLogs ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Total ejecuciones"
              value={stats?.total_ejecuciones || 0}
              icon={History}
              color="slate"
            />
            <StatCard
              title="Completadas"
              value={stats?.completadas || 0}
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              title="Errores"
              value={stats?.errores || 0}
              icon={XCircle}
              color="red"
            />
            <StatCard
              title="Items enviados"
              value={stats?.total_items_enviados?.toLocaleString() || 0}
              icon={Send}
              color="blue"
            />
            <StatCard
              title="Última ejecución"
              value={
                stats?.ultima_ejecucion
                  ? formatDistanceToNow(new Date(stats.ultima_ejecucion), {
                      addSuffix: true,
                      locale: es,
                    })
                  : "Nunca"
              }
              icon={Clock}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tareas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tareas" className="gap-2">
            <Settings className="h-4 w-4" />
            Tareas programadas
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="h-4 w-4" />
            Historial de envíos
          </TabsTrigger>
        </TabsList>

        {/* Tab: Tareas Programadas */}
        <TabsContent value="tareas">
          <SectionCard title={`Tareas programadas (${tareas.length})`}>
            {loadingTareas ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : tareas.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay tareas programadas</p>
                <Button onClick={handleNuevaTarea} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera tarea
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tareas.map((tarea) => (
                  <div
                    key={tarea.id}
                    className={`p-4 rounded-lg border ${
                      tarea.activo
                        ? "bg-white border-slate-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            tarea.activo ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <TipoTareaIcon tipo={tarea.tipo} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{tarea.nombre}</span>
                            <Badge variant="outline">{TIPO_TAREA_LABELS[tarea.tipo]}</Badge>
                          </div>
                          <div className="text-sm text-slate-500 flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {tarea.hora_ejecucion}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDiasSemana(tarea.dias_semana)}
                            </span>
                            {tarea.proxima_ejecucion && (
                              <span className="text-xs">
                                Próxima:{" "}
                                {format(new Date(tarea.proxima_ejecucion), "dd/MM HH:mm", {
                                  locale: es,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right text-xs text-slate-500 mr-4">
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {tarea.ejecuciones_exitosas || 0}
                          </div>
                          <div className="flex items-center gap-1 text-rose-600">
                            <XCircle className="h-3 w-3" />
                            {tarea.ejecuciones_fallidas || 0}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEjecutarManual(tarea)}
                          disabled={ejecutarTarea.isPending}
                          title="Ejecutar ahora"
                        >
                          <Play className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            toggleTarea.mutate({ id: tarea.id, activo: !tarea.activo })
                          }
                          title={tarea.activo ? "Pausar" : "Activar"}
                        >
                          {tarea.activo ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditarTarea(tarea)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => eliminarTarea.mutate(tarea.id)}
                          className="text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="historial">
          <SectionCard
            title="Historial de envíos"
            right={
              <Button
                size="sm"
                variant="outline"
                onClick={() => limpiarLogs.mutate(30)}
                disabled={limpiarLogs.isPending}
              >
                Limpiar logs +30 días
              </Button>
            }
          >
            {/* Filtros */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <Select
                value={logsFilters.tipo || "all"}
                onValueChange={(v) =>
                  setLogsFilters({
                    ...logsFilters,
                    tipo: v === "all" ? "" : (v as TipoTarea),
                    page: 1,
                  })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {Object.entries(TIPO_TAREA_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={logsFilters.estado || "all"}
                onValueChange={(v) =>
                  setLogsFilters({
                    ...logsFilters,
                    estado: v === "all" ? "" : (v as EstadoEjecucion),
                    page: 1,
                  })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="COMPLETADO">Completado</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="EJECUTANDO">Ejecutando</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={logsFilters.modo || "all"}
                onValueChange={(v) =>
                  setLogsFilters({
                    ...logsFilters,
                    modo: v === "all" ? "" : (v as ModoEjecucion),
                    page: 1,
                  })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Todos los modos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="AUTOMATICO">Automático</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabla de logs */}
            {loadingLogs ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay registros de envíos</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="text-left py-3 px-2">Fecha</th>
                        <th className="text-left py-3 px-2">Tipo</th>
                        <th className="text-left py-3 px-2">Modo</th>
                        <th className="text-left py-3 px-2">Estado</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-left py-3 px-2">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-2">
                            <div className="text-slate-900">
                              {format(new Date(log.fecha_inicio), "dd/MM/yyyy", { locale: es })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {format(new Date(log.fecha_inicio), "HH:mm:ss", { locale: es })}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <TipoTareaIcon tipo={log.tipo} />
                              <span>{TIPO_TAREA_LABELS[log.tipo]}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline">
                              {log.modo === "AUTOMATICO" ? "Auto" : "Manual"}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <EstadoBadge estado={log.estado} />
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-emerald-600">{log.items_enviados}</span>
                            {log.items_error > 0 && (
                              <span className="text-rose-600 ml-1">/ {log.items_error} err</span>
                            )}
                          </td>
                          <td className="py-3 px-2 max-w-[200px] truncate text-slate-500">
                            {log.mensaje || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-slate-500">
                    Página {logsData?.page} • Total {logsData?.total}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={logsFilters.page === 1}
                      onClick={() =>
                        setLogsFilters({ ...logsFilters, page: (logsFilters.page || 1) - 1 })
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(logsFilters.page || 1) * (logsFilters.size || 15) >= (logsData?.total || 0)}
                      onClick={() =>
                        setLogsFilters({ ...logsFilters, page: (logsFilters.page || 1) + 1 })
                      }
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Dialog crear/editar tarea */}
      <TareaDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setTareaEditar(null);
        }}
        tarea={tareaEditar}
      />
    </div>
  );
}
