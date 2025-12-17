# 📊 Módulo de Estado de Envíos CENABAST

## 🎯 Descripción

Nuevo módulo visual integrado en la **pestaña Resumen (Dashboard)** que muestra en tiempo real el estado de los envíos a CENABAST.

---

## ✨ Características

### 📈 **Estadísticas en Tiempo Real**
- **Envíos Exitosos**: Contador de operaciones completadas
- **Envíos Fallidos**: Contador de operaciones con error
- **Total de Items Enviados**: Suma total de productos/movimientos enviados
- **Tasa de Éxito**: Porcentaje visual con barra de progreso

### 🚦 **Indicador de Salud**
- **Estado Operativo** (verde): Tasa de éxito ≥ 90%
- **Estado Advertencia** (amarillo): Tasa de éxito entre 70-89%
- **Estado Crítico** (rojo): Tasa de éxito < 70%
- Animación de pulso en tiempo real

### 📋 **Últimas Operaciones**
- Lista de las 5 operaciones más recientes
- Información detallada de cada envío:
  - ✅ Estado (Completado/Error/En proceso)
  - 📦 Tipo (Stock/Entrada/Salida/Reglas)
  - 🤖 Modo (Manual/Automático)
  - ⏱️ Tiempo transcurrido (ej: "hace 5 minutos")
  - 📊 Cantidad de items enviados
  - 💬 Mensaje de resultado

### 🔄 **Actualización Automática**
- Refresco automático cada 30 segundos
- Datos en vivo sin necesidad de recargar la página

---

## 📁 Archivos Creados

### 1. **Hook de Datos**
**Ubicación**: `src/hooks/use-cenabast-logs.ts`

Obtiene los logs de envíos desde la API con tipos TypeScript completos:
```typescript
import { useCenabastLogs } from "@/hooks/use-cenabast-logs";

const { data, isLoading } = useCenabastLogs({ size: 5 });
```

**Tipos disponibles**:
- `CenabastLog`: Información de cada operación
- `CenabastLogsStats`: Estadísticas agregadas
- `CenabastLogsResponse`: Respuesta completa de la API

### 2. **Componente Visual**
**Ubicación**: `src/components/widgets/cenabast-status-widget.tsx`

Widget visual con diseño moderno que incluye:
- Header con gradiente azul/índigo
- Tarjetas de estadísticas con iconos
- Barra de progreso animada
- Lista de operaciones recientes con estados visuales
- Indicador de salud con animación

### 3. **Integración en Dashboard**
**Ubicación**: `src/app/(protected)/page.tsx`

El widget se agregó al layout existente sin romper nada:
```
Grid Layout:
┌─────────────┬─────────────┬─────────────┐
│ Top 10      │ Salud del   │ **NUEVO**   │
│ Rotación    │ Sistema     │ Estado      │
│             │             │ CENABAST    │
└─────────────┴─────────────┴─────────────┘
```

---

## 🎨 Diseño Visual

### **Header (Gradiente azul)**
```
┌────────────────────────────────────┐
│  📤 Envíos CENABAST    🟢 Operativo│
│     Estado en tiempo real          │
└────────────────────────────────────┘
```

### **Estadísticas**
```
┌──────────┬──────────┬──────────┐
│ ✅ 45    │ ❌ 2     │ 📈 1,250 │
│ Exitosos │ Fallidos │ Items    │
└──────────┴──────────┴──────────┘
```

### **Tasa de Éxito**
```
Tasa de éxito                    95%
████████████████████░░░░░░░░░░░░
```

### **Últimas Operaciones**
```
┌──────────────────────────────────┐
│ ✅ Stock        [AUTOMATICO]     │
│ hace 2 minutos • 508 items       │
│ 508 items procesados             │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ ✅ Entrada      [MANUAL]         │
│ hace 15 minutos • 15 items       │
│ 15 items procesados              │
└──────────────────────────────────┘
```

---

## 🔧 API Utilizada

El módulo consume el endpoint existente:
```
GET /api/cenabast/scheduler/logs?size=5
```

**Respuesta**:
```json
{
  "logs": [...],
  "total": 47,
  "page": 1,
  "size": 5,
  "stats": {
    "total_ejecuciones": 47,
    "completadas": 45,
    "errores": 2,
    "en_proceso": 0,
    "total_items_enviados": 1250,
    "total_items_error": 25,
    "ultima_ejecucion": "2024-12-09T10:30:00Z"
  }
}
```

