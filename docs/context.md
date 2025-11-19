# Context - Sesión 18 de Noviembre 2025

## Resumen Ejecutivo
Sesión de depuración y mejora del sistema de automatización. Se corrigieron múltiples errores críticos que causaban loops infinitos y fallos en el procesamiento de vendedores.

---

## Cambios Realizados

### 1. vendor-queue.js - Filtros de Auto-Sync (Líneas 256-335)

**Problema**: La función `syncFromProjects()` agregaba vendedores a la cola que no tenían datos para procesar, causando loops infinitos de errores.

**Solución**: Se agregaron tres filtros críticos:

```javascript
// Filtro 1: Verificar que el directorio existe
const vendorDir = getVendorDir(sellerId);
if (!fs.existsSync(vendorDir)) {
  continue; // Vendedor solo "descubierto" pero sin directorio
}

// Filtro 2: Verificar que tiene batches O archivos consolidados
const hasBatches = projects[sellerId].batches && projects[sellerId].batches.length > 0;
const batchFiles = getBatchConsolidatedFiles(sellerId);
const hasConsolidated = batchFiles.length > 0 ||
  fs.existsSync(path.join(vendorDir, 'all-products-consolidated.json'));

if (!hasBatches && !hasConsolidated) {
  continue; // No está listo para automatización
}

// Filtro 3: Solo fases 1-4 (no fase 5 completada)
if (phaseInfo.phase >= 1 && phaseInfo.phase < 5) {
  // Agregar a cola
}
```

**Archivos afectados**: `automation/vendor-queue.js`

---

### 2. daily-workflow.js - Soporte para Verificación por Batches (Líneas 197-298)

**Problema**: Las funciones `verifyAllMX()` y `verifyAllUSA()` usaban `'all'` como argumento, pero esto requiere `all-products-consolidated.json` que no existe para vendedores procesados por batches.

**Error original**:
```
❌ No existe el archivo ...\all-products-consolidated.json
```

**Solución**: Modificadas ambas funciones para detectar y procesar batches individuales:

```javascript
async verifyAllMX(sellerId) {
  const { getBatchConsolidatedFiles } = require('../modules/utils/vendor-utils');
  const batchFiles = getBatchConsolidatedFiles(sellerId);
  const hasBatches = batchFiles.length > 0;

  // Para vendedores con batches, procesar cada batch
  if (hasBatches) {
    for (let i = 1; i <= batchFiles.length; i++) {
      try {
        await this.runScript('scripts/verify-products-mx-batch.js', [sellerId, i.toString(), '20']);
      } catch (batchError) {
        this.log(`Batch ${i} MX verification error: ${batchError.message}`, 'WARNING');
      }
    }
  } else {
    await this.runScript('scripts/verify-products-mx-batch.js', [sellerId, 'all', '20']);
  }
}
```

**Archivos afectados**: `automation/daily-workflow.js`

---

### 3. daily-workflow.js - Procesamiento Resiliente de Oportunidades (Líneas 406-449)

**Problema**: Si un batch fallaba durante la generación de oportunidades, todo el vendedor fallaba.

**Solución**: Try-catch individual por batch con continuación:

```javascript
for (let i = 1; i <= batchFiles.length; i++) {
  try {
    await this.runScript('prepare_business_csv.js', [sellerId, i.toString()]);

    // Verificar si se creó el archivo antes de continuar
    const filtradosFile = path.join(..., `batch-${i}-productos-filtrados-sugeridos.csv`);
    if (fs.existsSync(filtradosFile)) {
      await this.runScript('buscando_productos_csv.js', [sellerId, i.toString()]);
    } else {
      this.log(`Batch ${i}: No filtered products file created, skipping`, 'WARNING');
    }
  } catch (batchError) {
    this.log(`Batch ${i} failed: ${batchError.message}`, 'ERROR');
    batchErrors++;
    // Continuar con el siguiente batch
  }
}
```

---

### 4. vendor-utils.js - Soporte para Archivos Legacy (Líneas 388-397)

**Problema**: `detectVendorPhase()` no encontraba oportunidades porque buscaba `oportunidades.csv` pero algunos vendedores tienen `vendedor-oportunidades.csv`.

**Solución**: Agregar detección de nombres de archivo legacy:

```javascript
// Formato nuevo
const opor1 = path.join(dir, `batch-${batchNum}-oportunidades.csv`);
// Formato antiguo (legacy)
const opor1Legacy = path.join(dir, 'vendedor-oportunidades.csv');

if (fs.existsSync(opor1)) result.oportunidades = opor1;
else if (!batchNum && fs.existsSync(opor1Legacy)) result.oportunidades = opor1Legacy;
```

---

### 5. daily-workflow.js - Estadísticas Mejoradas en Notificaciones

**Agregado**: Método `getVendorStats()` para obtener estadísticas completas del vendedor.

**Notificación de completado ahora incluye**:
- Total productos
- Verificados MX
- Verificados USA
- Oportunidades encontradas

