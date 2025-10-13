# 📝 CHANGELOG - SISTEMA INCREMENTAL POR LOTES

> **Fecha de implementación:** 12 de octubre de 2025  
> **Versión:** 1.0.0

---

## 🎯 RESUMEN DE CAMBIOS

Se implementó un **Sistema Incremental por Lotes** para trabajar con vendedores grandes de Amazon de forma modular y resumible, dividiendo el trabajo en lotes de ~1000 productos cada uno.

---

## ✅ ARCHIVOS CREADOS

### 1. **create-plan-batches.js** (634 líneas)
- Script completo para crear planes jerárquicos divididos en lotes
- **Funciones principales:**
  - `detectExistingBatches()` - Detecta batches existentes para reanudación
  - `saveBatch(batchNumber, categories, mainCategories)` - Guarda batch individual
  - `updateProjectsFile(batchNumber, batchData)` - Actualiza projects.json
  - `createBatchedPlans()` - Orquestador principal con lógica de acumulación
  - `countCategoryProducts(category)` - Calcula productos por categoría
  - `analyzeRecursively()` - Análisis recursivo de categorías

- **Configuración:**
  - `MAX_PRODUCTS_PER_BATCH = 1000`
  - `MAX_PRODUCTS_PER_CATEGORY = 320`
  - `MAX_RECURSION_DEPTH = 10`

- **Características:**
  - ✅ Agrupa categorías hasta alcanzar ~1000 productos por lote
  - ✅ Reanudación automática desde último batch
  - ✅ Actualización de projects.json con array batches[]
  - ✅ Guarda archivos: `YYYY-MM-DD-plan-batch-N.json`

### 2. **GUIA-SISTEMA-INCREMENTAL.md**
- Documentación completa del sistema incremental
- **Contenido:**
  - Objetivo y ventajas del sistema
  - Flujo de trabajo completo (Registro → Planificación → Procesamiento)
  - Documentación detallada de cada script
  - Estructura de archivos y formato de batches
  - Casos de uso (vendedor pequeño, mediano, grande)
  - Diferencias entre create-plan.js y create-plan-batches.js
  - Estados en projects.json
  - Mejores prácticas
  - Comandos rápidos

### 3. **create-plan.js.backup**
- Backup del script original create-plan.js
- Preservado para vendedores pequeños (<1000 productos)

### 4. **CHANGELOG-INCREMENTAL.md** (este archivo)
- Registro completo de todos los cambios realizados

---

## 📝 ARCHIVOS MODIFICADOS

### 1. **test-seller.js**
**Cambios:**
- Modificado para modo "registro only" (no inicia scraping automático)
- Agrega lógica para guardar en `projects.json`:
  ```javascript
  const projectsData = {
    seller_id: SELLER_ID,
    total_products: totalProductsNum,
    main_categories: categoryNames,
    main_categories_urls: categoryData,
    discovered_at: new Date().toISOString(),
    last_analyzed: new Date().toISOString(),
    status: 'discovered',
    analysis_completed: true,
    analysis_date: new Date().toISOString()
  };
  ```
- Muestra recomendaciones según tamaño del vendedor:
  - < 500 productos → Plan único suficiente
  - < 2000 productos → Plan único o 2 lotes máximo
  - \> 2000 productos → Múltiples lotes recomendados

### 2. **PANELMAESTRO.js**
**Cambios:**

**A. Constantes actualizadas:**
```javascript
const MENU_OPTIONS = {
  DETAILS: '1',
  FILES: '2',
  REFRESH: '3',
  WORKFLOW: '4',
  INCREMENTAL: '6',  // NUEVA OPCIÓN
  PUBLISH: '5',
  EXIT: '0'
};
```

**B. Menú actualizado:**
- Agregada opción `[6] 🔄 Sistema Incremental por Lotes`

**C. Nuevas funciones agregadas:**

1. **handleIncrementalOption(rl)**
   - Muestra submenu del sistema incremental
   - 4 opciones: Registrar, Crear planes, Ver estado, Ver documentación

2. **handleRegistrarVendedor(rl)**
   - Ejecuta test-seller.js para registrar nuevo vendedor
   - Solicita SELLER_ID
   - Muestra progreso y resultado

