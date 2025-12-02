# Integración CENABAST - Next.js + Mirth Connect

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Resumen  │  │Existencias│ │Movimientos│ │   CENABAST       │ │
│  │ Dashboard│  │  CRUD    │  │   CRUD   │  │ Panel Integración│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   API Routes      │
                    │  /api/cenabast/*  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────────┐
│                     MIRTH CONNECT (Middleware)                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Canal 001  │  │ Canal 002  │  │ Canal 003  │  │ Canal 004  │  │
│  │   Auth     │  │ Productos  │  │   Stock    │  │ Movimiento │  │
│  │  :6661     │  │   :6662    │  │   :6663    │  │   :6664    │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   API CENABAST    │
                    │ api-dev.cenabast.cl│
                    └───────────────────┘
```

## Estructura de Archivos

```
src/
├── lib/
│   └── mirth.ts              # Cliente para comunicación con Mirth
├── hooks/
│   └── use-cenabast.ts       # Hooks React Query para CENABAST
├── app/
│   ├── api/
│   │   └── cenabast/
│   │       ├── auth/route.ts           # Gestión de token
│   │       ├── health/route.ts         # Health check
│   │       ├── stock/
│   │       │   ├── informar/route.ts   # Enviar stock
│   │       │   └── reglas/route.ts     # Gestión reglas min/max
│   │       └── movimiento/
│   │           └── informar/route.ts   # Enviar movimientos
│   └── (protected)/
│       └── cenabast/page.tsx           # Panel de integración
```

## Configuración

### 1. Variables de Entorno

Copiar `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Configurar:
- `MIRTH_HOST`: IP del servidor Mirth (ej: 10.7.71.64)
- `CENABAST_RUT_SOLICITANTE`: RUT del establecimiento
- `CENABAST_ID_RELACION`: ID de relación con CENABAST

### 2. Desplegar Canales Mirth

Seguir las guías paso a paso:
- `GUIA_PASO_A_PASO_CENABAST_003_Stock.md`
- `GUIA_PASO_A_PASO_CENABAST_004_Movimiento.md`

### 3. Verificar Conexión

```bash
# Health check
curl http://localhost:3000/api/cenabast/health
```

## Uso

### Autenticación

```typescript
// Desde el frontend
const auth = useCenabastAuth();
auth.login({ usuario: "user@cenabast.cl", clave: "password" });
```

```bash
# Desde API
curl -X POST http://localhost:3000/api/cenabast/auth \
  -H "Content-Type: application/json" \
  -d '{"usuario":"user@cenabast.cl","clave":"password"}'
```

### Informar Stock

```typescript
// Hook
const stock = useInformarStock();
stock.informar({
  fecha_stock: "2024-12-01",
  id_relacion: 1,
});
```

```bash
# API - Preview (GET)
curl "http://localhost:3000/api/cenabast/stock/informar?fecha=2024-12-01"

# API - Enviar (POST)
curl -X POST http://localhost:3000/api/cenabast/stock/informar \
  -H "Content-Type: application/json" \
  -d '{"fecha_stock":"2024-12-01","id_relacion":1}'
```

### Informar Movimientos

```typescript
const mov = useInformarMovimiento();
mov.informar({
  fecha_movimiento: "2024-12-01",
  id_relacion: 1,
  tipo_movimiento: "E",  // E=Entrada, S=Salida
  tipo_compra: "C",      // C=CENABAST, M=Mercado Público
});
```

### Sincronizar Reglas de Stock

```typescript
const reglas = useReglasStock();
reglas.syncReglas({
  rutSolicitante: "61980320-K",
  idRelacion: 1,
});
```

## Flujo de Datos

### Stock
```
1. Usuario hace clic en "Enviar stock"
2. Frontend llama POST /api/cenabast/stock/informar
3. API obtiene existencias de TBL_existencias_cenabast
4. API llama a Mirth :6663/cenabast/stock/informar
5. Mirth transforma y envía a CENABAST POST /v1/stock
6. Respuesta regresa por el mismo camino
7. Se registra en TBL_auditoria
```

### Movimientos
```
1. Usuario selecciona fecha y tipo (E/S)
2. Frontend llama POST /api/cenabast/movimiento/informar
3. API obtiene movimientos de TBL_movimientos_cenabast
4. API llama a Mirth :6664/cenabast/movimiento/informar
5. Mirth transforma y envía a CENABAST POST /v1/movimiento
6. Respuesta regresa por el mismo camino
```

## Tablas SQL Server

### TBL_cenabast_token
Almacena el token JWT de CENABAST:
```sql
CREATE TABLE TBL_cenabast_token (
  id INT PRIMARY KEY DEFAULT 1,
  token NVARCHAR(MAX),
  expires_at DATETIME,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
);
```

### TBL_auditoria
Registro de operaciones:
```sql
CREATE TABLE TBL_auditoria (
  id INT IDENTITY PRIMARY KEY,
  usuario VARCHAR(100),
  accion VARCHAR(50),
  detalle VARCHAR(255),
  fecha DATETIME DEFAULT GETDATE()
);
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/cenabast/health | Estado de la integración |
| GET | /api/cenabast/auth | Estado del token |
| POST | /api/cenabast/auth | Autenticar con CENABAST |
| PUT | /api/cenabast/auth | Refrescar token |
| GET | /api/cenabast/stock/informar | Preview de stock a enviar |
| POST | /api/cenabast/stock/informar | Enviar stock a CENABAST |
| GET | /api/cenabast/stock/reglas | Consultar regla de producto |
| POST | /api/cenabast/stock/reglas | Configurar reglas |
| PUT | /api/cenabast/stock/reglas | Sincronizar reglas locales |
| GET | /api/cenabast/movimiento/informar | Preview de movimientos |
| POST | /api/cenabast/movimiento/informar | Enviar movimientos |

## Troubleshooting

### Token expirado
```bash
# Refrescar token
curl -X PUT http://localhost:3000/api/cenabast/auth
```

### Mirth no responde
1. Verificar que los canales estén desplegados
2. Verificar puertos: `netstat -tlnp | grep 666`
3. Revisar logs de Mirth

### Error de conexión a BD
1. Verificar variables SQL_* en .env.local
2. Probar conexión: `curl http://localhost:3000/api/health/db`

## Sistema de Envíos Automáticos

### Configuración de Tareas Programadas

Accede a `/cenabast/envios` para:

1. **Crear tareas programadas**: Define qué enviar, a qué hora y qué días
2. **Monitorear ejecuciones**: Dashboard con estadísticas y logs
3. **Ejecutar manualmente**: Botón para forzar ejecución inmediata

### Tipos de Tareas Disponibles

| Tipo | Descripción |
|------|-------------|
| `STOCK` | Envía existencias consolidadas del día |
| `MOVIMIENTO_ENTRADA` | Envía recepciones/entradas |
| `MOVIMIENTO_SALIDA` | Envía despachos/salidas |
| `REGLAS` | Sincroniza niveles min/max |

### Configurar Cron Job

#### Opción A: Vercel Cron (si usas Vercel)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cenabast/scheduler/execute",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

#### Opción B: Crontab Linux
```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar cada 5 minutos)
*/5 * * * * curl -s -H "Authorization: Bearer TU_CRON_SECRET" http://localhost:3000/api/cenabast/scheduler/execute >> /var/log/cenabast-cron.log 2>&1
```

#### Opción C: Script bash
```bash
# Usar el script incluido
chmod +x scripts/cenabast-cron.sh

