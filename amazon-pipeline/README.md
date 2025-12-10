# Amazon Pipeline Orchestrator

Sistema de orquestación automática para procesar vendedores de Amazon de forma secuencial y desatendida.

## Descripción

Este pipeline automatiza todo el flujo de procesamiento de vendedores Amazon, desde la planificación hasta el análisis de oportunidades, ejecutando cada fase de forma secuencial y gestionando una cola de vendedores.

## Características

- **Procesamiento automático**: Toma vendedores de `projects.json` y los procesa automáticamente
- **Cola inteligente**: Gestiona múltiples vendedores en cola con persistencia de estado
- **Dashboard en tiempo real**: Muestra progreso detallado de batches, productos y fases
- **Sincronización automática**: Se sincroniza automáticamente con el MENU principal
- **Recuperación de errores**: Sistema de reintentos para fases críticas
- **Control total**: Comandos para pausar, reanudar y monitorear el pipeline
- **Logs persistentes**: Registro completo de todas las operaciones

## Fases del Pipeline

Cada vendedor pasa por 6 fases automáticamente:

1. **plan** - Planificación de batches (`create-plan-batches.js`)
2. **scraping** - Extracción de productos (`extract-batch-products.js`)
3. **consolidation** - Consolidación de datos (`consolidate-batch-products.js`)
4. **verificar_mx** - Verificación México (`verify-products-mx-batch.js`) - Loop automático
5. **verificar_usa** - Verificación USA (`verify-products-usa-batch.js`) - Loop automático
6. **oportunidades** - Generación de oportunidades consolidadas (`generar-oportunidades-consolidadas.js`)

**Importante sobre la Fase 6:**
- ✅ Genera archivos **consolidados** de todos los batches (MENU Opción [3])
- ✅ División automática en archivos de 500 ASINs máximo
- ✅ Genera 3 tipos: principal, menos-50, menos-100
- ✅ Replica exactamente el proceso manual de MENU

Ver [SCRIPTS-Y-FASES.md](SCRIPTS-Y-FASES.md) para documentación completa.

## Instalación

No requiere instalación adicional. Usa las dependencias del proyecto principal.

## Uso

### Iniciar Pipeline Automático

```bash
cd amazon-pipeline
node pipeline-orchestrator.js start
```

Esto iniciará el pipeline que:
- Sincroniza con `projects.json`
- Procesa todos los vendedores registrados automáticamente
- Muestra progreso en tiempo real
- Continúa procesando hasta completar todos los vendedores

### Comandos Disponibles

```bash
# Ver ayuda
node pipeline-orchestrator.js

# Iniciar procesamiento automático
node pipeline-orchestrator.js start

# Agregar vendedor manualmente
node pipeline-orchestrator.js add <SELLER_ID>

# Pausar pipeline
node pipeline-orchestrator.js pause

# Reanudar pipeline
node pipeline-orchestrator.js resume

# Ver estado actual
node pipeline-orchestrator.js status

# Limpiar cola
node pipeline-orchestrator.js clear
```

## Configuración

La configuración se encuentra en `config/pipeline-config.js`:

### Delays

```javascript
delays: {
  entreFases: 5000,          // 5 segundos entre fases
  entreVendedores: 300000,   // 5 minutos entre vendedores
  entreReintentos: 600000,   // 10 minutos entre reintentos
  actualizarProgreso: 5000   // 5 segundos actualización progreso
}
```

### Reintentos

```javascript
reintentos: {
  maxIntentos: 3,
  fasesRetry: ['verificar_mx', 'verificar_usa', 'scraping']
}
```

## Dashboard

El dashboard muestra en tiempo real:

```
═══════════════════════════════════════════════════════════════════
 🟢 PIPELINE AUTOMÁTICO - EN EJECUCIÓN
═══════════════════════════════════════════════════════════════════

📍 VENDEDOR ACTUAL: A3HNKG44RHL123
   └─ 🔄 Fase: scraping
   └─ ⏱️  Tiempo en proceso: 15m 30s
   └─ 📦 Batch: 5/20
   └─ 🛍️  Productos: 150/500
   └─ 💬 Procesando productos batch 5...

   ESTADO DE FASES:
   ✅ plan
   ✅ scraping
   🔄 consolidation
   ⬜ verificar_mx
   ⬜ verificar_usa
   ⬜ oportunidades

───────────────────────────────────────────────────────────────────
📋 COLA DE ESPERA (3 pendientes):
   1. A2ABCD123 [6 fases]
   2. A1EFGH456 [6 fases]
   3. A3IJKL789 [6 fases]

📊 ESTADÍSTICAS SESIÓN:
   ✓ Completados: 12
   ❌ Errores:    2

───────────────────────────────────────────────────────────────────
💡 Ctrl+C para detener | Comandos: add <id>, pause, resume, status
═══════════════════════════════════════════════════════════════════
```