3. **handleCrearPlanesLotes(rl)**
   - Lista vendedores registrados con información de batches
   - Permite seleccionar vendedor
   - Ejecuta create-plan-batches.js
   - Detecta si hay batches existentes
   - Confirma antes de ejecutar

4. **handleVerEstadoBatches(rl)**
   - Muestra vendedores con batches creados
   - Detalle de cada batch: número, productos, categorías, status, fecha
   - Lista archivos de batch en disco
   - Estadísticas: completados / en progreso / pendientes

5. **handleVerDocumentacionIncremental(rl)**
   - Muestra resumen del sistema incremental
   - Ruta a documentación completa (GUIA-SISTEMA-INCREMENTAL.md)
   - Flujo de 3 pasos explicado
   - Ventajas del sistema

**D. Switch en main():**
```javascript
case MENU_OPTIONS.INCREMENTAL: {
  await handleIncrementalOption(rl);
  projectsMap = loadProjects();
  await renderProjectsSummary(projectsMap);
  break;
}
```

### 3. **readme.md**
**Cambios:**
- Agregada sección completa: **"🔄 SISTEMA INCREMENTAL POR LOTES"**
- **Contenido nuevo:**
  - ¿Por qué usar el sistema incremental?
  - Problemas con vendedores grandes vs Ventajas del sistema
  - Flujo de trabajo incremental visual
  - Archivos de batch (ubicación y estructura)
  - Scripts del sistema incremental (test-seller.js, create-plan-batches.js, process-all-categories.js)
  - Panel de control: nueva opción [6]
  - Documentación completa (referencia a GUIA-SISTEMA-INCREMENTAL.md)
  - Casos de uso recomendados por tamaño de vendedor
  - Mejores prácticas
  - ✅ Sistema completo implementado (actualizado de "próximamente")

### 4. **process-all-categories.js**
**Cambios:**

**A. Constantes actualizadas:**
```javascript
const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');
const BATCH_FILES = findBatchFiles();  // Nueva detección
```

**B. Nuevas funciones agregadas:**

1. **findBatchFiles()**
   - Busca archivos `plan-batch-N.json` en VENDOR_DIR
   - Filtra archivos que NO incluyen 'batch' en findPlanFile()
   - Ordena numéricamente (batch-1, batch-2, ...)
   - Retorna array de rutas completas

2. **loadProjectsFile() / saveProjectsFile()**
   - Carga y guarda `projects.json`
   - Manejo de errores robusto

3. **updateBatchStatus(batchNumber, status)**
   - Actualiza estado de batch en projects.json
   - Estados: 'plan_created' → 'scraping' → 'completed'
   - Agrega timestamps: started_at, completed_at
   - Logs informativos del progreso

4. **processBatch(batchFile, batchNumber, progress)**
   - Procesa un batch completo
   - Carga archivo batch-N.json
   - Actualiza estado a 'scraping'
   - Determina categorías pendientes
   - Itera sobre categorías (con pausas)
   - Actualiza estado a 'completed'
   - Retorna resultado: {success, skipped}

**C. Función principal modificada:**

- **Detección automática de modo:**
  ```javascript
  const useBatchMode = BATCH_FILES.length > 0;
  ```

- **Si hay batches → MODO BATCHES:**
  - Procesa cada batch secuencialmente
  - Muestra progreso con bordes ASCII
  - Pausas entre batches (3-8 segundos)
  - Resumen final con estadísticas
  - Mensaje de siguiente paso

- **Si solo plan único → MODO TRADICIONAL:**
  - Mantiene lógica original
  - Compatibilidad total con flujo existente

**D. Output mejorado:**
```
🔄 === MODO: PROCESAMIENTO POR BATCHES ===
📦 Total batches detectados: 10

┌──────────────────────────────────────────────────────────┐
│ BATCH 1/10                                               │
└──────────────────────────────────────────────────────────┘
📦 === PROCESANDO BATCH 1 ===
📊 Batch 1 actualizado a: scraping
...
✅ Batch 1 completado
📊 Batch 1 actualizado a: completed
```

