# Script de PowerShell para probar canal de Movimiento CENABAST
# Fecha: 2025-12-17
# Propósito: Enviar datos dummy al canal de Mirth para verificar funcionamiento

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "TEST - Canal de Movimiento CENABAST" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Configuración
$BASE_URL = "http://localhost:3000"
$API_ENDPOINT_ENTRADA = "$BASE_URL/api/cenabast/movimiento/test?tipo=E"
$API_ENDPOINT_SALIDA = "$BASE_URL/api/cenabast/movimiento/test?tipo=S"

Write-Host "📋 Opciones de prueba:" -ForegroundColor Yellow
Write-Host "  1. Probar ENTRADA (E) - Factura"
Write-Host "  2. Probar SALIDA (S) - Guía de Despacho"
Write-Host "  3. Probar AMBOS"
Write-Host ""

$opcion = Read-Host "Selecciona una opción (1, 2 o 3)"

function Test-Movimiento {
    param(
        [string]$Url,
        [string]$Tipo
    )

    Write-Host ""
    Write-Host "🧪 Probando movimiento de $Tipo..." -ForegroundColor Cyan
    Write-Host "URL: $Url" -ForegroundColor Gray
    Write-Host ""

    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -ContentType "application/json"

        if ($response.success) {
            Write-Host "✅ ÉXITO - Canal funcionando correctamente" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Detalles:" -ForegroundColor Yellow
            Write-Host "  • Tipo: $($response.tipo)"
            Write-Host "  • Items enviados: $($response.detalles.items_enviados)"
            Write-Host "  • Fecha movimiento: $($response.detalles.fecha_movimiento)"
            Write-Host "  • Mirth status: $($response.detalles.mirth_status)"
            Write-Host ""
            Write-Host "📝 Siguiente paso:" -ForegroundColor Yellow
            Write-Host "  $($response.siguiente_paso)"
            Write-Host ""
        } else {
            Write-Host "❌ ERROR - El canal no está funcionando correctamente" -ForegroundColor Red
            Write-Host ""
            Write-Host "⚠️ Error:" -ForegroundColor Yellow
            Write-Host "  $($response.error.message)" -ForegroundColor Red
            Write-Host ""
            if ($response.instrucciones) {
                Write-Host "📋 Instrucciones para solucionar:" -ForegroundColor Yellow
                foreach ($inst in $response.instrucciones) {
                    Write-Host "  $inst"
                }
                Write-Host ""
            }
        }

        # Mostrar respuesta completa en formato JSON
        Write-Host "📄 Respuesta completa (JSON):" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 10

    } catch {
        Write-Host "❌ ERROR - No se pudo conectar al servidor" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Verifica que:" -ForegroundColor Yellow
        Write-Host "  • El servidor Next.js esté corriendo (npm run dev)"
        Write-Host "  • El puerto 3000 esté disponible"
        Write-Host "  • Mirth Connect esté corriendo"
    }
}

switch ($opcion) {
    "1" {
        Test-Movimiento -Url $API_ENDPOINT_ENTRADA -Tipo "ENTRADA"
    }
    "2" {
        Test-Movimiento -Url $API_ENDPOINT_SALIDA -Tipo "SALIDA"
    }
    "3" {
        Test-Movimiento -Url $API_ENDPOINT_ENTRADA -Tipo "ENTRADA"
        Test-Movimiento -Url $API_ENDPOINT_SALIDA -Tipo "SALIDA"
    }
    default {
        Write-Host "❌ Opción inválida" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Prueba completada" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
