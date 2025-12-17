# 🔍 DIAGNÓSTICO: Filtros que Bloquean el Envío de Datos

## ❌ PROBLEMA IDENTIFICADO

Los datos se están filtrando excesivamente antes de enviar a Mirth. Aquí están **TODOS los filtros** aplicados:

---

## 📊 CANAL 003 - STOCK (src/app/api/cenabast/stock/informar/route.ts)

### Query SQL (líneas 173-185):

```sql
SELECT
  e.codigo AS codigo_interno,
  TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) AS codigo_generico,
  SUM(e.existencia) AS cantidad_stock,
  MAX(e.descripcion) AS descripcion_producto
FROM TBL_existencias_cenabast e
WHERE e.fechaCorte = @fecha                                                    -- ✅ Filtro 1: Solo fecha específica
  AND e.codigo IS NOT NULL                                                     -- ⚠️  Filtro 2: Excluye NULL en codigo
  AND TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) IS NOT NULL   -- ❌ Filtro 3: ESTE ES PROBLEMÁTICO
  AND e.existencia > 0                                                         -- ✅ Filtro 4: Solo con stock positivo
GROUP BY e.codigo, e.codigo_zgen
```

### 🚨 FILTROS PROBLEMÁTICOS:

#### **Filtro 3: `TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) IS NOT NULL`**

Este filtro está descartando productos si:
- `codigo_zgen` es NULL
- `codigo_zgen` es cadena vacía `''`
- `codigo_zgen` contiene espacios en blanco
- `codigo_zgen` NO es convertible a entero (ej: "ABC", "12-34", etc.)

**EJEMPLOS de datos que SE PIERDEN:**
```
codigo     | codigo_zgen  | ¿Se envía?
-----------|--------------|------------
"PROD001"  | NULL         | ❌ NO
"PROD002"  | ""           | ❌ NO
"PROD003"  | "  "         | ❌ NO
"PROD004"  | "ABC123"     | ❌ NO
"PROD005"  | "12-34"      | ❌ NO
"PROD006"  | "00123"      | ✅ SÍ (se convierte a 123)
"PROD007"  | "456"        | ✅ SÍ
```

---

## 📦 CANAL 004 - MOVIMIENTOS (src/app/api/cenabast/movimiento/informar/route.ts)

### Query SQL para ENTRADAS (líneas 38-53):

```sql
SELECT
  m.codigo AS codigo_interno,
  CAST(m.codigo_zgen AS INT) AS codigo_generico,
  m.cantidad AS cantidad,
  m.numero_lote AS lote,
  CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento,
  m.rut AS rut_proveedor,
  m.numero AS nro_factura,
  0 AS codigo_despacho
FROM TBL_movimientos_cenabast m
WHERE m.cantidad > 0                           -- ✅ Filtro 1: Solo entradas (positivos)
  AND CAST(m.fechaMovimiento AS DATE) = @fecha -- ✅ Filtro 2: Solo fecha específica
  AND m.codigo IS NOT NULL                     -- ⚠️  Filtro 3: Excluye NULL en codigo
  AND m.codigo_zgen IS NOT NULL                -- ❌ Filtro 4: PROBLEMÁTICO
```

### Query SQL para SALIDAS (líneas 38-53):

```sql
WHERE m.cantidad < 0                           -- ✅ Filtro 1: Solo salidas (negativos)
  AND CAST(m.fechaMovimiento AS DATE) = @fecha -- ✅ Filtro 2: Solo fecha específica
  AND m.codigo IS NOT NULL                     -- ⚠️  Filtro 3: Excluye NULL en codigo
  AND m.codigo_zgen IS NOT NULL                -- ❌ Filtro 4: PROBLEMÁTICO
```

### 🚨 FILTROS PROBLEMÁTICOS:

#### **Filtro 4: `m.codigo_zgen IS NOT NULL`**

Este filtro descarta movimientos si `codigo_zgen` es NULL.

**ADEMÁS**, en la línea 41 hay un `CAST(m.codigo_zgen AS INT)` que **FALLARÁ** si `codigo_zgen` contiene valores no numéricos.

---

## 📋 SCHEDULER AUTOMÁTICO (src/app/api/cenabast/scheduler/execute/route.ts)

### Query STOCK (líneas 90-106):

```sql
SELECT
  e.codigo AS codigo_interno,
  CAST(e.codigo_zgen AS INT) AS codigo_generico,  -- ⚠️  CAST directo (puede fallar)
  SUM(e.existencia) AS cantidad_stock,
  0 AS codigo_despacho,
  MAX(e.descripcion) AS descripcion_producto
FROM TBL_existencias_cenabast e
WHERE e.fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND e.codigo IS NOT NULL
  AND e.codigo_zgen IS NOT NULL                   -- ❌ Filtro problemático
GROUP BY e.codigo, e.codigo_zgen
HAVING SUM(e.existencia) > 0
```

### Query MOVIMIENTOS (líneas 152-185):

**ENTRADAS:**
```sql
WHERE m.cantidad > 0
  AND CAST(m.fechaMovimiento AS DATE) = @fecha
  AND m.codigo IS NOT NULL
  AND m.codigo_zgen IS NOT NULL                   -- ❌ Filtro problemático
```

