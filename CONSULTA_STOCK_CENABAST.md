# Consulta de Stock desde CENABAST

## Descripción

Nueva funcionalidad que permite consultar el stock que previamente has informado a CENABAST, mostrándolo directamente en el dashboard de la aplicación.

## 🎯 Funcionalidad

El sistema ahora puede:
- ✅ Consultar el stock informado previamente a CENABAST
- ✅ Filtrar por mes y año
- ✅ Mostrar la lista completa de productos con sus cantidades
- ✅ Ver información detallada (código interno, código genérico, descripción, cantidad)

## 📦 Componentes Implementados

### 1. Endpoint API: `/api/cenabast/stock/consultar`

**Archivo**: [route.ts](C:\cenabast-dashboard\src\app\api\cenabast\stock\consultar\route.ts)

**Método**: GET

**Parámetros**:
- `mes` (1-12): Mes a consultar
- `anio` (YYYY): Año a consultar

**Ejemplo de uso**:
```bash
GET /api/cenabast/stock/consultar?mes=12&anio=2024
```

**Respuesta exitosa**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "codigoInterno": "PROD001",
        "codigoGenerico": 12345,
        "cantidadStock": 150,
        "descripcionProducto": "Paracetamol 500mg"
      }
    ],
    "total": 508
  },
  "consulta": {
    "solicitante": "61980320",
    "mes": 12,
    "anio": 2024,
    "periodo": "12/2024"
  }
}
```

**Respuesta con error**:
```json
{
  "success": false,
  "error": {
    "tipo": "NO_AUTORIZADO",
    "message": "Token de autenticación inválido o expirado",
    "detalles": [...],
    "sugerencias": [...]
  }
}
```

**Validaciones**:
- ✅ Mes debe estar entre 1 y 12
- ✅ Año debe estar entre 2020 y 2100
- ✅ Token de autenticación válido
- ✅ Manejo de errores con parser especializado

### 2. Hook React Query: `useStockCenabast`

**Archivo**: [use-stock-cenabast.ts](C:\cenabast-dashboard\src\hooks\use-stock-cenabast.ts)

**Uso**:
```typescript
import { useStockCenabast } from "@/hooks/use-stock-cenabast";

function MiComponente() {
  const { data, isLoading, error } = useStockCenabast({
    mes: 12,
    anio: 2024,
    enabled: true, // opcional
  });

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Total productos: {data?.data?.total}</div>;
}
```

**Características**:
- ✅ Cache de 5 minutos (datos de CENABAST cambian poco)
- ✅ Reintentos automáticos (2 intentos)
- ✅ Puede habilitarse/deshabilitarse dinámicamente
- ✅ Validación de parámetros antes de hacer la consulta

**Helper adicional**:
```typescript
import { useCurrentPeriod } from "@/hooks/use-stock-cenabast";

const { mes, anio } = useCurrentPeriod();
// mes = 12, anio = 2024 (valores actuales)
```

### 3. Componente UI: `StockCenabastWidget`

**Archivo**: [stock-cenabast-widget.tsx](C:\cenabast-dashboard\src\components\widgets\stock-cenabast-widget.tsx)

**Características**:
- 📅 **Selectores de período**: Mes y año con dropdowns
- 🔍 **Botón de consulta**: Trigger manual de la búsqueda
- 📊 **Tabla de resultados**: Muestra todos los productos encontrados
- ⚡ **Estados visuales**: Loading, error, éxito, sin datos
- 🎨 **Diseño responsivo**: Se adapta a móviles y tablets
- 📋 **Scroll en tabla**: Hasta 400px de altura con scroll
- 🔄 **Auto-refresh**: Botón de refrescar con animación
- 💡 **Mensajes claros**: Errores detallados con sugerencias

**Ubicación en la app**:
- Se muestra en la página principal (Dashboard)
- Ubicado debajo del grid de KPIs y widgets de salud

## 🚀 Cómo Usar

### Desde la Interfaz Web

1. **Acceder al Dashboard**
   - Ir a la página principal del dashboard

2. **Seleccionar Período**
   - Elegir el mes del dropdown (Enero - Diciembre)
   - Elegir el año del dropdown (últimos 6 años disponibles)

3. **Consultar**
   - Hacer clic en el botón "Consultar"
   - Esperar a que se cargue la información

4. **Ver Resultados**
   - La tabla mostrará todos los productos informados
   - Se puede hacer scroll si hay muchos productos
   - Badge verde muestra el total de productos

### Desde la API (Programático)

```typescript
// Consultar stock de diciembre 2024
const response = await fetch('/api/cenabast/stock/consultar?mes=12&anio=2024');
const data = await response.json();

