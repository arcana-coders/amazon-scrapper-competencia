# 🧪 GUÍA DE PRUEBA: Solicitud de Plantilla

## 📋 Objetivo
Probar el flujo completo de solicitud de plantilla desde el panel interactivo `buscadordeoportunidades.js`

## ✅ Pre-requisitos
- ✓ Archivos de oportunidades generados (oportunidades.csv, oportunidades_menos_50.csv, oportunidades_menos_100.csv)
- ✓ Cookies de Amazon Seller Central válidas en `scripts/auth/amazonseller.json`
- ✓ Script `solicitar-plantilla-seller.js` funcional

## 🚀 Pasos de la Prueba

### 1. Iniciar el panel
```bash
node buscadordeoportunidades.js
```

### 2. Menú principal
```
¿Qué te gustaría hacer ahora?
[1] Revisar un vendedor en detalle
[2] Mostrar rutas y comandos útiles
[3] Refrescar resumen
[4] Iniciar o continuar trabajo por fases
[5] 🚀 Publicar oportunidades (Fase 4)  ← SELECCIONAR ESTA
[0] Salir
```
**Acción:** Escribir `5` y presionar Enter

### 3. Submenú de publicación
```
🚀 FASE 4: PUBLICACIÓN DE OPORTUNIDADES
─────────────────────────────────────────
¿Qué acción deseas realizar?
[1] 📤 Solicitar plantilla a Amazon  ← SELECCIONAR ESTA
[2] 📥 Descargar plantilla generada
[0] ← Volver al menú principal
```
**Acción:** Escribir `1` y presionar Enter

### 4. Selección de vendedor
```
✅ Encontré 1 vendedor(es) con oportunidades:

[1] A3Q5ASRA7J8Y5E
    Archivos: oportunidades.csv, menos_50.csv, menos_100.csv

Elige el número del vendedor [0 para cancelar]:
```
**Acción:** Escribir `1` y presionar Enter

### 5. Selección de archivo
```
📦 Vendedor seleccionado: A3Q5ASRA7J8Y5E

Elige el archivo a solicitar:
[1] oportunidades.csv (precio sugerido < MX)  ← SELECCIONAR ESTA
[2] oportunidades_menos_50.csv (sugerido -$50 < MX)
[3] oportunidades_menos_100.csv (sugerido -$100 < MX)
[0] Cancelar

Opción:
```
**Acción:** Escribir `1` y presionar Enter

### 6. Verificar ejecución
El sistema debería:
- ✓ Ejecutar `solicitar-plantilla-seller.js A3Q5ASRA7J8Y5E 1`
- ✓ Abrir navegador con Playwright
- ✓ Navegar a Amazon Seller Central
- ✓ Cargar el archivo oportunidades.csv
- ✓ Llenar el textarea con ASINs
- ✓ Hacer clic en "Generar plantilla"
- ✓ Mostrar mensaje de éxito
- ✓ Guardar registro en `data/projects.json`

### 7. Resultado esperado
```
✅ Plantilla solicitada exitosamente.
✅ Registro guardado en projects.json
```

## 🔍 Verificaciones Post-Prueba

### Verificar registro en projects.json
```bash
# PowerShell
$json = Get-Content "data\projects.json" | ConvertFrom-Json
$json.projects.A3Q5ASRA7J8Y5E.publication_requests
```

Debería mostrar algo como:
```json
{
  "oportunidades": {
    "requested_at": "2025-10-11T...",
    "option": "1"
  }
}
```

### Verificar en Amazon Seller Central
1. Ir a: https://sellercentral.amazon.com/product-search/bulk/generate/history
2. Verificar que aparece una solicitud reciente
3. Estado debería ser "En proceso" o "Generando"

## ⏰ Siguiente Paso
- Esperar ~30 minutos
- Ejecutar opción [5] → [2] para descargar la plantilla

## ❌ Solución de Problemas

### Error: "No se encontraron cookies"
```bash
# Ejecutar script de login primero
node scripts/a-login.js
```

### Error: "No se encontró el archivo"
```bash
# Generar archivos de oportunidades
node prepare_business_csv.js A3Q5ASRA7J8Y5E
node buscando_productos_csv.js A3Q5ASRA7J8Y5E
```

### Error: "Timeout al cargar página"
- Verificar conexión a internet
- Verificar que las cookies no expiraron
- Re-ejecutar script de login

## 📊 Registro de Prueba

**Fecha:** _________________
**Hora:** _________________
**Usuario:** _________________

| Paso | Estado | Notas |
|------|--------|-------|
| 1. Iniciar panel | ⬜ | |
| 2. Opción [5] | ⬜ | |
| 3. Opción [1] | ⬜ | |
| 4. Seleccionar vendedor | ⬜ | |
| 5. Seleccionar archivo | ⬜ | |
| 6. Ejecución script | ⬜ | |
| 7. Registro guardado | ⬜ | |
| 8. Verificación Seller Central | ⬜ | |

**Resultado Final:** ⬜ EXITOSO  ⬜ FALLIDO

**Observaciones:**
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
