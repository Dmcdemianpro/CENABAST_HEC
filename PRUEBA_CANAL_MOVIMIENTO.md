# Prueba del Canal de Movimiento CENABAST

**Fecha**: 2025-12-17
**Propósito**: Verificar que el canal de Movimiento en Mirth Connect funciona correctamente
**Estado**: Herramientas de prueba disponibles

---

## 🎯 Problema Identificado

En Mirth Connect (canal CENABAST_004_Movimiento), los mensajes aparecen como **FILTERED** y no se puede confirmar si el canal está procesando correctamente.

**Error visible**:
```
Token de autorización requerido. Enviar header: Authorization: Bearer <token>
```

---

## 🛠️ Herramientas de Prueba Creadas

### 1. **Endpoint de Prueba API**
**Archivo**: `src/app/api/cenabast/movimiento/test/route.ts`

**Funcionalidad**:
- Envía datos dummy al canal de Mirth
- Usa token válido de CENABAST
- Verifica conectividad y procesamiento
- Genera datos realistas según tipo de movimiento

**Uso**:
```
GET /api/cenabast/movimiento/test?tipo=E   → Prueba ENTRADA
GET /api/cenabast/movimiento/test?tipo=S   → Prueba SALIDA
```

---

### 2. **Script PowerShell (Windows)**
**Archivo**: `test-canal-movimiento.ps1`

**Ejecutar**:
```powershell
# Desde la raíz del proyecto
.\test-canal-movimiento.ps1
```

**Características**:
- Menú interactivo
- Colores para fácil lectura
- Muestra respuesta JSON formateada
- Instrucciones de troubleshooting

---

### 3. **Script Bash (Linux/Mac)**
**Archivo**: `test-canal-movimiento.sh`

**Ejecutar**:
```bash
# Dar permisos
chmod +x test-canal-movimiento.sh

# Ejecutar
./test-canal-movimiento.sh
```

---

### 4. **Datos Dummy de Referencia**
**Archivo**: `test-movimiento-dummy.json`

Contiene estructuras de ejemplo para:
- Movimiento de entrada (Factura)
- Movimiento de salida (Guía de Despacho)

---

## 📋 Cómo Probar el Canal

### **Opción 1: Usando el Script PowerShell (Recomendado)**

1. Asegúrate de que el servidor esté corriendo:
   ```powershell
   npm run dev
   ```

2. Ejecuta el script:
   ```powershell
   .\test-canal-movimiento.ps1
   ```

3. Selecciona una opción:
   - `1` → Probar ENTRADA (Factura)
   - `2` → Probar SALIDA (Guía de Despacho)
   - `3` → Probar AMBOS

4. Verifica el resultado:
   - ✅ Verde = Canal funcionando
   - ❌ Rojo = Hay un problema

---

### **Opción 2: Usando curl directamente**

#### Probar ENTRADA:
```bash
curl http://localhost:3000/api/cenabast/movimiento/test?tipo=E
```

#### Probar SALIDA:
```bash
curl http://localhost:3000/api/cenabast/movimiento/test?tipo=S
```

---

### **Opción 3: Desde el navegador**

1. Abre el navegador
2. Ve a: `http://localhost:3000/api/cenabast/movimiento/test?tipo=E`
3. Verás la respuesta JSON directamente

---

## 📊 Datos de Prueba Enviados

### **Entrada (Tipo E - Factura)**
```json
{
  "id_relacion": 286,
  "fecha_movimiento": "2025-12-17",
  "tipo_movimiento": "E",
  "tipo_compra": "C",
  "movimiento_detalle": [
    {
      "codigo_interno": "TEST-ENTRADA-001",
      "codigo_generico": 999001,
      "cantidad": 100,
      "lote": "LOTE-TEST-E-001",
      "fecha_vencimiento": "2026-12-31",
      "rut_proveedor": "76186755-5",
      "nro_factura": "FACTURA-TEST-001",
      "codigo_despacho": 0
    }
  ]
}
```

### **Salida (Tipo S - Guía de Despacho)**
```json
{
  "id_relacion": 286,
  "fecha_movimiento": "2025-12-17",
  "tipo_movimiento": "S",
  "tipo_compra": "C",
  "movimiento_detalle": [
    {
      "codigo_interno": "TEST-SALIDA-001",
      "codigo_generico": 999003,
      "cantidad": 30,
      "lote": "LOTE-TEST-S-001",
      "fecha_vencimiento": "2026-09-20",
      "rut_proveedor": "77354932-K",
      "nro_guia_despacho": "GUIA-TEST-001",
      "codigo_despacho": 0
    }
  ]
}
```

**Nota**: Los datos usan:
- ✅ RUTs válidos (NO 11-101)
- ✅ Tipo de documento correcto (Factura/Guía)
- ✅ Fechas válidas
- ✅ Códigos de producto dummy (999xxx)

---

## ✅ Respuestas Esperadas

