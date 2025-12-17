# Implementación de Especificación CENABAST v1.9

**Fecha de Implementación**: 2025-12-17
**Versión de API**: v1.9 (25 de septiembre de 2025)
**Estado**: ✅ Implementado

---

## 🎯 Problema Resuelto

El aplicativo estaba enviando datos con **formatos incorrectos** que causaban el error **"Modelo no válido"** en la API de CENABAST.

### Errores Corregidos:

| Campo | ❌ Antes (INCORRECTO) | ✅ Ahora (CORRECTO) |
|-------|----------------------|---------------------|
| `codigo_generico` | `0` (cero) | `100000122` (int > 0) |
| `rut_proveedor` | `"96519830-K"` (string con DV) | `96519830` (int sin DV) |
| `nro_factura` | `"698201"` (string) | `698201` (int) |
| `nro_guia_despacho` | `"555611478"` (string) | `555611478` (int) |
| `codigo_despacho` | `0` (cero inútil) | Campo omitido si es 0 |

---

## 📦 Archivos Creados

### **1. Librería de Transformación**
**Archivo**: `src/lib/cenabast-transform.ts`
**Líneas**: 280+
**Funciones principales**:

```typescript
// Limpia RUT: "96.519.830-K" → 96519830
limpiarRut(rut: string | number): number | undefined

// Convierte a int: "698201" → 698201
toInt(valor: string | number): number | undefined

// Convierte código ZGEN: "100000122" → 100000122
toCodigoGenerico(codigoZgen: string | number): number

// Transforma item completo según CENABAST v1.9
transformarItemMovimiento(item: any): any

// Valida que un item cumpla las reglas
validarItemMovimiento(item: any): { isValid: boolean; errors: string[] }

// Transforma payload completo
transformarMovimientoParaCenabast(movimientoData: any): {
  data: any;
  errores: string[];
  warnings: string[];
}
```

---

## 🔧 Archivos Modificados

### **1. Endpoint Principal de Movimientos**
**Archivo**: `src/app/api/cenabast/movimiento/informar/route.ts`

**Cambios**:
- ✅ Importa `transformarMovimientoParaCenabast`
- ✅ Transforma datos antes de enviar a Mirth
- ✅ Valida y rechaza si hay errores críticos
- ✅ Muestra warnings en logs si `codigo_generico` es 0

**Antes**:
```typescript
movimiento_detalle: result.recordset.map((row: any) => ({
  codigo_interno: String(row.codigo_interno),
  codigo_generico: Number(row.codigo_generico) || 0, // ❌ Puede ser 0
  rut_proveedor: row.rut_proveedor ? String(row.rut_proveedor) : undefined, // ❌ String con DV
  nro_factura: !esGuia && row.nro_doc ? String(row.nro_doc) : undefined, // ❌ String
  codigo_despacho: 0, // ❌ Siempre 0
}))
```

**Ahora**:
```typescript
const transformacion = transformarMovimientoParaCenabast(movimientoDataRaw);

if (transformacion.errores.length > 0) {
  return NextResponse.json({
    success: false,
    error: {
      message: "Errores de validación en los datos",
      errores: transformacion.errores,
    }
  }, { status: 400 });
}

const movimientoData = transformacion.data; // ✅ Datos correctos
```

---

### **2. Scheduler de Envíos Automáticos**
**Archivo**: `src/app/api/cenabast/scheduler/execute/route.ts`

**Cambios**:
- ✅ Importa `transformarMovimientoParaCenabast`
- ✅ Aplica transformaciones antes de enviar
- ✅ Maneja errores y warnings

---

### **3. Endpoint de Pruebas**
**Archivo**: `src/app/api/test-mirth-movimiento/route.ts`

**Cambios**:
- ✅ Usa transformaciones en datos de prueba
- ✅ Demuestra cómo se corrigen los formatos
- ✅ Muestra datos ANTES y DESPUÉS en logs

**Logs mejorados**:
```
[TEST-MIRTH] Datos RAW (antes de transformar): {
  "rut_proveedor": "76186755-5",  // String con DV
  "nro_factura": "698201"          // String
}

[TEST-MIRTH] Datos TRANSFORMADOS (según CENABAST v1.9): {
  "rut_proveedor": 76186755,  // Int sin DV ✅
  "nro_factura": 698201        // Int ✅
}
```

---

## 📋 Especificación de Campos

### Campos Obligatorios (Body principal):

| Campo | Tipo | Ejemplo | Validación |
|-------|------|---------|------------|
| `id_relacion` | `int` | `286` | Requerido |
| `fecha_movimiento` | `string` | `"2025-12-15"` | Formato YYYY-MM-DD |
| `tipo_movimiento` | `string` | `"E"` o `"S"` | E=Entrada, S=Salida |
| `tipo_compra` | `string` | `"C"` o `"M"` | C=CENABAST, M=Mercado |
| `movimiento_detalle` | `array` | `[...]` | Mínimo 1 item |

### Campos Obligatorios (movimiento_detalle):

| Campo | Tipo | Ejemplo | Validación |
|-------|------|---------|------------|
| `codigo_interno` | `string` | `"5550980"` | Código del hospital |
| `codigo_generico` | `int` | `100000122` | **NO puede ser 0** |
| `cantidad` | `int` | `1000` | Mayor a 0 |

### Campos Opcionales (movimiento_detalle):