# Configurar variables
export CENABAST_APP_URL=http://localhost:3000
export CRON_SECRET=tu-secreto

# Ejecutar
./scripts/cenabast-cron.sh
```

### Tablas de Scheduler

```sql
-- TBL_cenabast_scheduler: Configuración de tareas
CREATE TABLE TBL_cenabast_scheduler (
  id INT IDENTITY PRIMARY KEY,
  nombre VARCHAR(100),
  tipo VARCHAR(50),         -- STOCK, MOVIMIENTO_*, REGLAS
  activo BIT DEFAULT 1,
  hora_ejecucion VARCHAR(5), -- HH:MM
  dias_semana VARCHAR(20),   -- 1,2,3,4,5 (Lun-Vie)
  id_relacion INT,
  proxima_ejecucion DATETIME
);

-- TBL_cenabast_scheduler_log: Historial de ejecuciones
CREATE TABLE TBL_cenabast_scheduler_log (
  id INT IDENTITY PRIMARY KEY,
  scheduler_id INT,
  tipo VARCHAR(50),
  modo VARCHAR(20),          -- MANUAL | AUTOMATICO
  estado VARCHAR(20),        -- COMPLETADO | ERROR
  fecha_inicio DATETIME,
  items_enviados INT,
  mensaje TEXT
);
```

### API Endpoints del Scheduler

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/cenabast/scheduler | Listar tareas |
| POST | /api/cenabast/scheduler | Crear tarea |
| PUT | /api/cenabast/scheduler | Actualizar tarea |
| DELETE | /api/cenabast/scheduler?id=X | Eliminar tarea |
| GET | /api/cenabast/scheduler/execute | Ejecutar pendientes (cron) |
| POST | /api/cenabast/scheduler/execute | Ejecutar manual |
| GET | /api/cenabast/scheduler/logs | Historial de envíos |

### Ejemplo: Configurar envío diario de stock

```typescript
// Desde la UI o via API
const tarea = {
  nombre: "Stock diario 8:00",
  tipo: "STOCK",
  hora_ejecucion: "08:00",
  dias_semana: "1,2,3,4,5",  // Lunes a Viernes
  id_relacion: 1,
  activo: true,
};

// POST /api/cenabast/scheduler
fetch("/api/cenabast/scheduler", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(tarea),
});
```

## Estructura Completa de Archivos

```
src/
├── lib/
│   └── mirth.ts                          # Cliente Mirth
├── hooks/
│   ├── use-cenabast.ts                   # Hooks básicos CENABAST
│   └── use-cenabast-scheduler.ts         # Hooks envíos automáticos
├── app/
│   ├── api/cenabast/
│   │   ├── auth/route.ts
│   │   ├── health/route.ts
│   │   ├── stock/
│   │   │   ├── informar/route.ts
│   │   │   └── reglas/route.ts
│   │   ├── movimiento/
│   │   │   └── informar/route.ts
│   │   └── scheduler/                    # ← NUEVO
│   │       ├── route.ts                  # CRUD tareas
│   │       ├── execute/route.ts          # Ejecución
│   │       └── logs/route.ts             # Historial
│   └── (protected)/cenabast/
│       ├── page.tsx                      # Panel principal
│       └── envios/page.tsx               # ← NUEVO: Dashboard envíos
├── components/layout/
│   └── topnav.tsx                        # Nav actualizada
scripts/
└── cenabast-cron.sh                      # Script para cron externo
vercel.json                               # Config Vercel Cron
```

## Próximos Pasos

1. [x] ~~Implementar cron job para envío automático~~
2. [x] ~~Dashboard de métricas de integración~~
3. [x] ~~Logs detallados de comunicación~~
4. [ ] Notificaciones por email de errores
5. [ ] Reintentos automáticos en caso de fallo
6. [ ] Exportar reportes de envíos a Excel/PDF
