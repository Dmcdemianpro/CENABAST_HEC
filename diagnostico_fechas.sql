-- =====================================================
-- DIAGNÓSTICO DE FECHAS - CENABAST Dashboard
-- =====================================================
-- Script para identificar fechas inválidas que podrían
-- causar el error SqlDateTime overflow
-- =====================================================

USE [TU_BASE_DE_DATOS];  -- Reemplazar con el nombre de tu BD
GO

PRINT '=== DIAGNÓSTICO DE FECHAS INVÁLIDAS ===';
PRINT '';

-- =====================================================
-- 1. TABLA: TBL_existencias_cenabast
-- =====================================================
PRINT '1. Verificando TBL_existencias_cenabast...';
PRINT '';

-- 1.1 Fechas NULL en fechaCorte
PRINT '1.1 Registros con fechaCorte NULL:';
SELECT
    COUNT(*) AS total_null,
    'TBL_existencias_cenabast.fechaCorte' AS campo_afectado
FROM TBL_existencias_cenabast
WHERE fechaCorte IS NULL;
PRINT '';

-- 1.2 Fechas fuera de rango SQL (< 1753-01-01)
PRINT '1.2 Registros con fechaCorte antes de 1753-01-01:';
SELECT
    COUNT(*) AS total_invalidas,
    MIN(fechaCorte) AS fecha_minima_encontrada,
    'TBL_existencias_cenabast.fechaCorte' AS campo_afectado
FROM TBL_existencias_cenabast
WHERE fechaCorte < '1753-01-01';
PRINT '';

-- 1.3 Fechas futuras extremas (> año actual + 100)
PRINT '1.3 Registros con fechaCorte en futuro lejano:';
DECLARE @FechaFuturaExtrema DATE = DATEADD(YEAR, 100, GETDATE());
SELECT
    COUNT(*) AS total_futuro_extremo,
    MAX(fechaCorte) AS fecha_maxima_encontrada,
    'TBL_existencias_cenabast.fechaCorte' AS campo_afectado
FROM TBL_existencias_cenabast
WHERE fechaCorte > @FechaFuturaExtrema;
PRINT '';

-- 1.4 Resumen de fechas en existencias
PRINT '1.4 Resumen general de fechaCorte:';
SELECT
    COUNT(*) AS total_registros,
    COUNT(fechaCorte) AS registros_con_fecha,
    COUNT(*) - COUNT(fechaCorte) AS registros_null,
    MIN(fechaCorte) AS fecha_minima,
    MAX(fechaCorte) AS fecha_maxima,
    COUNT(DISTINCT fechaCorte) AS fechas_distintas
FROM TBL_existencias_cenabast;
PRINT '';
PRINT '';

-- =====================================================
-- 2. TABLA: TBL_movimientos_cenabast
-- =====================================================
PRINT '2. Verificando TBL_movimientos_cenabast...';
PRINT '';

-- 2.1 Fechas NULL en fechaMovimiento
PRINT '2.1 Registros con fechaMovimiento NULL:';
SELECT
    COUNT(*) AS total_null,
    'TBL_movimientos_cenabast.fechaMovimiento' AS campo_afectado
FROM TBL_movimientos_cenabast
WHERE fechaMovimiento IS NULL;
PRINT '';

-- 2.2 Fechas NULL en vencimiento
PRINT '2.2 Registros con vencimiento NULL:';
SELECT
    COUNT(*) AS total_null,
    CAST(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM TBL_movimientos_cenabast) AS DECIMAL(5,2)) AS porcentaje,
    'TBL_movimientos_cenabast.vencimiento' AS campo_afectado
FROM TBL_movimientos_cenabast
WHERE vencimiento IS NULL;
PRINT '';

-- 2.3 Fechas inválidas en vencimiento
PRINT '2.3 Registros con vencimiento inválido (< 1753-01-01 o == 0001-01-01):';
SELECT
    COUNT(*) AS total_invalidas,
    'TBL_movimientos_cenabast.vencimiento' AS campo_afectado
FROM TBL_movimientos_cenabast
WHERE vencimiento < '1753-01-01'
   OR CAST(vencimiento AS VARCHAR(10)) = '0001-01-01';
PRINT '';