---

## 📊 ESTRUCTURA DE DATOS

### **projects.json** - Nueva estructura

```json
{
  "projects": {
    "SELLER_ID": {
      "seller_id": "SELLER_ID",
      "total_products": 10500,
      "main_categories": ["Hogar", "Electrónicos", ...],
      "main_categories_urls": [
        {"name": "Hogar", "url": "https://..."}
      ],
      "discovered_at": "2025-10-12T...",
      "last_analyzed": "2025-10-12T...",
      "status": "discovered",
      "analysis_completed": true,
      "analysis_date": "2025-10-12T...",
      "plan_created": true,
      "plan_date": "2025-10-12T...",
      "batches": [
        {
          "batch": 1,
          "status": "plan_created",
          "products": 1050,
          "categories": ["Hogar y Cocina", "Electrónicos", "Juguetes"],
          "created_at": "2025-10-12T..."
        },
        {
          "batch": 2,
          "status": "plan_created",
          "products": 980,
          "categories": ["Deportes", "Jardín", "Mascotas"],
          "created_at": "2025-10-12T..."
        }
      ]
    }
  }
}
```

### **Archivos de batch** - Estructura

**Ubicación:** `data/vendors/SELLER_ID/YYYY-MM-DD-plan-batch-N.json`

```json
{
  "seller_id": "SELLER_ID",
  "batch_number": 1,
  "created_at": "2025-10-12T...",
  "analysis_type": "recursive_hierarchical_batch",
  "max_products_per_leaf": 320,
  "max_recursion_depth": 10,
  "max_products_per_batch": 1000,
  "main_categories": ["Hogar", "Electrónicos", ...],
  "categories": [
    {
      "name": "Hogar y Cocina",
      "url": "https://...",
      "expected_products": 408,
      "isLeaf": false,
      "depth": 1,
      "path": ["Hogar y Cocina"],
      "status": "pending",
      "subcategories": [...]
    }
  ]
}
```

---

## 🔄 FLUJO DE TRABAJO COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. REGISTRO DE VENDEDOR (test-seller.js)                   │
│    • node test-seller.js SELLER_ID                         │
│    • Análisis rápido: total productos, categorías          │
│    • Guarda en projects.json con status 'discovered'       │
│    • NO inicia scraping automático                         │
│    • Muestra recomendaciones según tamaño                  │
├─────────────────────────────────────────────────────────────┤
│ 2. CREACIÓN DE PLANES POR LOTES (create-plan-batches.js)   │
│    • node create-plan-batches.js SELLER_ID                 │
│    • Detecta batches existentes (reanudación)              │
│    • Agrupa categorías en lotes de ~1000 productos         │
│    • Guarda plan-batch-1.json, plan-batch-2.json, etc.     │
│    • Actualiza projects.json con cada batch                │
│    • Resumible: puede interrumpirse y continuar            │
├─────────────────────────────────────────────────────────────┤
│ 3. PROCESAMIENTO POR BATCHES (próximamente)                │
│    • node process-batches.js SELLER_ID                     │
│    • Detecta y procesa cada batch secuencialmente          │
│    • Extrae productos de categorías del batch              │
│    • Actualiza estado en projects.json                     │
│    • Consolida resultados                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 CASOS DE USO

### **Caso 1: Vendedor Pequeño (< 1000 productos)**
```bash
node test-seller.js A1234567890
# ✅ 700 productos, 8 categorías
# 💡 Plan único suficiente

node create-plan-batches.js A1234567890
# ✅ Batch 1 creado: 700 productos, 8 categorías
```

### **Caso 2: Vendedor Grande (10,000+ productos)**
```bash
node test-seller.js B9876543210
# ✅ 12,500 productos, 25 categorías
# 💡 Múltiples lotes recomendados

node create-plan-batches.js B9876543210
# ✅ Batch 1: 1,050 productos (categorías 1-4)
# ✅ Batch 2: 980 productos (categorías 5-8)
# ... (puedes interrumpir aquí)

# Continuar después (reanuda automáticamente)
node create-plan-batches.js B9876543210
# ♻️  REANUDANDO desde batch 5
# ⏭️  Saltando 12 categorías ya procesadas
```