**SALIDAS:**
```sql
WHERE m.cantidad < 0
  AND CAST(m.fechaMovimiento AS DATE) = @fecha
  AND m.codigo IS NOT NULL
  AND m.codigo_zgen IS NOT NULL                   -- ❌ Filtro problemático
```

---

## 🔧 SOLUCIONES PROPUESTAS

### Opción 1: **Permitir codigo_zgen NULL y usar valor por defecto**

```sql
-- STOCK (modificar líneas 173-185)
SELECT
  e.codigo AS codigo_interno,
  ISNULL(TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT), 0) AS codigo_generico,
  SUM(e.existencia) AS cantidad_stock,
  MAX(e.descripcion) AS descripcion_producto
FROM TBL_existencias_cenabast e
WHERE e.fechaCorte = @fecha
  AND e.codigo IS NOT NULL
  -- ELIMINADO: AND TRY_CAST(...) IS NOT NULL
  AND e.existencia > 0
GROUP BY e.codigo, e.codigo_zgen
```

```sql
-- MOVIMIENTOS (modificar líneas 38-53)
SELECT
  m.codigo AS codigo_interno,
  ISNULL(TRY_CAST(m.codigo_zgen AS INT), 0) AS codigo_generico,
  ${tipo_movimiento === "E" ? "m.cantidad" : "ABS(m.cantidad)"} AS cantidad,
  m.numero_lote AS lote,
  CONVERT(VARCHAR(10), m.vencimiento, 23) AS fecha_vencimiento,
  m.rut AS rut_proveedor,
  m.numero AS nro_factura,
  0 AS codigo_despacho
FROM TBL_movimientos_cenabast m
WHERE ${tipo_movimiento === "E" ? "m.cantidad > 0" : "m.cantidad < 0"}
  AND CAST(m.fechaMovimiento AS DATE) = @fecha
  AND m.codigo IS NOT NULL
  -- ELIMINADO: AND m.codigo_zgen IS NOT NULL
```

### Opción 2: **Mantener el filtro pero agregar logging detallado**

Antes de ejecutar el query, agregar un query de diagnóstico:

```sql
-- Ver cuántos registros se están perdiendo
SELECT
  COUNT(*) AS total_registros,
  SUM(CASE WHEN codigo IS NULL THEN 1 ELSE 0 END) AS sin_codigo,
  SUM(CASE WHEN codigo_zgen IS NULL THEN 1 ELSE 0 END) AS sin_codigo_zgen,
  SUM(CASE WHEN TRY_CAST(codigo_zgen AS INT) IS NULL THEN 1 ELSE 0 END) AS codigo_zgen_no_numerico,
  SUM(CASE WHEN existencia <= 0 THEN 1 ELSE 0 END) AS sin_stock
FROM TBL_existencias_cenabast
WHERE fechaCorte = @fecha
```

### Opción 3: **Crear vista limpia**

```sql
-- Crear vista que normaliza los datos
CREATE VIEW vw_existencias_cenabast_limpio AS
SELECT
  codigo AS codigo_interno,
  ISNULL(TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT), 0) AS codigo_generico,
  existencia AS cantidad_stock,
  descripcion AS descripcion_producto,
  fechaCorte
FROM TBL_existencias_cenabast
WHERE codigo IS NOT NULL
  AND existencia > 0
```

---

## 📊 QUERY PARA DIAGNOSTICAR TUS DATOS

Ejecuta esto en SQL Server para ver qué se está perdiendo:

```sql
-- DIAGNÓSTICO COMPLETO DE EXISTENCIAS
SELECT
  'Total registros' AS categoria,
  COUNT(*) AS cantidad
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)

UNION ALL

SELECT
  'Con stock > 0' AS categoria,
  COUNT(*) AS cantidad
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND existencia > 0

UNION ALL

SELECT
  'codigo IS NULL' AS categoria,
  COUNT(*) AS cantidad
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND existencia > 0
  AND codigo IS NULL

UNION ALL

SELECT
  'codigo_zgen IS NULL' AS categoria,
  COUNT(*) AS cantidad
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND existencia > 0
  AND codigo IS NOT NULL
  AND codigo_zgen IS NULL

UNION ALL

SELECT
  'codigo_zgen NO NUMÉRICO' AS categoria,
  COUNT(*) AS cantidad
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND existencia > 0
  AND codigo IS NOT NULL
  AND codigo_zgen IS NOT NULL
  AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL

UNION ALL

SELECT
  'APROBADOS para enviar' AS categoria,
  COUNT(*) AS cantidad
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND existencia > 0
  AND codigo IS NOT NULL
  AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NOT NULL

-- Ver ejemplos de registros rechazados
SELECT TOP 10
  codigo,
  codigo_zgen,
  existencia,
  descripcion,
  'codigo_zgen no numérico' AS razon_rechazo
FROM TBL_existencias_cenabast
WHERE fechaCorte = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast)
  AND existencia > 0
  AND codigo IS NOT NULL
  AND codigo_zgen IS NOT NULL
  AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL
```

---

## 🎯 RECOMENDACIÓN FINAL

1. **Ejecuta el query de diagnóstico** para ver cuántos registros se están perdiendo
2. **Revisa ejemplos** de productos rechazados
3. **Decide** si esos productos deben enviarse o no según las reglas de CENABAST
4. Si deben enviarse: **usa Opción 1** (permitir NULL con valor por defecto 0)
5. Si NO deben enviarse: **usa Opción 2** (mantener filtro + logging)
