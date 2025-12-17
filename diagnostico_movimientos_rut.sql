-- DIAGNÓSTICO: Movimientos con RUT 11-101
-- Fecha: 2025-12-17
-- Propósito: Entender por qué se excluyen movimientos de salida con RUT 11-101

-- 1. Ver todos los movimientos de salida del 2025-12-02
SELECT
    'TODOS LOS MOVIMIENTOS DE SALIDA 2025-12-02' AS Seccion,
    m.codigo AS codigo_interno,
    m.codigo_zgen AS codigo_generico,
    m.cantidad,
    m.rut,
    m.tipoDocumento,
    m.numero AS nro_documento,
    m.fechaMovimiento
FROM TBL_movimientos_cenabast m
WHERE m.cantidad < 0
  AND CAST(m.fechaMovimiento AS DATE) = '2025-12-02'
ORDER BY m.rut;

-- 2. Análisis por RUT
SELECT
    'DISTRIBUCIÓN POR RUT' AS Seccion,
    ISNULL(m.rut, '(NULL)') AS rut_proveedor,
    COUNT(*) AS total_movimientos,
    SUM(ABS(m.cantidad)) AS total_cantidad,
    STRING_AGG(m.tipoDocumento, ', ') AS tipos_documento
FROM TBL_movimientos_cenabast m
WHERE m.cantidad < 0
  AND CAST(m.fechaMovimiento AS DATE) = '2025-12-02'
GROUP BY ISNULL(m.rut, '(NULL)')
ORDER BY total_movimientos DESC;

-- 3. Ver qué es el RUT 11-101 específicamente
SELECT
    'DETALLE RUT 11-101' AS Seccion,
    m.*
FROM TBL_movimientos_cenabast m
WHERE ISNULL(m.rut,'') = '11-101'
  AND m.cantidad < 0
  AND CAST(m.fechaMovimiento AS DATE) = '2025-12-02';

-- 4. Ver todos los RUTs únicos en movimientos de salida
SELECT
    'RUTs ÚNICOS EN SALIDAS' AS Seccion,
    DISTINCT ISNULL(m.rut, '(NULL)') AS rut,
    COUNT(*) AS total_movimientos
FROM TBL_movimientos_cenabast m
WHERE m.cantidad < 0
GROUP BY ISNULL(m.rut, '(NULL)')
ORDER BY total_movimientos DESC;

-- 5. Análisis de tipos de documento
SELECT
    'DISTRIBUCIÓN POR TIPO DOCUMENTO' AS Seccion,
    m.tipoDocumento,
    COUNT(*) AS total,
    COUNT(CASE WHEN ISNULL(m.rut,'') = '11-101' THEN 1 END) AS con_rut_11101,
    COUNT(CASE WHEN ISNULL(m.rut,'') <> '11-101' THEN 1 END) AS con_otros_ruts
FROM TBL_movimientos_cenabast m
WHERE m.cantidad < 0
  AND CAST(m.fechaMovimiento AS DATE) = '2025-12-02'
GROUP BY m.tipoDocumento;

-- 6. Ver si hay movimientos de salida válidos
SELECT
    'MOVIMIENTOS VÁLIDOS SEGÚN FILTROS ACTUALES' AS Seccion,
    m.*
FROM TBL_movimientos_cenabast m
WHERE m.cantidad < 0
  AND CAST(m.fechaMovimiento AS DATE) = '2025-12-02'
  AND m.tipoDocumento IN ('Factura','Guia Despacho')
  AND ISNULL(m.rut,'') <> '11-101';
