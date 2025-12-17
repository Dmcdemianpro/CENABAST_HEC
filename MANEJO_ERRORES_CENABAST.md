# Sistema de Manejo de Errores CENABAST

## Descripción General

El sistema ahora incluye validación robusta de fechas y manejo inteligente de errores de respuestas Mirth/CENABAST. Esto previene errores comunes como **SqlDateTime overflow** y proporciona mensajes claros y accionables.

## ✅ Mejoras Implementadas

### 1. Validación de Fechas (`date-validator.ts`)

**Problema resuelto**: SQL Server solo acepta fechas entre `1753-01-01` y `9999-12-31`. Fechas NULL, vacías o fuera de rango causaban el error `SqlDateTime overflow`.

**Funciones disponibles**:

#### `isValidSqlDate(date)`
Valida si una fecha está dentro del rango de SQL Server
```typescript
isValidSqlDate('2024-12-12') // ✅ true
isValidSqlDate('1752-01-01') // ❌ false (antes del mínimo)
isValidSqlDate(null) // ❌ false
```

#### `toSqlDate(date)`
Convierte a formato YYYY-MM-DD válido o retorna null
```typescript
toSqlDate(new Date('2024-12-12')) // "2024-12-12"
toSqlDate('1752-01-01') // null (inválido)
```

#### `sanitizeSqlDate(date)`
Igual que `toSqlDate` pero retorna `undefined` si es inválido (útil para campos opcionales)
```typescript
sanitizeSqlDate('2024-12-12') // "2024-12-12"
sanitizeSqlDate(null) // undefined (se omite al serializar JSON)
```

#### `getDateDiagnostic(date)`
Proporciona información detallada sobre por qué una fecha es inválida
```typescript
getDateDiagnostic(null)
// { value: null, type: 'null', isValid: false, reason: 'Fecha es null' }
```

### 2. Parser de Errores Mirth (`mirth-error-handler.ts`)

**Problema resuelto**: Errores crípticos de Mirth/CENABAST eran difíciles de entender y solucionar.

**Tipos de errores detectados**:

| Tipo | Descripción | Recuperable |
|------|-------------|-------------|
| `FECHA_INVALIDA` | SqlDateTime overflow | ✅ Sí |
| `RELACION_INVALIDA` | Foreign key violation | ✅ Sí |
| `CAMPO_REQUERIDO_NULL` | Campo obligatorio NULL | ✅ Sí |
| `CONVERSION_TIPO_DATOS` | Error de conversión de tipos | ✅ Sí |
| `TIMEOUT` | Tiempo de espera agotado | ✅ Sí |
| `NO_AUTORIZADO` | Token inválido/expirado (401) | ✅ Sí |
| `NO_ENCONTRADO` | Recurso no existe (404) | ❌ No |
| `ERROR_SERVIDOR` | Error interno servidor (500) | ✅ Sí |

**Funciones disponibles**:

#### `parseMirthError(response)`
Analiza la respuesta de error y extrae información útil
```typescript
const error = parseMirthError({
  statusCode: 500,
  isSuccessful: false,
  errorMessage: "SqlDateTime overflow..."
});

console.log(error);
// {
//   tipo: "FECHA_INVALIDA",
//   mensaje: "Una o más fechas son inválidas para SQL Server",
//   detalles: [...],
//   sugerencias: [...],
//   esRecuperable: true
// }
```

#### `formatMirthErrorForUser(parsed)`
Formatea el error para mostrar al usuario final
```typescript
const formatted = formatMirthErrorForUser(parsedError);
// "❌ Una o más fechas son inválidas para SQL Server
//
//  📋 Detalles:
//    • SQL Server solo acepta fechas entre 1753-01-01 y 9999-12-31
//    • Fechas NULL o vacías causan este error
//
//  💡 Sugerencias:
//    • Revise que todas las fechas estén en formato YYYY-MM-DD
//    • Elimine o reemplace fechas NULL con valores válidos"
```

## 📋 Cambios en los Endpoints

### Stock: `/api/cenabast/stock/informar`

