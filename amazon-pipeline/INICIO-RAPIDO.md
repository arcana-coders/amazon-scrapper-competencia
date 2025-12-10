# Inicio Rápido - Amazon Pipeline

## ¿Qué hace este pipeline?

Este sistema automatiza TODO el proceso de vendedores Amazon:
1. Toma automáticamente los vendedores registrados en el MENU principal (`projects.json`)
2. Los procesa uno por uno, ejecutando todas las fases:
   - Plan de batches
   - Scraping de productos
   - Consolidación de datos
   - Verificación México
   - Verificación USA
   - Análisis de oportunidades
3. Muestra progreso en tiempo real
4. Continúa automáticamente hasta completar todos los vendedores

## Iniciar el Pipeline (Método Simple)

### Opción 1: Doble clic
```
1. Navega a la carpeta: C:\robots\amazon-scrapper-otherseller\amazon-pipeline
2. Haz doble clic en: start-pipeline.bat
```

### Opción 2: Desde la terminal
```bash
cd C:\robots\amazon-scrapper-otherseller\amazon-pipeline
node pipeline-orchestrator.js start
```

## ¿Qué pasará cuando lo inicies?

1. **Validación**: Verificará que todos los scripts necesarios existan
2. **Sincronización**: Leerá automáticamente los vendedores de `projects.json`
3. **Procesamiento**: Comenzará a procesar vendedores automáticamente
4. **Dashboard**: Mostrará progreso en tiempo real cada segundo

## Dashboard en Tiempo Real

Verás algo como esto:

```
═══════════════════════════════════════════════════════════════════
 🟢 PIPELINE AUTOMÁTICO - EN EJECUCIÓN
═══════════════════════════════════════════════════════════════════

📍 VENDEDOR ACTUAL: A2529Q8MW27A5W
   └─ 🔄 Fase: plan
   └─ ⏱️  Tiempo en proceso: 2m 15s
   └─ 📦 Batch: 3/10
   └─ 🛍️  Productos: 150/500

   ESTADO DE FASES:
   ✅ plan
   🔄 scraping
   ⬜ consolidation
   ⬜ verificar_mx
   ⬜ verificar_usa
   ⬜ oportunidades

───────────────────────────────────────────────────────────────────
📋 COLA DE ESPERA (31 pendientes):
   1. A2CINPW5JHJUKV [6 fases]
   2. A27UCZ6SHTD3J2 [6 fases]
   3. AE8MUNDUREHX7 [6 fases]
   ... y 28 más

📊 ESTADÍSTICAS SESIÓN:
   ✓ Completados: 0
   ❌ Errores:    0
```

## Controles Disponibles

### Pausar el Pipeline
Presiona `Ctrl+C` una vez
- Terminará la fase actual
- Guardará el estado
- Podrás reanudar después

### Reanudar
```bash
node pipeline-orchestrator.js resume
node pipeline-orchestrator.js start
```

### Ver Estado
```bash
node pipeline-orchestrator.js status
```

### Limpiar Cola
```bash
node pipeline-orchestrator.js clear
```

### Agregar Vendedor Manual
```bash
node pipeline-orchestrator.js add A1234567890ABC
```

## Logs

Los logs se guardan automáticamente en:
```
C:\robots\amazon-scrapper-otherseller\logs\pipeline\
```

- `pipeline-YYYY-MM-DD.log` - Log general
- `<SELLER_ID>-YYYY-MM-DD.log` - Log por vendedor

## Tiempos Estimados

- **Entre fases**: 5 segundos
- **Entre vendedores**: 5 minutos (para evitar bloqueos)
- **Tiempo por vendedor**: Variable según cantidad de productos
  - Vendedor pequeño (~100 productos): ~15-30 minutos
  - Vendedor mediano (~500 productos): ~1-2 horas
  - Vendedor grande (~1000+ productos): ~3-5 horas

## Sistema de Reintentos

El pipeline reintenta automáticamente si falla una fase:
- **Fases con reintentos**: scraping, verificar_mx, verificar_usa
- **Máximo de intentos**: 3
- **Delay entre reintentos**: 10 minutos

## ¿Qué hacer si algo sale mal?

### El pipeline no encuentra vendedores
- Verifica que existan vendedores en `data/projects.json`
- Usa el MENU principal para registrar vendedores primero

### Un vendedor se atascó
1. Presiona `Ctrl+C` para pausar
2. Ejecuta: `node pipeline-orchestrator.js clear`
3. Reinicia: `node pipeline-orchestrator.js start`

### Errores en una fase específica
1. Revisa los logs en `logs/pipeline/`
2. Busca el archivo del vendedor: `<SELLER_ID>-YYYY-MM-DD.log`
3. Identifica el error
4. Corrige el problema
5. Reinicia el pipeline

### Ver qué está haciendo actualmente
```bash
node pipeline-orchestrator.js status
```

## Importante

1. **No cierres la terminal** mientras el pipeline está corriendo
2. **Mantén las cookies de Amazon actualizadas**
3. **Revisa los logs** periódicamente para detectar problemas
4. **El pipeline es completamente automático** - no necesitas intervenir
5. **Usa Ctrl+C** para detener limpiamente (nunca cierres la ventana directamente)

## Estado del Pipeline

El estado se guarda en:
```
C:\robots\amazon-scrapper-otherseller\amazon-pipeline\pipeline-state.json
```

Este archivo contiene:
- Cola actual de vendedores
- Vendedor siendo procesado
- Progreso de cada fase
- Historial de vendedores completados
- Estadísticas de la sesión

## Ejemplo de Uso Completo

```bash
# 1. Abrir terminal en la carpeta
cd C:\robots\amazon-scrapper-otherseller\amazon-pipeline

# 2. Iniciar pipeline
node pipeline-orchestrator.js start

# El pipeline ahora:
# - Detecta los 32 vendedores en projects.json
# - Los procesa uno por uno automáticamente
# - Muestra progreso en tiempo real
# - Guarda logs de todo lo que hace
# - Continúa hasta completar todos o hasta que lo detengas

# 3. Dejar corriendo y monitorear ocasionalmente
# El pipeline continuará solo...

# 4. Si necesitas pausar:
# Ctrl+C

# 5. Para reanudar más tarde:
node pipeline-orchestrator.js resume
node pipeline-orchestrator.js start
```

## Soporte

Para más información, consulta `README.md` en esta carpeta.