```javascript
await this.telegram.sendMessage(
  `✅ *Vendedor Completado*\n\n` +
  `Vendedor: \`${sellerId}\`\n` +
  `⏱️ Duración: ${durationMin} minutos\n\n` +
  `📊 *Resultados:*\n` +
  `• Total productos: ${finalStats.totalProducts}\n` +
  `• Verificados MX: ${finalStats.verifiedMX}/${finalStats.totalProducts}\n` +
  `• Verificados USA: ${finalStats.verifiedUSA}/${finalStats.totalProducts}\n` +
  `• 🎯 Oportunidades: ${finalStats.opportunities}`
);
```

---

## Errores Encontrados y Resueltos

### Error 1: Loop infinito con vendedores vacíos
- **Causa**: Vendedores como A2CINPW5JHJUKV tenían directorio pero sin batches ni datos
- **Síntoma**: "No batches found after plan generation" repetido infinitamente
- **Solución**: Filtros en `syncFromProjects()`

### Error 2: all-products-consolidated.json no existe
- **Causa**: Vendedores con batches no tienen este archivo
- **Síntoma**: Script exited with code 1
- **Solución**: Procesamiento individual por batch en verificación

### Error 3: Batch sin productos válidos detenía todo
- **Causa**: `prepare_business_csv.js` no crea archivo si no hay productos válidos
- **Síntoma**: `buscando_productos_csv.js` fallaba al no encontrar input
- **Solución**: Verificar existencia del archivo antes de llamar al siguiente script

### Error 4: Múltiples procesos de workflow simultáneos
- **Causa**: Cada intento de corrección iniciaba un nuevo proceso sin matar el anterior
- **Síntoma**: Cola sobrescrita por procesos antiguos
- **Solución**: Matar todos los procesos antes de reiniciar

---

## Estado Actual del Sistema

### Proceso Activo
- **ID**: 41f4ec
- **Vendedor en proceso**: A12WQF3HZEWBDD
- **Estado**: Verificando MX (10 batches)
- **Productos**: 2245 total, 1405 verificados MX

### Cola de Vendedores
```json
{
  "A27UCZ6SHTD3J2": "completed - 1620 productos, 0 oportunidades",
  "A12WQF3HZEWBDD": "processing - 2245 productos, en verificación"
}
```

### Vendedores Registrados (Sin Procesar)
20 nuevos vendedores agregados el 18/11/2025:
- A70OX8CAEIFDO
- A2ZSCWTDRVV2LZ
- A25LAT7A0LQQ9L
- AGYB6GLXU3OJB
- A2AZSHW2J3Y86U
- AG29UEBD2E0VM
- A1M5MQDY4CZD0F
- A1F62EE235OGIX
- A3SXTUR0WS2UCN
- A3M0XVHTLEZM2D
- AE4WM1BNK0R4H
- ABEJSZTT6GSP6
- A3KV1U5S0MKGON
- AO403XYKF044G
- A3N84D5AJ313WC
- A2ROGC60HQGY7Y
- A8A3N4FR6OVR1
- A3INGTX5JLIJZS
- A3RIO9JRCW4S7M
- **A1J4ISLQKSFLZ3** (testing - 161 productos)

---

## Pendientes

### 1. Task Scheduler
El script `setup-scheduler.ps1` necesita ejecutarse como Administrador para configurar la tarea diaria a las 9:00 AM.

```powershell
# Ejecutar como Admin:
powershell.exe -ExecutionPolicy Bypass -File "C:\robots\amazon-scrapper-otherseller\setup-scheduler.ps1"
```

### 2. Procesamiento Inicial de Nuevos Vendedores
Los 20 vendedores recién registrados necesitan procesarse primero con MENU.js:
1. Opción 2: Generar plan de categorías
2. Opción 3: Extraer productos

Una vez extraídos, la automatización los sincronizará automáticamente.

### 3. Vendedores con Directorios Vacíos
Estos vendedores fueron filtrados por tener directorios vacíos:
- A2CINPW5JHJUKV
- A2529Q8MW27A5W
- A1V03129EORV8P
- A16U1L53M9TMNY
- A34GDP2AI92FU5
- A32350E2FK8PTY

Necesitan procesarse manualmente con MENU.js antes de automatización.

---

## Flujo de Automatización Actual

```
1. Ejecutar daily-workflow.js
   ↓
2. Verificar cookies (MX y USA requeridas)
   ↓
3. Auto-sync de projects.json → cola
   - Solo vendedores con datos (batches o consolidados)
   - Solo fases 1-4
   ↓
4. Para cada vendedor en cola (FIFO por registered_date):
   ↓
   4a. Fase 1: Generar plan y extraer productos
   4b. Fase 2: Verificar MX (loop hasta 100%)
   4c. Fase 3: Verificar USA (loop hasta 100%)
   4d. Fase 4: Generar oportunidades
   ↓
5. Notificar por Telegram con estadísticas
   ↓
6. Continuar con siguiente vendedor
```

---

## Notas Importantes

### Scripts que USA la automatización (mismos que MENU.js)
- `create-plan-batches.js` - Generar plan de categorías
- `extract-batch-products.js` - Extraer productos
- `consolidate-batch-products.js` - Consolidar productos
- `scripts/verify-products-mx-batch.js` - Verificar en MX
- `scripts/verify-products-usa-batch.js` - Verificar en USA
- `prepare_business_csv.js` - Filtrar productos
- `buscando_productos_csv.js` - Generar oportunidades

### Timeouts y Delays
- 120s entre fases (MX → USA → Oportunidades)
- 10s entre iteraciones de verificación
- 5s entre batches de oportunidades
- 600s (10 min) entre vendedores
- 12 horas timeout máximo por vendedor

### Conteo de Pendientes
El `getPendingCount()` lee los archivos consolidados y cuenta productos sin:
- `disponibilidad_mx` para MX
- `fecha_verificacion_usa` para USA

---

## Archivos Modificados en Esta Sesión

1. `automation/vendor-queue.js` - Filtros de sincronización
2. `automation/daily-workflow.js` - Soporte batches y estadísticas
3. `modules/utils/vendor-utils.js` - Archivos legacy
4. `data/projects.json` - 20 nuevos vendedores

---

*Última actualización: 18 de Noviembre 2025, ~6:35 PM*
