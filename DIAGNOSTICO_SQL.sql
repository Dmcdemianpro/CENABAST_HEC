-- ================================================================
-- DIAGNÓSTICO COMPLETO DE FILTROS - CENABAST
-- ================================================================
-- Ejecuta este script en SQL Server Management Studio para ver
-- exactamente qué datos se están filtrando antes de enviar a CENABAST
-- ================================================================

USE dbCenabast;
GO

PRINT '================================================================';
PRINT '🔍 DIAGNÓSTICO DE FILTROS - STOCK';
PRINT '================================================================';
PRINT '';

DECLARE @FechaStock DATE;
SET @FechaStock = (SELECT MAX(fechaCorte) FROM TBL_existencias_cenabast WHERE existencia > 0);

PRINT 'Fecha analizada: ' + CONVERT(VARCHAR(10), @FechaStock, 23);
PRINT '';

-- ================================================================
-- RESUMEN DE FILTROS APLICADOS
-- ================================================================
PRINT '--- RESUMEN DE FILTROS ---';
PRINT '';

SELECT
    categoria AS 'Categoría',
    cantidad AS 'Cantidad',
    CAST(ROUND(cantidad * 100.0 / NULLIF((SELECT COUNT(*) FROM TBL_existencias_cenabast WHERE fechaCorte = @FechaStock), 0), 2) AS VARCHAR) + '%' AS 'Porcentaje'
FROM (
    SELECT
        '1. Total registros en fecha' AS categoria,
        COUNT(*) AS cantidad,
        1 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock

    UNION ALL

    SELECT
        '2. Con stock > 0' AS categoria,
        COUNT(*) AS cantidad,
        2 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock
        AND existencia > 0

    UNION ALL

    SELECT
        '3. ❌ FILTRO 2: codigo IS NULL' AS categoria,
        COUNT(*) AS cantidad,
        3 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock
        AND existencia > 0
        AND codigo IS NULL

    UNION ALL

    SELECT
        '4. ❌ FILTRO 3a: codigo_zgen IS NULL' AS categoria,
        COUNT(*) AS cantidad,
        4 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock
        AND existencia > 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NULL

    UNION ALL

    SELECT
        '5. ❌ FILTRO 3b: codigo_zgen vacío o espacios' AS categoria,
        COUNT(*) AS cantidad,
        5 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock
        AND existencia > 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NOT NULL
        AND LTRIM(RTRIM(codigo_zgen)) = ''

    UNION ALL

    SELECT
        '6. ❌ FILTRO 3c: codigo_zgen NO NUMÉRICO' AS categoria,
        COUNT(*) AS cantidad,
        6 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock
        AND existencia > 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NOT NULL
        AND LTRIM(RTRIM(codigo_zgen)) != ''
        AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL

    UNION ALL

    SELECT
        '7. ✅ APROBADOS para enviar a CENABAST' AS categoria,
        COUNT(*) AS cantidad,
        7 AS orden
    FROM TBL_existencias_cenabast
    WHERE fechaCorte = @FechaStock
        AND existencia > 0
        AND codigo IS NOT NULL
        AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NOT NULL
) AS Resumen
ORDER BY orden;

PRINT '';
PRINT '';

-- ================================================================
-- PRODUCTOS RECHAZADOS - EJEMPLOS
-- ================================================================
PRINT '--- ❌ PRODUCTOS RECHAZADOS (Top 20 por stock) ---';
PRINT '';

SELECT TOP 20
    codigo AS 'Código',
    codigo_zgen AS 'Código ZGEN',
    existencia AS 'Stock',
    descripcion AS 'Descripción',
    CASE
        WHEN codigo IS NULL THEN '❌ codigo IS NULL'
        WHEN codigo_zgen IS NULL THEN '❌ codigo_zgen IS NULL'
        WHEN LTRIM(RTRIM(codigo_zgen)) = '' THEN '❌ codigo_zgen vacío'
        WHEN TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL THEN '❌ codigo_zgen no numérico'
        ELSE 'Desconocido'
    END AS 'Razón Rechazo'
FROM TBL_existencias_cenabast
WHERE fechaCorte = @FechaStock
    AND existencia > 0
    AND (
        codigo IS NULL
        OR codigo_zgen IS NULL
        OR LTRIM(RTRIM(codigo_zgen)) = ''
        OR TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL
    )
ORDER BY existencia DESC;

PRINT '';
PRINT '';