| Campo | Tipo | Ejemplo | Notas |
|-------|------|---------|-------|
| `rut_proveedor` | `int` | `96519830` | **SIN dígito verificador** |
| `nro_factura` | `int` | `698201` | Para tipo_movimiento="E" |
| `nro_guia_despacho` | `int` | `555611478` | Para tipo_movimiento="S" |
| `codigo_despacho` | `int` | `500015864` | Omitir si es 0 o NULL |
| `lote` | `string` | `"ABCD1234"` | - |
| `fecha_vencimiento` | `string` | `"2026-12-31"` | Formato YYYY-MM-DD |
| `codigo_gtin` | `string` | `"7801234567890"` | Código de barras |

---

## ✅ Reglas de Validación

### 1. codigo_generico (CRÍTICO)
```typescript
❌ RECHAZADO: codigo_generico = 0
❌ RECHAZADO: codigo_generico = "0"
❌ RECHAZADO: codigo_generico = null
✅ ACEPTADO:  codigo_generico = 100000122 (código ZGEN válido)
```

**Error si es 0**:
```
"Producto 5550980: codigo_generico es obligatorio y no puede ser 0.
Debe ser el código ZGEN de CENABAST."
```

### 2. rut_proveedor (Opcional)
```typescript
❌ RECHAZADO: "96.519.830-K"  // Con puntos y DV
❌ RECHAZADO: "96519830-K"    // Con DV
✅ ACEPTADO:  96519830         // Int sin DV
```

**Transformación automática**:
```typescript
limpiarRut("96.519.830-K") → 96519830
limpiarRut("96519830-K")   → 96519830
limpiarRut(96519830)       → 96519830
```

### 3. nro_factura / nro_guia_despacho (Opcional)
```typescript
❌ RECHAZADO: "698201"     // String
❌ RECHAZADO: "FACTURA-1"  // String con letras
✅ ACEPTADO:  698201        // Int
```

### 4. codigo_despacho (Opcional)
```typescript
❌ MALO:     codigo_despacho: 0    // Valor inútil
✅ MEJOR:    // Campo omitido
✅ CORRECTO: codigo_despacho: 500015864  // Valor válido
```

---

## 🧪 Ejemplo de Transformación

### Input (desde BD):
```json
{
  "codigo_interno": "5550980",
  "codigo_generico": "100000122",  // String
  "cantidad": 1000,
  "rut_proveedor": "96.519.830-K", // Con puntos y DV
  "nro_factura": "698201",          // String
  "codigo_despacho": 0              // Cero inútil
}
```

### Output (enviado a CENABAST):
```json
{
  "codigo_interno": "5550980",
  "codigo_generico": 100000122,  // Int ✅
  "cantidad": 1000,
  "rut_proveedor": 96519830,     // Int sin DV ✅
  "nro_factura": 698201           // Int ✅
  // codigo_despacho omitido ✅
}
```

---

## 📊 Flujo de Validación

```
1. Obtener datos de BD (con formatos incorrectos)
   ↓
2. Aplicar transformarMovimientoParaCenabast()
   ↓
3. ¿Hay errores críticos?
   ├─ SÍ → Retornar error 400 con detalles
   └─ NO → Continuar
   ↓
4. ¿Hay warnings? (ej: codigo_generico = 0)
   ├─ SÍ → Mostrar en logs
   └─ NO → Continuar
   ↓
5. Enviar datos transformados a Mirth/CENABAST
```

---

## 🚨 Errores Comunes y Soluciones

### Error: "Modelo no válido"
**Causa**: Tipos de datos incorrectos

**Solución**: Las transformaciones ahora corrigen automáticamente:
- ✅ Limpia RUTs (remueve DV)
- ✅ Convierte strings a int
- ✅ Omite campos con valor 0 o NULL

### Error: "codigo_generico no puede ser 0"
**Causa**: Producto sin código ZGEN en BD

**Solución**:
1. Consultar código ZGEN en API CENABAST:
   ```
   GET /recurso/producto?nombre_producto=PARACETAMOL
   ```
2. Actualizar tabla de mapeo código_interno → codigo_generico
3. Actualizar BD con código ZGEN correcto

---

## 📝 Logs Mejorados

### Antes:
```
[API] Enviando a Mirth: {...}
```

### Ahora:
```
[API] Datos RAW: {rut_proveedor: "96519830-K"}
[API] TRANSFORMACIÓN: {rut_proveedor: 96519830}
[API] Warnings: Producto X: codigo_generico es 0
[API] Enviando a Mirth: {datos transformados}
```

---

## ✅ Checklist de Verificación

- [x] Librería de transformación creada
- [x] Endpoint principal actualizado
- [x] Scheduler actualizado
- [x] Endpoint de pruebas actualizado
- [x] Validaciones implementadas
- [x] Warnings para codigo_generico = 0
- [x] RUTs limpiados (sin DV)
- [x] Números como int (no string)
- [x] Campos con 0 omitidos
- [x] Logs descriptivos
- [x] Documentación completa

---

## 🎯 Resultado Final

### Antes:
```
❌ Error 400: "Modelo no válido"
❌ Datos rechazados por CENABAST
❌ No se sabía qué estaba mal
```

### Ahora:
```
✅ Datos validados antes de enviar
✅ Transformaciones automáticas aplicadas
✅ Errores claros si falta codigo_generico
✅ Warnings si codigo_generico es 0
✅ Cumple 100% con especificación CENABAST v1.9
```

---

## 📚 Referencias

- **Guía Técnica**: API Usuarios CENABAST v1.9 (25 septiembre 2025)
- **Documentación interna**: `FILTROS_MOVIMIENTOS.md`
- **Código fuente**: `src/lib/cenabast-transform.ts`

---

**Última actualización**: 2025-12-17
**Versión**: 1.0
**Estado**: ✅ Producción