## Persistencia de Estado

El estado se guarda en `pipeline-state.json`:

```json
{
  "activo": true,
  "pausado": false,
  "vendedorActual": "A3HNKG44RHL123",
  "cola": [...],
  "historial": [...],
  "estadisticas": {
    "vendedoresProcesados": 12,
    "vendedoresConError": 2
  }
}
```

## Logs

Los logs se guardan en `../logs/pipeline/`:
- `pipeline-YYYY-MM-DD.log` - Log general del pipeline
- `<SELLER_ID>-YYYY-MM-DD.log` - Log específico por vendedor

## Funcionamiento

1. **Sincronización**: Al iniciar, lee `projects.json` y agrega vendedores no procesados
2. **Procesamiento**: Toma el primer vendedor de la cola
3. **Fases**: Ejecuta cada fase secuencialmente
4. **Progreso**: Actualiza el dashboard en tiempo real
5. **Finalización**: Mueve el vendedor al historial
6. **Siguiente**: Espera el delay configurado y procesa el siguiente vendedor
7. **Loop**: Continúa hasta que la cola esté vacía
8. **Re-sincronización**: Busca nuevos vendedores automáticamente

## Manejo de Errores

- **Errores recuperables**: Reintenta automáticamente (máx 3 intentos)
- **Errores fatales**: Mueve el vendedor a historial con estado "error"
- **Pausa por error**: No pausa el pipeline, continúa con el siguiente vendedor

### Errores Críticos

Errores que detienen el vendedor actual:
- `ECONNREFUSED` - Sin conexión
- `COOKIES_EXPIRED` - Cookies expiradas
- `AMAZON_BLOCKED` - Bloqueado por Amazon
- `EACCES` - Sin permisos

## Detener el Pipeline

### Detención Limpia

```bash
Ctrl+C
```

El pipeline:
1. Termina la fase actual
2. Guarda el estado
3. Cierra limpiamente

### Detención Manual

```bash
node pipeline-orchestrator.js pause
```

Para reanudar:
```bash
node pipeline-orchestrator.js resume
node pipeline-orchestrator.js start
```

## Troubleshooting

### El pipeline no encuentra vendedores

Verifica que existan vendedores en `../data/projects.json` que no estén en el historial como completados.

### Un vendedor se quedó atascado

```bash
node pipeline-orchestrator.js clear
node pipeline-orchestrator.js add <SELLER_ID>
node pipeline-orchestrator.js start
```

### Ver qué está haciendo

```bash
node pipeline-orchestrator.js status
```

### Limpiar historial

Edita `pipeline-state.json` y vacía el array `historial`:

```json
{
  "historial": []
}
```

## Arquitectura

```
amazon-pipeline/
├── pipeline-orchestrator.js    # Orquestador principal
├── pipeline-state.json          # Estado persistente
├── config/
│   └── pipeline-config.js       # Configuración
├── modules/
│   ├── pipeline-manager.js      # Gestor de estado y cola
│   ├── phase-executor.js        # Ejecutor de fases
│   ├── project-loader.js        # Sincronización con projects.json
│   ├── progress-display.js      # Dashboard visual
│   └── utils/
│       └── display-utils.js     # Utilidades de display
└── README.md
```

## Ejemplo de Uso Completo

```bash
# 1. Navegar a la carpeta
cd amazon-pipeline

# 2. Iniciar pipeline
node pipeline-orchestrator.js start

# El pipeline:
# - Sincroniza con projects.json automáticamente
# - Encuentra vendedores no procesados
# - Los procesa uno por uno
# - Muestra progreso en tiempo real
# - Continúa hasta completar todos

# 3. En otra terminal, monitorear
node pipeline-orchestrator.js status

# 4. Si necesitas pausar
node pipeline-orchestrator.js pause

# 5. Reanudar
node pipeline-orchestrator.js resume
node pipeline-orchestrator.js start
```

## Notas Importantes

- **No cerrar la terminal**: Mantén la terminal abierta mientras el pipeline corre
- **Monitoreo**: El dashboard se actualiza automáticamente cada segundo
- **Delays**: Los delays entre vendedores son importantes para evitar bloqueos de Amazon
- **Estado**: El estado se guarda constantemente, puedes detener y reanudar sin perder progreso
- **Logs**: Revisa los logs en caso de errores para diagnóstico detallado

## Soporte

Para problemas o preguntas, revisa:
1. Los logs en `../logs/pipeline/`
2. El estado en `pipeline-state.json`
3. La configuración en `config/pipeline-config.js`