-- 2.4 Ejemplos de fechas problemáticas
PRINT '2.4 Ejemplos de registros con fechas problemáticas:';
SELECT TOP 10
    codigo,
    codigo_zgen,
    fechaMovimiento,
    vencimiento,
    cantidad,
    CASE
        WHEN fechaMovimiento IS NULL THEN 'fechaMovimiento NULL'
        WHEN vencimiento IS NULL THEN 'vencimiento NULL'
        WHEN vencimiento < '1753-01-01' THEN 'vencimiento antes de 1753'
        WHEN CAST(vencimiento AS VARCHAR(10)) = '0001-01-01' THEN 'vencimiento == 0001-01-01'
        ELSE 'OK'
    END AS problema
FROM TBL_movimientos_cenabast
WHERE fechaMovimiento IS NULL
   OR vencimiento IS NULL
   OR vencimiento < '1753-01-01'
   OR CAST(vencimiento AS VARCHAR(10)) = '0001-01-01';
PRINT '';

-- 2.5 Resumen de fechas en movimientos
PRINT '2.5 Resumen general de movimientos:';
SELECT
    COUNT(*) AS total_registros,
    COUNT(fechaMovimiento) AS registros_con_fechaMovimiento,
    COUNT(vencimiento) AS registros_con_vencimiento,
    MIN(fechaMovimiento) AS fechaMov_minima,
    MAX(fechaMovimiento) AS fechaMov_maxima,
    MIN(CASE WHEN vencimiento >= '1753-01-01' THEN vencimiento END) AS vencimiento_minimo_valido,
    MAX(vencimiento) AS vencimiento_maximo
FROM TBL_movimientos_cenabast;
PRINT '';
PRINT '';

-- =====================================================
-- 3. SOLUCIONES SUGERIDAS
-- =====================================================
PRINT '3. SOLUCIONES PARA PROBLEMAS ENCONTRADOS:';
PRINT '';

PRINT '3.1 Para fechas NULL:';
PRINT '    - El sistema ahora las sanitiza automáticamente';
PRINT '    - Los campos con NULL se omiten del envío';
PRINT '    - No requiere acción manual';
PRINT '';

PRINT '3.2 Para fechas < 1753-01-01:';
PRINT '    - SQL de corrección (EJEMPLO):';
PRINT '    UPDATE TBL_movimientos_cenabast';
PRINT '    SET vencimiento = NULL';
PRINT '    WHERE vencimiento < ''1753-01-01'';';
PRINT '';

PRINT '3.3 Para fechas == 0001-01-01:';
PRINT '    - SQL de corrección (EJEMPLO):';
PRINT '    UPDATE TBL_movimientos_cenabast';
PRINT '    SET vencimiento = NULL';
PRINT '    WHERE CAST(vencimiento AS VARCHAR(10)) = ''0001-01-01'';';
PRINT '';

PRINT '3.4 Verificación después de correcciones:';
PRINT '    - Ejecutar este script nuevamente';
PRINT '    - Verificar que total_invalidas = 0';
PRINT '';

-- =====================================================
-- 4. RESUMEN FINAL
-- =====================================================
PRINT '=== RESUMEN FINAL ===';
PRINT '';

DECLARE @ProblemasEncontrados INT = 0;

SELECT @ProblemasEncontrados =
    (SELECT COUNT(*) FROM TBL_existencias_cenabast WHERE fechaCorte IS NULL) +
    (SELECT COUNT(*) FROM TBL_existencias_cenabast WHERE fechaCorte < '1753-01-01') +
    (SELECT COUNT(*) FROM TBL_movimientos_cenabast WHERE fechaMovimiento IS NULL) +
    (SELECT COUNT(*) FROM TBL_movimientos_cenabast WHERE vencimiento < '1753-01-01') +
    (SELECT COUNT(*) FROM TBL_movimientos_cenabast WHERE CAST(vencimiento AS VARCHAR(10)) = '0001-01-01');

IF @ProblemasEncontrados = 0
BEGIN
    PRINT '✅ No se encontraron fechas inválidas críticas';
    PRINT '   (Fechas NULL en vencimiento son normales y se manejan automáticamente)';
END
ELSE
BEGIN
    PRINT '⚠️  Se encontraron ' + CAST(@ProblemasEncontrados AS VARCHAR(10)) + ' registros con fechas problemáticas';
    PRINT '   Revise los resultados anteriores para más detalles';
    PRINT '   El sistema ahora maneja automáticamente la mayoría de estos casos';
END

PRINT '';
PRINT '=== FIN DEL DIAGNÓSTICO ===';