if (data.success) {
  console.log('Total productos:', data.data.total);
  console.log('Productos:', data.data.items);
} else {
  console.error('Error:', data.error.message);
  console.log('Sugerencias:', data.error.sugerencias);
}
```

## 📋 Información Mostrada

Para cada producto se muestra:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Código Interno** | Código del producto en tu sistema | "PROD001" |
| **Código Genérico** | Código genérico CENABAST | 12345 |
| **Descripción** | Nombre/descripción del producto | "Paracetamol 500mg" |
| **Cantidad** | Stock informado | 150 |

## 🔍 Estados del Componente

### 1. Estado Inicial
- Muestra mensaje: "Selecciona un período y haz clic en Consultar"
- Mes y año pre-seleccionados con valores actuales

### 2. Cargando
- Muestra skeletons animados
- Botón "Consultar" deshabilitado con spinner

### 3. Error
- Alert rojo con ícono de error
- Mensaje de error claro
- Lista de detalles (si hay)
- Lista de sugerencias (si hay)

### 4. Éxito con Datos
- Banner verde con ícono de éxito
- Información del período consultado
- Badge con total de productos
- Tabla con todos los productos
- Opción de ver respuesta completa (JSON)

### 5. Éxito sin Datos
- Alert azul con ícono de calendario
- Mensaje: "No se encontraron productos informados"
- Sugerencia de probar otro período

## 🎨 Integración en el Dashboard

El widget se agregó en [page.tsx](C:\cenabast-dashboard\src\app\(protected)\page.tsx#L75) como:

```tsx
<StockCenabastWidget />
```

**Ubicación visual**:
```
┌─────────────────────────────────────┐
│ KPIs (4 tarjetas)                   │
├─────────────────────────────────────┤
│ Top 10 | Salud | Estado CENABAST    │
├─────────────────────────────────────┤
│ 🆕 Consulta Stock CENABAST          │ ← NUEVO
│   [Mes] [Año] [Consultar]           │
│   Tabla de productos...             │
└─────────────────────────────────────┘
```

## 🔧 Configuración

### Variables de Entorno

El RUT solicitante se obtiene de (en orden de prioridad):

```bash
# .env o .env.local
NEXT_PUBLIC_CENABAST_RUT=61980320
# o
CENABAST_RUT_SOLICITANTE=61980320
```

Si no se configura, usa el valor por defecto: `61980320`

### Canal Mirth

El endpoint utiliza:
- **Puerto**: 6663 (Canal 003 - Stock)
- **Path**: `/cenabast/stock/consulta`
- **Método**: GET
- **Autenticación**: Bearer token (obtenido automáticamente)

## 🧪 Testing

### Prueba Manual

1. **Consulta con datos**:
   - Seleccionar mes/año donde hayas informado stock previamente
   - Debería mostrar lista de productos

2. **Consulta sin datos**:
   - Seleccionar mes/año antiguo sin datos
   - Debería mostrar mensaje "No se encontraron productos"

3. **Manejo de errores**:
   - Si el token expira, debería mostrar error claro
   - Si Mirth está caído, debería mostrar error de timeout

### Prueba Programática

```bash
# Desde terminal
curl "http://localhost:3000/api/cenabast/stock/consultar?mes=12&anio=2024" \
  -H "Cookie: tu-cookie-de-sesion"

# Respuesta esperada
{
  "success": true,
  "data": { ... },
  "consulta": { ... }
}
```

## ⚠️ Consideraciones

### Limitaciones
- Solo consulta datos que YA has informado a CENABAST
- No crea ni modifica stock, solo lo visualiza
- Depende de que CENABAST tenga los datos disponibles

### Performance
- Los datos se cachean 5 minutos
- No se auto-refresca (requiere clic manual)
- Tabla con scroll para manejar muchos productos

### Seguridad
- Requiere autenticación (sesión activa)
- Token JWT se obtiene automáticamente
- Validación de parámetros en backend

## 🔄 Flujo Completo

```
Usuario → Selecciona Mes/Año → Click "Consultar"
   ↓
Frontend → useStockCenabast hook
   ↓
API → /api/cenabast/stock/consultar
   ↓
Backend → getValidToken() → Obtiene JWT
   ↓
Mirth → Canal 6663 → /cenabast/stock/consulta
   ↓
CENABAST → Devuelve datos de stock informado
   ↓
Mirth → Responde a la API
   ↓
API → Parsea errores si hay → Responde a frontend
   ↓
Frontend → Renderiza tabla con productos
```

## 📝 Diferencias con "Informar Stock"

| Característica | Informar Stock | Consultar Stock |
|----------------|----------------|-----------------|
| Acción | Envía stock A CENABAST | Lee stock DESDE CENABAST |
| Datos | Desde tu BD local | Desde CENABAST |
| Edición | Puede crear/actualizar | Solo lectura |
| Uso | Informar cambios | Ver histórico |
| Endpoint API | POST /stock/informar | GET /stock/consultar |
| Canal Mirth | 6663 (POST) | 6663 (GET) |

## 🎯 Casos de Uso

1. **Verificación de envíos**:
   - Confirmar que el stock informado se recibió correctamente

2. **Auditoría**:
   - Revisar qué se informó en períodos anteriores

3. **Reconciliación**:
   - Comparar lo que informaste vs. lo que CENABAST tiene registrado

4. **Histórico**:
   - Ver evolución del stock informado mes a mes

## 🐛 Troubleshooting

### "No se pudo obtener token"
**Solución**: Verificar credenciales CENABAST en `.env`

### "Error HTTP 404"
**Solución**: Verificar que el canal Mirth 6663 esté activo

### "No se encontraron productos"
**Posibles causas**:
- No has informado stock en ese período
- CENABAST no tiene datos para ese mes/año
- El RUT solicitante es incorrecto

### Tabla vacía pero dice "Total: 508"
**Solución**: Verificar estructura de respuesta de CENABAST (puede variar)

## 🚀 Próximas Mejoras (Sugeridas)

- [ ] Exportar resultados a Excel
- [ ] Comparar con stock local actual
- [ ] Gráfico de evolución mes a mes
- [ ] Filtros por código/descripción
- [ ] Paginación si hay muchos productos
- [ ] Auto-refresh cada X minutos
- [ ] Guardar consultas frecuentes

---

## Resumen

✅ **Implementado**: Sistema completo de consulta de stock desde CENABAST
✅ **Integrado**: Widget visible en el dashboard principal
✅ **Funcional**: Consulta por mes/año con validaciones
✅ **Robusto**: Manejo de errores y estados visuales claros

**¡Listo para usar!** 🎉
