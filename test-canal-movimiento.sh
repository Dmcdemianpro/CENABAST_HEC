#!/bin/bash
# Script bash para probar canal de Movimiento CENABAST
# Fecha: 2025-12-17
# Propósito: Enviar datos dummy al canal de Mirth para verificar funcionamiento

echo "=================================="
echo "TEST - Canal de Movimiento CENABAST"
echo "=================================="
echo ""

# Configuración
BASE_URL="http://localhost:3000"
API_ENDPOINT_ENTRADA="$BASE_URL/api/cenabast/movimiento/test?tipo=E"
API_ENDPOINT_SALIDA="$BASE_URL/api/cenabast/movimiento/test?tipo=S"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📋 Opciones de prueba:${NC}"
echo "  1. Probar ENTRADA (E) - Factura"
echo "  2. Probar SALIDA (S) - Guía de Despacho"
echo "  3. Probar AMBOS"
echo ""

read -p "Selecciona una opción (1, 2 o 3): " opcion

test_movimiento() {
    local url=$1
    local tipo=$2

    echo ""
    echo -e "${CYAN}🧪 Probando movimiento de $tipo...${NC}"
    echo -e "${NC}URL: $url${NC}"
    echo ""

    response=$(curl -s -w "\n%{http_code}" "$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        success=$(echo "$body" | grep -o '"success":true')

        if [ ! -z "$success" ]; then
            echo -e "${GREEN}✅ ÉXITO - Canal funcionando correctamente${NC}"
            echo ""
            echo -e "${YELLOW}📊 Respuesta completa:${NC}"
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        else
            echo -e "${RED}❌ ERROR - El canal respondió pero con error${NC}"
            echo ""
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        fi
    else
        echo -e "${RED}❌ ERROR HTTP $http_code${NC}"
        echo ""
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
}

case $opcion in
    1)
        test_movimiento "$API_ENDPOINT_ENTRADA" "ENTRADA"
        ;;
    2)
        test_movimiento "$API_ENDPOINT_SALIDA" "SALIDA"
        ;;
    3)
        test_movimiento "$API_ENDPOINT_ENTRADA" "ENTRADA"
        test_movimiento "$API_ENDPOINT_SALIDA" "SALIDA"
        ;;
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo "=================================="
echo "Prueba completada"
echo "=================================="