-- ================================================================
-- PRODUCTOS APROBADOS - EJEMPLOS
-- ================================================================
PRINT '--- ✅ PRODUCTOS APROBADOS (Top 20 por stock) ---';
PRINT '';

SELECT TOP 20
    codigo AS 'Código Interno',
    TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) AS 'Código Genérico',
    existencia AS 'Stock',
    descripcion AS 'Descripción'
FROM TBL_existencias_cenabast
WHERE fechaCorte = @FechaStock
    AND codigo IS NOT NULL
    AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NOT NULL
    AND existencia > 0
ORDER BY existencia DESC;

PRINT '';
PRINT '';

-- ================================================================
-- PAYLOAD QUE SE ENVIARÍA A CENABAST (Agrupado)
-- ================================================================
PRINT '--- 📦 PRODUCTOS QUE SE ENVIARÁN (Agrupados por código) ---';
PRINT '';

SELECT
    e.codigo AS 'Código Interno',
    TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) AS 'Código Genérico',
    SUM(e.existencia) AS 'Cantidad Stock Total',
    MAX(e.descripcion) AS 'Descripción'
FROM TBL_existencias_cenabast e
WHERE e.fechaCorte = @FechaStock
    AND e.codigo IS NOT NULL
    AND TRY_CAST(NULLIF(LTRIM(RTRIM(e.codigo_zgen)), '') AS INT) IS NOT NULL
    AND e.existencia > 0
GROUP BY e.codigo, e.codigo_zgen
ORDER BY SUM(e.existencia) DESC;

PRINT '';
PRINT '';
PRINT '================================================================';
PRINT '📋 DIAGNÓSTICO DE FILTROS - MOVIMIENTOS';
PRINT '================================================================';
PRINT '';

DECLARE @FechaMovimiento DATE;
SET @FechaMovimiento = CONVERT(DATE, GETDATE());

PRINT 'Fecha analizada: ' + CONVERT(VARCHAR(10), @FechaMovimiento, 23);
PRINT '';

-- ================================================================
-- MOVIMIENTOS - ENTRADAS
-- ================================================================
PRINT '--- RESUMEN DE FILTROS: ENTRADAS (cantidad > 0) ---';
PRINT '';

SELECT
    categoria AS 'Categoría',
    cantidad AS 'Cantidad'
FROM (
    SELECT
        '1. Total movimientos en fecha' AS categoria,
        COUNT(*) AS cantidad,
        1 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento

    UNION ALL

    SELECT
        '2. Entradas (cantidad > 0)' AS categoria,
        COUNT(*) AS cantidad,
        2 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad > 0

    UNION ALL

    SELECT
        '3. ❌ FILTRO: codigo IS NULL' AS categoria,
        COUNT(*) AS cantidad,
        3 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad > 0
        AND codigo IS NULL

    UNION ALL

    SELECT
        '4. ❌ FILTRO: codigo_zgen IS NULL' AS categoria,
        COUNT(*) AS cantidad,
        4 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad > 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NULL

    UNION ALL

    SELECT
        '5. ✅ APROBADOS para enviar (ENTRADAS)' AS categoria,
        COUNT(*) AS cantidad,
        5 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad > 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NOT NULL
) AS Resumen
ORDER BY orden;

PRINT '';

-- Ejemplos de entradas rechazadas
IF EXISTS (
    SELECT 1 FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad > 0
        AND (codigo IS NULL OR codigo_zgen IS NULL)
)
BEGIN
    PRINT '❌ Ejemplos de ENTRADAS rechazadas:';
    PRINT '';

    SELECT TOP 10
        codigo AS 'Código',
        codigo_zgen AS 'Código ZGEN',
        cantidad AS 'Cantidad',
        numero_lote AS 'Lote',
        CASE
            WHEN codigo IS NULL THEN '❌ codigo IS NULL'
            WHEN codigo_zgen IS NULL THEN '❌ codigo_zgen IS NULL'
            ELSE 'Desconocido'
        END AS 'Razón Rechazo'
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad > 0
        AND (codigo IS NULL OR codigo_zgen IS NULL)
    ORDER BY ABS(cantidad) DESC;
END

PRINT '';
PRINT '';

-- ================================================================
-- MOVIMIENTOS - SALIDAS
-- ================================================================
PRINT '--- RESUMEN DE FILTROS: SALIDAS (cantidad < 0) ---';
PRINT '';