### **Caso Exitoso**
```json
{
  "success": true,
  "test": "CANAL DE MOVIMIENTO",
  "tipo": "Entrada",
  "message": "✅ Canal de Movimiento funcionando correctamente",
  "detalles": {
    "items_enviados": 2,
    "fecha_movimiento": "2025-12-17",
    "ruts_validos": ["76186755-5", "76030398-4"],
    "mirth_status": 200,
    "mirth_response": {
      "statusCode": 200,
      "isSuccessful": true
    }
  },
  "siguiente_paso": "Revisar en Mirth Administrator que el mensaje haya sido procesado correctamente"
}
```

### **Caso con Error**
```json
{
  "success": false,
  "test": "CANAL DE MOVIMIENTO",
  "tipo": "Entrada",
  "error": {
    "status": 401,
    "message": "Token de autorización requerido"
  },
  "instrucciones": [
    "1. Verificar que Mirth Connect esté corriendo",
    "2. Verificar que el canal CENABAST_004_Movimiento esté activo",
    "3. Revisar logs del canal en Mirth Administrator",
    "4. Verificar que el token de autorización sea válido"
  ]
}
```

---

## 🔍 Verificación en Mirth Administrator

Después de ejecutar la prueba:

1. Abre **Mirth Connect Administrator**

2. Ve al canal **CENABAST_004_Movimiento**

3. Haz clic en **"Show Messages"**

4. Busca el mensaje más reciente

5. Verifica el estado:
   - **TRANSFORMED** ✅ = Canal funcionando correctamente
   - **FILTERED** ⚠️ = Mensaje filtrado (revisar reglas del canal)
   - **ERROR** ❌ = Hay un problema (revisar logs)

6. Haz clic en el mensaje para ver detalles:
   - Pestaña **"Source"** = Datos enviados
   - Pestaña **"Response"** = Respuesta del servidor
   - Pestaña **"Errors"** = Errores si los hay

---

## 🐛 Troubleshooting

### Error: "No se pudo obtener token de autenticación"

**Causa**: El token de CENABAST no está disponible o expiró

**Solución**:
```bash
# Verificar token en la base de datos
SELECT * FROM TBL_cenabast_token
WHERE token IS NOT NULL
ORDER BY fecha_creacion DESC

# Si no hay token, autenticarse primero
curl -X POST http://localhost:3000/api/cenabast/auth
```

---

### Error: "Cannot connect to Mirth"

**Causa**: Mirth Connect no está corriendo o no es accesible

**Solución**:
1. Verificar que Mirth Connect esté corriendo
2. Verificar la IP y puerto en `.env.local`:
   ```
   MIRTH_HOST=10.7.71.64
   ```
3. Hacer ping a Mirth:
   ```bash
   ping 10.7.71.64
   ```

---

### Mensajes aparecen como FILTERED en Mirth

**Causa**: El canal tiene reglas de filtrado activas

**Solución**:
1. Abre Mirth Administrator
2. Edita el canal CENABAST_004_Movimiento
3. Revisa la pestaña **"Filter"**
4. Verifica que las reglas no bloqueen mensajes legítimos
5. Revisa la pestaña **"Transformer"** para transformaciones

---

### Error: "Token de autorización requerido"

**Causa**: El token no se está enviando correctamente o es inválido

**Solución**:
1. Verificar que el endpoint de prueba obtenga el token:
   ```typescript
   const tokenInfo = await getValidToken();
   ```
2. Verificar que Mirth espere el header correcto:
   ```
   Authorization: Bearer <token>
   ```
3. Revisar la configuración del canal en Mirth

---

## 📝 Logs para Revisar

### En Next.js (Terminal):
```
[TEST] Iniciando prueba de canal de Movimiento: ENTRADA
[TEST] Token obtenido correctamente
[TEST] Datos de prueba preparados: {...}
[TEST] Enviando a Mirth: http://10.7.71.64:6664/cenabast/movimiento
[TEST] Respuesta de Mirth: 200 {...}
```

### En Mirth Administrator:
1. Dashboard → Logs
2. Filtrar por canal: CENABAST_004_Movimiento
3. Buscar mensajes recientes
4. Revisar errores o warnings

---

## 🎯 Checklist de Verificación

Antes de ejecutar la prueba, verifica:

- [ ] Next.js corriendo (`npm run dev`)
- [ ] Mirth Connect corriendo
- [ ] Base de datos SQL Server accesible
- [ ] Token de CENABAST disponible
- [ ] Canal CENABAST_004_Movimiento activo en Mirth
- [ ] Variables de entorno configuradas (`.env.local`)

---

## 📚 Archivos Relacionados

- **Endpoint de prueba**: `src/app/api/cenabast/movimiento/test/route.ts`
- **Script PowerShell**: `test-canal-movimiento.ps1`
- **Script Bash**: `test-canal-movimiento.sh`
- **Datos dummy**: `test-movimiento-dummy.json`
- **Documentación filtros**: `FILTROS_MOVIMIENTOS.md`
- **API principal**: `src/app/api/cenabast/movimiento/informar/route.ts`

---

## 🚀 Ejecución Rápida

```powershell
# Windows PowerShell - Rápido
.\test-canal-movimiento.ps1

# Bash - Rápido
./test-canal-movimiento.sh

# curl - Rápido
curl http://localhost:3000/api/cenabast/movimiento/test?tipo=E
```

---

**Última actualización**: 2025-12-17
**Autor**: Sistema de testing CENABAST Dashboard
**Versión**: 1.0