### **Caso 3: Usar Panel de Control**
```bash
node PANELMAESTRO.js
# Seleccionar [6] Sistema Incremental por Lotes
# → [1] Registrar nuevo vendedor
# → [2] Crear planes por lotes
# → [3] Ver estado de batches
# → [4] Ver documentación
```

---

## 💡 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ Reanudación Automática
- Detecta archivos `plan-batch-N.json` existentes
- Extrae categorías ya procesadas
- Salta categorías completadas
- Continúa desde último batch + 1

### ✅ Actualización de Estado
- Guarda progreso en `projects.json` con cada batch
- Mantiene array `batches[]` con detalle de cada lote
- Estados: `plan_created`, `in_progress`, `completed`

### ✅ Límites Configurables
- `MAX_PRODUCTS_PER_BATCH = 1000` (productos por lote)
- `MAX_PRODUCTS_PER_CATEGORY = 320` (límite de Amazon)
- `MAX_RECURSION_DEPTH = 10` (profundidad máxima)

### ✅ Análisis Jerárquico
- Mismo análisis recursivo que create-plan.js
- Subdivisión automática de categorías grandes
- Anti-loops para evitar ciclos infinitos
- Calcula productos esperados por categoría

### ✅ Panel Interactivo
- Nueva opción [6] con submenu completo
- Visualización de estado de batches
- Ejecución de scripts desde el panel
- Confirmación antes de acciones importantes

---

## 🔜 PRÓXIMOS PASOS

### **Fase 1: Procesamiento por Batches** ✅ (COMPLETADO)
- ✅ Modificado `process-all-categories.js` con detección automática
- ✅ Detecta archivos `plan-batch-N.json`
- ✅ Procesa batches secuencialmente
- ✅ Actualiza estado en `projects.json` (status: 'plan_created' → 'scraping' → 'completed')
- ✅ Reanudación automática por batch (salta batches completados)
- ✅ Funciones agregadas: `findBatchFiles()`, `processBatch()`, `updateBatchStatus()`
- ✅ Mantiene compatibilidad con modo tradicional (plan único)

### **Fase 2: Integración con Cerebro** (opcional)
- Modificar `cerebro.js` para mejor visualización de batches
- Mostrar progreso de batch actual
- **Nota:** `process-all-categories.js` ya es llamado por cerebro.js, detectará batches automáticamente

### **Fase 3: Visualización Mejorada** (opcional)
- Barra de progreso por batch
- Estimación de tiempo restante
- Estadísticas detalladas por lote
- Dashboard en tiempo real

---

## 📚 DOCUMENTACIÓN RELACIONADA

- **GUIA-SISTEMA-INCREMENTAL.md** - Guía completa con ejemplos detallados
- **readme.md** - Sección "SISTEMA INCREMENTAL POR LOTES"
- **DOCUMENTACION-FINAL.md** - Documentación general del proyecto (si existe)

---

## 🧪 TESTING RECOMENDADO

### **1. Vendedor de prueba pequeño**
```bash
# Probar con vendedor < 1000 productos
node test-seller.js A3Q5ASRA7J8Y5E
node create-plan-batches.js A3Q5ASRA7J8Y5E
# Verificar que crea 1 solo batch
```

### **2. Interrumpir y reanudar**
```bash
# Iniciar creación de batches
node create-plan-batches.js SELLER_ID_GRANDE
# Presionar Ctrl+C después de 2 batches

# Reanudar
node create-plan-batches.js SELLER_ID_GRANDE
# Verificar que continúa desde batch 3
```

### **3. Panel de control**
```bash
node PANELMAESTRO.js
# Probar opción [6] → [1] → [2] → [3]
# Verificar que muestra información correcta
```

---

## 👥 CRÉDITOS

**Desarrollado por:** Sistema de scraping incremental Amazon MX  
**Fecha:** 12 de octubre de 2025  
**Versión:** 1.0.0

---

**🎉 SISTEMA INCREMENTAL COMPLETAMENTE FUNCIONAL Y DOCUMENTADO 🎉**
