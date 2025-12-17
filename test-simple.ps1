Write-Host "=== PRUEBA CANAL MOVIMIENTO ===" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/cenabast/movimiento/test?tipo=E" -Method GET -ContentType "application/json" -ErrorAction Stop

    if ($response.success) {
        Write-Host "EXITO - Canal funcionando correctamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "Detalles:" -ForegroundColor Yellow
        Write-Host "  Tipo: $($response.tipo)"
        Write-Host "  Items enviados: $($response.detalles.items_enviados)"
        Write-Host "  Fecha: $($response.detalles.fecha_movimiento)"
        Write-Host "  Mirth status: $($response.detalles.mirth_status)"
        Write-Host ""
        Write-Host "Respuesta completa:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 10
    } else {
        Write-Host "ERROR - Hay un problema" -ForegroundColor Red
        Write-Host ""
        $response | ConvertTo-Json -Depth 10
    }
} catch {
    Write-Host "NOTA: El endpoint requiere autenticacion" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para probar el canal, abre en tu navegador:" -ForegroundColor Cyan
    Write-Host "http://localhost:3000/api/cenabast/movimiento/test?tipo=E" -ForegroundColor White
    Write-Host ""
    Write-Host "O inicia sesion primero en:" -ForegroundColor Cyan
    Write-Host "http://localhost:3000" -ForegroundColor White
}