**Validaciones agregadas**:
1. ✅ Valida formato de `fecha_stock` (YYYY-MM-DD)
2. ✅ Sanitiza fecha antes de enviar a Mirth
3. ✅ Parsea errores de Mirth con mensajes claros
4. ✅ Detecta errores en respuestas aparentemente exitosas

**Respuesta de error mejorada**:
```json
{
  "success": false,
  "error": {
    "tipo": "FECHA_INVALIDA",
    "message": "Una o más fechas son inválidas para SQL Server",
    "detalles": [
      "SQL Server solo acepta fechas entre 1753-01-01 y 9999-12-31",
      "Fechas NULL o vacías causan este error"
    ],
    "sugerencias": [
      "Revise que todas las fechas estén en formato YYYY-MM-DD",
      "Elimine o reemplace fechas NULL con valores válidos"
    ],
    "esRecuperable": true
  }
}
```

### Movimiento: `/api/cenabast/movimiento/informar`

**Validaciones agregadas**:
1. ✅ Valida formato de `fecha_movimiento`
2. ✅ Sanitiza `fecha_vencimiento` de cada producto
3. ✅ Elimina fechas inválidas en lugar de causar error
4. ✅ Registra warnings para fechas inválidas
5. ✅ Parsea errores de Mirth

**Sanitización de datos**:
```typescript
// Antes (causaba error)
{
  fecha_vencimiento: null  // ❌ SqlDateTime overflow
}

// Ahora (campo se omite)
{
  fecha_vencimiento: undefined  // ✅ No se envía al serializar JSON
}
```

### Scheduler: `/api/cenabast/scheduler/execute`

**Validaciones agregadas**:
1. ✅ Valida fecha actual antes de enviar
2. ✅ Sanitiza todas las fechas en stock y movimientos
3. ✅ Maneja errores internos de Mirth
4. ✅ Logs detallados de errores

## 🔍 Cómo Interpretar los Errores

### Error: SqlDateTime overflow

**Mensaje completo**:
```
SqlDateTime overflow. Must be between 1/1/1753 12:00:00 AM and 12/31/9999 11:59:59 PM
```

**Causas comunes**:
1. Campo de fecha con valor NULL
2. Fecha con formato incorrecto
3. Fecha fuera del rango válido

**Solución**:
- ✅ **Ya está implementada**: El sistema ahora valida y sanitiza automáticamente todas las fechas
- Si persiste el error, revise la base de datos:
  ```sql
  -- Encontrar fechas problemáticas en movimientos
  SELECT codigo, fechaMovimiento, vencimiento
  FROM TBL_movimientos_cenabast
  WHERE vencimiento IS NULL
     OR TRY_CAST(vencimiento AS DATE) IS NULL
  ```

### Error: Foreign Key Violation

**Mensaje**: Error de relación con otra tabla

**Causas**:
- `id_relacion` no existe en CENABAST
- Código de producto inválido

**Solución**:
```bash
# Verificar id_relacion en .env
CENABAST_ID_RELACION=286  # Verificar que este ID existe
```

### Error: Token Inválido (401)

**Mensaje**: Token de autenticación inválido o expirado

**Solución**:
- ✅ **Automática**: El sistema obtiene un nuevo token automáticamente
- Si persiste, verificar credenciales en `.env`:
  ```bash
  CENABAST_USER=usuario
  CENABAST_PASSWORD=contraseña
  ```

## 📊 Logs Detallados

### Logs de Validación
```
[stock/informar] Fecha sanitizada: 2024-12-12
[API] fecha_vencimiento inválida para producto: PROD123 fecha: 0001-01-01
```

### Logs de Error
```
[stock/informar] Error parseado: {
  "tipo": "FECHA_INVALIDA",
  "mensaje": "Una o más fechas son inválidas para SQL Server",
  "esRecuperable": true,
  "timestamp": "2024-12-12T10:30:00Z"
}
```

## 🧪 Testing

