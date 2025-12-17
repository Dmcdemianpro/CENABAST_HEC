# Filtros en Módulo de Movimientos CENABAST

**Fecha de Documentación**: 2025-12-17
**Última Actualización**: 2025-12-17

---

## 📋 Resumen Ejecutivo

El módulo de movimientos aplica **filtros obligatorios** según normativas internas y requerimientos de CENABAST. Estos filtros NO deben eliminarse ya que cumplen funciones críticas para la correcta operación del sistema.

---

## 🎯 Filtros Aplicados

### 1. Filtro de Tipo de Documento
**Regla**: Solo se envían documentos de tipo `'Factura'` o `'Guia Despacho'`

```sql
AND m.tipoDocumento IN ('Factura','Guia Despacho')
```

**Justificación**:
- Requerimiento oficial de CENABAST
- Solo estos tipos de documento son válidos para reportar movimientos
- Otros tipos de documento (notas de crédito, comprobantes internos, etc.) no son aceptados

**Archivos que lo implementan**:
- `src/app/api/cenabast/movimiento/informar/route.ts` (líneas 144, 150)
- `src/app/api/cenabast/scheduler/execute/route.ts` (líneas 217, 235)

---

### 2. Filtro de RUT Interno (11-101)
**Regla**: Se excluyen movimientos con RUT `'11-101'`

```sql
AND ISNULL(m.rut,'') <> '11-101'
```

**Justificación**:
- **RUT 11-101** = Identificador interno del **Hospital del Carmen**
- Movimientos con este RUT son **movimientos INTERNOS** del hospital
- Los movimientos internos **NO deben reportarse** a CENABAST
- Solo se reportan movimientos con **proveedores externos**

**Ejemplo de Caso Real**:
```
Fecha: 2025-12-02
Tipo: Salida (S)

Total movimientos: 3
├─ Con tipo documento válido: 3
├─ RUT 11-101 (internos): 3
└─ Válidos para enviar: 0 ✅ CORRECTO

Resultado: No se envía nada a CENABAST (comportamiento esperado)
```

**Archivos que lo implementan**:
- `src/app/api/cenabast/movimiento/informar/route.ts` (líneas 145, 152)
- `src/app/api/cenabast/scheduler/execute/route.ts` (líneas 219, 237)

---

## 📊 Diagnóstico de Filtros

El sistema incluye logs detallados para diagnosticar el comportamiento de los filtros:

### Log Mejorado (Después de las mejoras)
```json
{
  "fecha": "2025-12-02",
  "tipo": "Salida",
  "total_movimientos": 3,
  "con_tipo_valido_factura_guia": 3,
  "movimientos_internos_rut_11101": 3,
  "validos_para_enviar_cenabast": 0,
  "nota": "Movimientos internos (RUT 11-101) NO se reportan a CENABAST"
}
```

---

## 🔍 Ejemplo de Movimientos Válidos vs Excluidos

### ✅ Movimientos VÁLIDOS (se envían a CENABAST)
```
RUT: 76186755-5 (Proveedor externo)
Tipo Documento: Factura
Número: 19818
Cantidad: 2100 unidades
Estado: ✅ Se envía a CENABAST
```

### ❌ Movimientos EXCLUIDOS (NO se envían)
```
RUT: 11-101 (Hospital del Carmen - Interno)
Tipo Documento: Guía de Despacho
Número: 12345
Cantidad: 50 unidades
Estado: ❌ Excluido - Movimiento interno
```

---

## 📝 Mensajes al Usuario

### Antes (Mensaje Genérico)
```json
{
  "success": true,
  "message": "No hay movimientos para informar en esta fecha",
  "count": 0
}
```

### Después (Mensaje Descriptivo)
```json
{
  "success": true,
  "message": "No hay movimientos de salidas para reportar a CENABAST en esta fecha. Se encontraron 3 movimientos internos del hospital (RUT 11-101) que no se reportan a CENABAST",
  "count": 0,
  "diagnostico": {
    "total_movimientos": 3,
    "con_tipo_valido": 3,
    "internos_excluidos": 3,
    "validos_para_enviar": 0,
    "fecha_consultada": "2025-12-02",
    "tipo_movimiento": "Salida"
  }
}
```

---

## 🛠️ Mantenimiento

### Agregar Nuevo RUT Interno a Excluir
Si se necesita excluir otro RUT interno en el futuro:

```sql
-- Modificar en ambos archivos:
-- movimiento/informar/route.ts
-- scheduler/execute/route.ts

-- Antes:
AND ISNULL(m.rut,'') <> '11-101'

-- Después:
AND ISNULL(m.rut,'') NOT IN ('11-101', 'NUEVO-RUT')
```

### Agregar Nuevo Tipo de Documento
Si CENABAST acepta un nuevo tipo de documento:

```sql
-- Modificar en ambos archivos:
-- movimiento/informar/route.ts
-- scheduler/execute/route.ts

-- Antes:
AND m.tipoDocumento IN ('Factura','Guia Despacho')

-- Después:
AND m.tipoDocumento IN ('Factura','Guia Despacho','NuevoTipo')
```

---

## 🚨 Importante: NO Eliminar Estos Filtros

### ⚠️ Consecuencias de Eliminar Filtros

1. **Eliminar filtro de tipo documento**:
   - ❌ Se enviarían documentos inválidos a CENABAST
   - ❌ API de CENABAST rechazaría las peticiones
   - ❌ Errores constantes en los logs

2. **Eliminar filtro RUT 11-101**:
   - ❌ Se reportarían movimientos internos a CENABAST
   - ❌ Datos incorrectos en sistema CENABAST
   - ❌ Incumplimiento de normativas internas

---

## 📚 Referencias

- **Guía CENABAST v1.9**: Especifica tipos de documento válidos
- **Normativa Interna**: Hospital del Carmen - Movimientos internos
- **Archivo de cambios**: `CAMBIOS_FILTROS_v1.9.md`

---

## 🧪 Testing

### Query de Diagnóstico
Ejecutar para validar filtros:

```sql
-- Ver distribución de movimientos por RUT
SELECT
    ISNULL(m.rut, '(NULL)') AS rut_proveedor,
    m.tipoDocumento,
    COUNT(*) AS total,
    SUM(CASE WHEN m.cantidad > 0 THEN 1 ELSE 0 END) AS entradas,
    SUM(CASE WHEN m.cantidad < 0 THEN 1 ELSE 0 END) AS salidas,
    CASE
        WHEN ISNULL(m.rut,'') = '11-101' THEN '❌ Interno - No reportar'
        WHEN m.tipoDocumento IN ('Factura','Guia Despacho') THEN '✅ Válido - Reportar'
        ELSE '⚠️ Tipo documento no válido'
    END AS estado
FROM TBL_movimientos_cenabast m
WHERE CAST(m.fechaMovimiento AS DATE) = '2025-12-02'
GROUP BY ISNULL(m.rut, '(NULL)'), m.tipoDocumento
ORDER BY total DESC;
```

---

## ✅ Checklist de Validación

Antes de hacer cambios en los filtros, verificar:

- [ ] ¿El cambio cumple con normativa CENABAST?
- [ ] ¿El cambio cumple con políticas internas del hospital?
- [ ] ¿Se actualizaron AMBOS archivos (API + Scheduler)?
- [ ] ¿Se actualizó la documentación?
- [ ] ¿Se probó con datos reales?
- [ ] ¿Los logs siguen siendo descriptivos?

---

**Documento creado**: 2025-12-17
**Autor**: Sistema de documentación CENABAST Dashboard
**Versión**: 1.0