---

## 🎯 Casos de Uso

### **1. Monitoreo en Tiempo Real**
El administrador puede ver instantáneamente si los envíos a CENABAST están funcionando correctamente.

### **2. Detección Rápida de Problemas**
Si aparece el indicador 🔴 Crítico o muchos envíos fallidos, se puede actuar inmediatamente.

### **3. Validación de Envíos Manuales**
Después de hacer un envío manual, aparecerá en la lista con su resultado.

### **4. Auditoría Visual**
Historial visual de las últimas operaciones con timestamps y detalles.

---

## 🚀 Cómo Usar

### **Ver el módulo**
1. Abre la aplicación
2. Ve a la pestaña **"Resumen"** (Dashboard principal)
3. El widget aparece en la tercera columna del grid
4. Se actualiza automáticamente cada 30 segundos

### **Interpretar el Estado**
- 🟢 **Verde (Operativo)**: Todo funciona correctamente, ≥90% de éxito
- 🟡 **Amarillo (Advertencia)**: Hay algunos fallos, 70-89% de éxito
- 🔴 **Rojo (Crítico)**: Muchos fallos, <70% de éxito

### **Ver Detalles de una Operación**
Cada ítem en "Últimas operaciones" muestra:
- ✅/❌ Estado visual
- Tipo de envío (Stock/Entrada/Salida)
- Modo (Manual/Automático)
- Tiempo transcurrido
- Cantidad de items
- Mensaje de resultado

---

## 📊 Ejemplo Visual

```
╔════════════════════════════════════╗
║  📤 Envíos CENABAST    🟢 Operativo║
║     Estado en tiempo real          ║
╠════════════════════════════════════╣
║                                    ║
║  ┌────────┬────────┬────────┐    ║
║  │   45   │   2    │ 1,250  │    ║
║  │ ✅ Exit│ ❌ Fall│ 📈 Item│    ║
║  └────────┴────────┴────────┘    ║
║                                    ║
║  Tasa de éxito           95%      ║
║  ███████████████████░░░░░         ║
║                                    ║
║  Últimas operaciones         5    ║
║  ┌──────────────────────────┐    ║
║  │ ✅ Stock    [AUTO]  COMP │    ║
║  │ hace 2 min • 508 items   │    ║
║  └──────────────────────────┘    ║
║  ┌──────────────────────────┐    ║
║  │ ✅ Entrada  [MANUAL] COMP│    ║
║  │ hace 15 min • 15 items   │    ║
║  └──────────────────────────┘    ║
║  ┌──────────────────────────┐    ║
║  │ ❌ Salida   [AUTO]  ERROR│    ║
║  │ hace 1 hora • 0 items    │    ║
║  │ Error: No hay movimie... │    ║
║  └──────────────────────────┘    ║
╚════════════════════════════════════╝
```

---

## ✅ Ventajas

1. **📊 Visibilidad Inmediata**: Ver el estado sin navegar a otra página
2. **🔄 Actualización Automática**: Datos frescos sin recargar
3. **🎨 Diseño Intuitivo**: Colores y badges que facilitan la comprensión
4. **📈 Métricas Clave**: KPIs importantes al alcance de la vista
5. **⚡ Respuesta Rápida**: Detectar problemas inmediatamente
6. **🎯 Sin Interrupciones**: Se integra sin romper el dashboard existente

---

## 🔮 Posibles Mejoras Futuras

- [ ] Filtro por tipo de envío (Stock/Movimientos)
- [ ] Exportar historial a Excel
- [ ] Alertas por email cuando hay fallos
- [ ] Gráfico de tendencia de envíos
- [ ] Click en un log para ver detalles completos
- [ ] Reintento automático de envíos fallidos
- [ ] Comparación con período anterior

---

## 🎉 Resultado Final

El dashboard ahora tiene **visibilidad completa** del estado de los envíos a CENABAST, permitiendo:
- ✅ Monitorear la salud de la integración
- ✅ Detectar problemas rápidamente
- ✅ Validar que los envíos se completen
- ✅ Ver historial de operaciones recientes
- ✅ Todo sin salir de la página principal

**¡El módulo está listo para usar!** 🚀