SELECT
    categoria AS 'Categoría',
    cantidad AS 'Cantidad'
FROM (
    SELECT
        '1. Salidas (cantidad < 0)' AS categoria,
        COUNT(*) AS cantidad,
        1 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad < 0

    UNION ALL

    SELECT
        '2. ❌ FILTRO: codigo IS NULL' AS categoria,
        COUNT(*) AS cantidad,
        2 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad < 0
        AND codigo IS NULL

    UNION ALL

    SELECT
        '3. ❌ FILTRO: codigo_zgen IS NULL' AS categoria,
        COUNT(*) AS cantidad,
        3 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad < 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NULL

    UNION ALL

    SELECT
        '4. ✅ APROBADOS para enviar (SALIDAS)' AS categoria,
        COUNT(*) AS cantidad,
        4 AS orden
    FROM TBL_movimientos_cenabast
    WHERE CAST(fechaMovimiento AS DATE) = @FechaMovimiento
        AND cantidad < 0
        AND codigo IS NOT NULL
        AND codigo_zgen IS NOT NULL
) AS Resumen
ORDER BY orden;

PRINT '';
PRINT '';

-- ================================================================
-- ANÁLISIS DE CALIDAD DE DATOS
-- ================================================================
PRINT '================================================================';
PRINT '📊 ANÁLISIS DE CALIDAD DE DATOS';
PRINT '================================================================';
PRINT '';

-- Distribución de valores en codigo_zgen
PRINT '--- Tipos de valores en codigo_zgen (Existencias) ---';
PRINT '';

SELECT
    CASE
        WHEN codigo_zgen IS NULL THEN 'NULL'
        WHEN LTRIM(RTRIM(codigo_zgen)) = '' THEN 'Vacío o espacios'
        WHEN TRY_CAST(codigo_zgen AS INT) IS NOT NULL THEN 'Numérico válido'
        ELSE 'No numérico'
    END AS 'Tipo de valor',
    COUNT(*) AS 'Cantidad',
    CAST(ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM TBL_existencias_cenabast WHERE fechaCorte = @FechaStock AND existencia > 0), 0), 2) AS VARCHAR) + '%' AS 'Porcentaje'
FROM TBL_existencias_cenabast
WHERE fechaCorte = @FechaStock
    AND existencia > 0
GROUP BY
    CASE
        WHEN codigo_zgen IS NULL THEN 'NULL'
        WHEN LTRIM(RTRIM(codigo_zgen)) = '' THEN 'Vacío o espacios'
        WHEN TRY_CAST(codigo_zgen AS INT) IS NOT NULL THEN 'Numérico válido'
        ELSE 'No numérico'
    END
ORDER BY COUNT(*) DESC;

PRINT '';
PRINT '';

-- Ejemplos de valores no numéricos
PRINT '--- Ejemplos de codigo_zgen NO NUMÉRICO ---';
PRINT '';

SELECT DISTINCT TOP 20
    codigo_zgen AS 'Valor',
    COUNT(*) AS 'Ocurrencias',
    LEN(codigo_zgen) AS 'Longitud',
    CASE
        WHEN codigo_zgen LIKE '%[^0-9]%' THEN 'Contiene letras/símbolos'
        ELSE 'Otro'
    END AS 'Tipo'
FROM TBL_existencias_cenabast
WHERE fechaCorte = @FechaStock
    AND existencia > 0
    AND codigo_zgen IS NOT NULL
    AND LTRIM(RTRIM(codigo_zgen)) != ''
    AND TRY_CAST(NULLIF(LTRIM(RTRIM(codigo_zgen)), '') AS INT) IS NULL
GROUP BY codigo_zgen
ORDER BY COUNT(*) DESC;

PRINT '';
PRINT '';
PRINT '================================================================';
PRINT '✅ DIAGNÓSTICO COMPLETADO';
PRINT '================================================================';
PRINT '';
PRINT 'CONCLUSIONES:';
PRINT '1. Revisa los productos/movimientos RECHAZADOS para ver qué se está perdiendo';
PRINT '2. Si hay muchos rechazos por codigo_zgen NULL o no numérico, considera:';
PRINT '   - Limpiar los datos en tu BD (UPDATE para normalizar)';
PRINT '   - Modificar los filtros en el código para usar valor por defecto (0)';
PRINT '3. Los productos APROBADOS son los que SÍ se enviarán a CENABAST';
PRINT '';

GO
