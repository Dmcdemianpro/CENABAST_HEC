#!/bin/bash
# ============================================================
# CENABAST - Cron Job para envíos automáticos
# ============================================================
# Este script debe ejecutarse cada 5 minutos via crontab:
# */5 * * * * /path/to/cenabast-cron.sh >> /var/log/cenabast-cron.log 2>&1
# ============================================================

# Configuración
APP_URL="${CENABAST_APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_FILE="/var/log/cenabast-cron.log"

# Función de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Iniciando ejecución de tareas programadas CENABAST..."

# Headers
HEADERS="-H 'Content-Type: application/json'"
if [ -n "$CRON_SECRET" ]; then
    HEADERS="$HEADERS -H 'Authorization: Bearer $CRON_SECRET'"
fi

# Llamar al endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL/api/cenabast/scheduler/execute")

# Separar body y código HTTP
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    # Extraer número de tareas ejecutadas
    EJECUTADAS=$(echo "$BODY" | grep -o '"ejecutadas":[0-9]*' | cut -d':' -f2)
    log "✅ Ejecución completada. Tareas ejecutadas: $EJECUTADAS"
    log "Respuesta: $BODY"
else
    log "❌ Error en ejecución. HTTP Code: $HTTP_CODE"
    log "Respuesta: $BODY"
    exit 1
fi

log "Fin de ejecución"