### Probar validación de fechas
```bash
# 1. Endpoint de stock con fecha inválida
curl -X POST http://localhost:3000/api/cenabast/stock/informar \
  -H "Content-Type: application/json" \
  -d '{
    "id_relacion": 286,
    "fecha_stock": "1700-01-01"  // ❌ Antes del mínimo SQL
  }'

# Respuesta esperada:
# {
#   "success": false,
#   "error": {
#     "message": "Fecha de stock inválida",
#     "details": {
#       "value": "1700-01-01",
#       "isValid": false,
#       "reason": "Fecha menor a 1753-01-01"
#     }
#   }
# }
```

### Probar manejo de errores Mirth
```bash
# El sistema ahora captura y parsea automáticamente
# errores de Mirth mostrando mensajes claros
```

## 🎯 Casos de Uso Resueltos

### ✅ Caso 1: Productos con fecha_vencimiento NULL
**Antes**: Error `SqlDateTime overflow`
**Ahora**: Campo se omite automáticamente (undefined), envío exitoso

### ✅ Caso 2: Fecha fuera de rango
**Antes**: Error críptico de SQL
**Ahora**: Mensaje claro con diagnóstico detallado

### ✅ Caso 3: Error 500 de CENABAST
**Antes**: Solo `Error 500`
**Ahora**: Tipo de error, detalles, y sugerencias de solución

## 📁 Archivos Modificados

### Nuevos archivos:
- ✅ `src/lib/date-validator.ts` - Validación y sanitización de fechas
- ✅ `src/lib/mirth-error-handler.ts` - Parser de errores Mirth

### Archivos actualizados:
- ✅ `src/app/api/cenabast/stock/informar/route.ts` - Validación de fechas + manejo de errores
- ✅ `src/app/api/cenabast/movimiento/informar/route.ts` - Validación de fechas + manejo de errores
- ✅ `src/app/api/cenabast/scheduler/execute/route.ts` - Validación de fechas + manejo de errores

## 🔧 Mantenimiento

### Agregar nuevo tipo de error

Editar `src/lib/mirth-error-handler.ts`:

```typescript
// En la función parseMirthError(), agregar:
if (errorMsg.includes('TU_PATRON_DE_ERROR')) {
  return {
    tipo: 'NUEVO_TIPO_ERROR',
    mensaje: 'Descripción clara',
    detalles: ['Detalle 1', 'Detalle 2'],
    sugerencias: ['Sugerencia 1', 'Sugerencia 2'],
    esRecuperable: true,
    datosOriginales: response,
  };
}
```

### Agregar validación de fecha a nuevo endpoint

```typescript
import { isValidDateFormat, toSqlDate, getDateDiagnostic } from "@/lib/date-validator";
import { parseMirthError, formatMirthErrorForLog } from "@/lib/mirth-error-handler";

// Validar fecha
if (!isValidDateFormat(miFecha)) {
  const diagnostic = getDateDiagnostic(miFecha);
  console.error("Fecha inválida:", diagnostic);
  return NextResponse.json({
    success: false,
    error: { message: "Fecha inválida", details: diagnostic }
  }, { status: 400 });
}

// Sanitizar antes de enviar
const fechaSanitizada = toSqlDate(miFecha);

// Manejar respuesta Mirth
if (mirthData?.statusCode && !mirthData?.isSuccessful) {
  const parsedError = parseMirthError(mirthData);
  console.error("Error:", formatMirthErrorForLog(parsedError));

  return NextResponse.json({
    success: false,
    error: {
      tipo: parsedError.tipo,
      message: parsedError.mensaje,
      detalles: parsedError.detalles,
      sugerencias: parsedError.sugerencias,
    }
  }, { status: mirthData.statusCode || 500 });
}
```

## 🚀 Resumen

El sistema ahora:
1. ✅ **Previene** errores de fecha antes de enviar a Mirth
2. ✅ **Sanitiza** automáticamente fechas inválidas
3. ✅ **Parsea** errores de Mirth en mensajes claros
4. ✅ **Registra** información detallada para debugging
5. ✅ **Sugiere** soluciones específicas para cada error

**Resultado**: Ya no deberías ver errores `SqlDateTime overflow` ni mensajes crípticos de Mirth. Todos los errores ahora tienen explicaciones claras y sugerencias accionables.
