# 📋 PANELMAESTRO V2 - Sistema Modular

## 🎯 ¿Qué es?

**PANELMAESTRO V2** es la versión completamente **modular** del panel de control principal del sistema Amazon. En lugar de tener un solo archivo gigante con todo el código, ahora tenemos:

- ✅ **Arquitectura modular**: Cada menú es un módulo independiente
- ✅ **Utilidades compartidas**: Funciones reutilizables en `utils/`
- ✅ **Fácil mantenimiento**: Modificar un menú no afecta a los demás
- ✅ **Escalabilidad**: Agregar nuevos menús es simple
- ✅ **Código limpio**: Cada módulo tiene una responsabilidad clara

---

## 📁 Estructura de archivos

```
c:\robots\amazon-scrapper-otherseller\
│
├── MENU.js         # Orquestador principal
│
└── modules/                    # Módulos del sistema
    │
    ├── utils/                  # Utilidades compartidas
    │   ├── display-utils.js    # Funciones de display (typewriter, colores, etc.)
    │   ├── projects-utils.js   # Gestión de projects.json (CRUD vendedores)
    │   └── vendor-utils.js     # Operaciones sobre directorios de vendedores
    │
    ├── menu-vendedores.js      # [1] Gestión de Vendedores
    ├── menu-planes.js          # [2] Generar Plan de Scraping
    ├── menu-scraping.js        # [3] Ejecutar Scraping
    ├── menu-verificacion-usa.js # [4] Verificar en Amazon USA
    ├── menu-oportunidades.js   # [5] Generar Oportunidades
    ├── menu-plantillas.js      # [6] Gestión de Plantillas
    ├── menu-publicacion.js     # [7] Publicar Productos
    └── menu-reportes.js        # [8] Reportes y Estado
```

---

## 🚀 Cómo ejecutar

```bash
cd c:\robots\amazon-scrapper-otherseller
node MENU.js
```

El sistema mostrará:
1. Banner con logo ASCII
2. Resumen rápido de vendedores
3. Menú principal con 8 opciones

---

## 🧩 Módulos implementados

### 1️⃣ **menu-vendedores.js** ✅ COMPLETO

**Funciones:**
- `registrarVendedor()`: Registrar nuevo vendedor (llama a `test-seller.js`)
- `verVendedores()`: Listar todos los vendedores con info de productos/batches
- `borrarVendedor()`: Eliminar vendedor de `projects.json` (requiere confirmación "SI")
- `verDetalleVendedor()`: Ver información completa de un vendedor

**Ejemplo de uso:**
```javascript
// Registrar vendedor
[1] → Registrar vendedor → Ingresa Seller ID → Automático test-seller.js

// Ver todos
[2] → Muestra lista con productos/batches/fase

// Borrar vendedor
[3] → Ingresa Seller ID → Escribe "SI" → Eliminado de projects.json

// Ver detalle
[4] → Ingresa Seller ID → Muestra archivos, batches, productos, fase
```

---

### 2️⃣ **menu-planes.js** ✅ COMPLETO

**Funciones:**
- `planSimple()`: Generar plan para vendedores < 1000 productos
- `planBatches()`: Generar plan de batches para cualquier tamaño
- `verEstado()`: Ver estado de planes generados (progreso de batches)
- `resetearPlan()`: Eliminar archivos `plan-batch-*.json` (requiere confirmación)

**Ejemplo de uso:**
```javascript
// Plan Simple
[1] → Lista vendedores < 1000 → Ingresa Seller ID → Genera plan simple

// Plan Batches
[2] → Lista todos los vendedores → Ingresa Seller ID → Genera plan-batch-*.json

// Ver estado
[3] → Muestra todos los vendedores con planes → Progreso X/Y batches

// Resetear plan
[4] → Lista vendedores con planes → Ingresa Seller ID → "SI" → Elimina planes
```

---

### 3️⃣ **menu-scraping.js** ✅ COMPLETO

**Funciones:**
- `scrapingSimple()`: Scraping completo del vendedor (llama `b-scrape-vendedor.js`)
- `scrapingBatch()`: Scraping por batch (llama `extract-batch-products.js`)
- `opcionesAvanzadas()`: Reextracción, limpieza, consolidación manual
- `verProgreso()`: Ver progreso de extracción de batches

**Flujo batch extraction:**
```javascript
// Scraping por batch
[2] → Filtra vendedores con planes
    → Ingresa Seller ID
    → Muestra batches disponibles (✓ Extraído / ⏳ Pendiente)
    → Ingresa número de batch
    → Ejecuta extract-batch-products.js
    → Pregunta si consolidar (genera JSON + CSV)
```

**Características:**
- ✅ Solo muestra vendedores con plan de batches generado
- ✅ Indica qué batches ya fueron extraídos
- ✅ Consolidación automática opcional después de extraer
- ✅ Ver progreso de todos los batches en tiempo real

---

### 4️⃣ **menu-verificacion-usa.js** ⏳ STUB

**Funciones planificadas:**
- Verificar productos en Amazon.com
- Batch o full vendor
- Integrar `verify-usa.js`

---

### 5️⃣ **menu-oportunidades.js** ⏳ STUB

**Funciones planificadas:**
- Generar oportunidades de negocio
- Filtrar por margen
- Exportar a CSV
- Integrar `filter-opportunities.js`

---

### 6️⃣ **menu-plantillas.js** ⏳ STUB

**Funciones planificadas:**
- Solicitar plantilla de Seller Central
- Descargar plantilla
- Llenar plantilla con productos
- Verificar estado de solicitud

---

### 7️⃣ **menu-publicacion.js** ⏳ STUB

**Funciones planificadas:**
- Subir plantilla a Seller Central
- Verificar estado del feed
- Ver productos publicados

---

### 8️⃣ **menu-reportes.js** ⏳ STUB

**Funciones planificadas:**
- Resumen por vendedor
- Progreso por fase
- Categorías problemáticas
- Estimación de tiempos

---

## 🛠️ Utilidades compartidas

### **display-utils.js**

Funciones de visualización y formateo:

```javascript
// Efecto typewriter
await typewriteLine('Hola mundo', { charDelay: 10 });

// Títulos
await showTitle('MI TÍTULO', { icon: '🚀' });

// Separadores
await showSeparator('=');

// Mensajes con color
await showError('Error critico');
await showSuccess('Todo bien');
await showWarning('Advertencia');
await showInfo('Información');

// Entrada del usuario
const respuesta = await ask('Ingresa tu nombre: ', rl);

// Pausas
await pause(rl); // "Presiona Enter para continuar..."

// Limpiar pantalla
await clearScreen();
```

---

### **projects-utils.js**

Gestión del archivo `data/projects.json`:

```javascript
// Cargar proyectos
const projects = loadProjects();

// Guardar proyectos
saveProjects(projects);

// Listar IDs
const ids = listVendorIds(); // ['ABC123', 'XYZ789']

// Obtener info de vendedor
const vendor = getVendorInfo('ABC123');
// { nombre: 'Vendedor 1', timestamp: '...', fase: 0, ... }

// Actualizar info
updateVendorInfo('ABC123', { fase: 1, nombre: 'Nuevo nombre' });

// Agregar vendedor
addVendor('NEW123', { nombre: 'Nuevo', fase: 0 });

// Eliminar vendedor
deleteVendor('ABC123');

// Contar por fase
const counts = countVendorsByPhase();
// { 0: 5, 1: 3, 2: 1 }

// Filtrar vendedores
const filtered = filterVendors({ fase: 1 });
// [{ sellerId: 'ABC', ...vendor }, ...]
```

---

### **vendor-utils.js**

Operaciones sobre directorios de vendedores:

```javascript
// Obtener directorio del vendedor
const dir = getVendorDir('ABC123');
// 'c:\\robots\\amazon-scrapper-otherseller\\data\\vendors\\ABC123'

// Verificar si existe
if (vendorDirExists('ABC123')) { ... }

// Crear directorio
createVendorDir('NEW123');

// Listar archivos del vendedor
const files = listVendorFiles('ABC123');
// ['intelligent-Alimentos.json', 'batch-1-products.json', ...]

// Contar productos extraídos
const count = countVendorProducts('ABC123');
// 542 (suma de productos en todos los archivos)

// Obtener archivos de plan de batches
const batches = getBatchFiles('ABC123');
// ['plan-batch-1.json', 'plan-batch-2.json']

// Estado de batches
const status = getBatchesStatus('ABC123');
// [
//   { batchNum: 1, extracted: true, productCount: 120 },
//   { batchNum: 2, extracted: false, productCount: 0 }
// ]

// Verificar si tiene plan de batches
if (hasBatchPlan('ABC123')) { ... }

// Es vendedor grande (>= 1000 productos)
if (isLargeVendor('ABC123')) { ... }

// Archivo de progreso
const progressFile = getProgressFile('ABC123');
// 'c:\\...\\data\\vendors\\ABC123\\progress.json'

// Resumen completo del vendedor
const summary = getVendorSummary('ABC123');
// {
//   sellerId: 'ABC123',
//   vendorDir: '...',
//   exists: true,
//   files: [...],
//   totalProducts: 542,
//   batchFiles: [...],
//   batchesExtracted: 2,
//   totalBatches: 3,
//   hasProgress: false
// }
```

---

## 🔄 Patrón de módulo

Todos los módulos siguen el mismo patrón:

```javascript
// 1. Imports
const { typewriteLine, ask } = require('./utils/display-utils');
const { loadProjects } = require('./utils/projects-utils');
const { getVendorSummary } = require('./utils/vendor-utils');

// 2. Funciones auxiliares (async)
async function miFuncion(rl) {
  await typewriteLine('Procesando...');
  // lógica...
}

// 3. Función principal del menú
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    // Mostrar menú
    await typewriteLine('');
    await showTitle('MI MENÚ', { icon: '🎯' });
    await typewriteLine('[1] Opción 1');
    await typewriteLine('[0] ← Volver');
    await typewriteLine('');
    
    // Leer opción
    const option = await ask('Selecciona: ', rl);
    
    // Procesar opción
    switch (option) {
      case '1':
        await miFuncion(rl);
        break;
      case '0':
        continuar = false;
        break;
      default:
        await showWarning('Opción inválida');
        await pause(rl);
    }
  }
}

// 4. Export
module.exports = { show };
```

---

## ➕ Cómo agregar un nuevo módulo

### Paso 1: Crear el archivo

```bash
touch modules/menu-mimodulo.js
```

### Paso 2: Implementar el patrón

```javascript
const { typewriteLine, ask } = require('./utils/display-utils');

async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await typewriteLine('\n[1] Mi función\n[0] Volver\n');
    const option = await ask('Selecciona: ', rl);
    
    if (option === '0') continuar = false;
  }
}

module.exports = { show };
```

### Paso 3: Agregar al orquestador

En `MENU.js`:

```javascript
// Agregar import
const menuMiModulo = require('./modules/menu-mimodulo');

// Agregar opción en showMainMenu()
await typewriteLine('[9] 🆕 Mi Módulo Nuevo', { charDelay: 8 });

// Agregar case en handleMainMenu()
case '9':
  await menuMiModulo.show(rl);
  break;
```

---

## 🎨 Flujo completo del sistema

```
┌─────────────────────────────────────────────────────────┐
│             MENU.js (Orchestrator)          │
│                                                         │
│  showBanner() → showQuickSummary() → showMainMenu()    │
│                                                         │
│           ┌─────────────────────────────────┐          │
│           │   handleMainMenu(userOption)    │          │
│           └──────────────┬──────────────────┘          │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐      ┌──────────┐    ┌──────────┐
   │  menu-   │      │  menu-   │    │  menu-   │
   │vendedores│      │  planes  │    │ scraping │
   └─────┬────┘      └─────┬────┘    └─────┬────┘
         │                 │                │
         │    ┌────────────┴────────┐       │
         │    │                     │       │
         ▼    ▼                     ▼       ▼
   ┌──────────────────────────────────────────┐
   │         utils/ (shared utilities)        │
   │                                          │
   │  • display-utils.js                     │
   │  • projects-utils.js                    │
   │  • vendor-utils.js                      │
   └──────────────────────────────────────────┘
```

### Flujo de ejecución:

1. **Usuario ejecuta**: `node MENU.js`
2. **Banner**: Se muestra el logo ASCII
3. **Resumen**: Se carga `projects.json` y muestra estadísticas
4. **Menú principal**: Usuario ve 8 opciones
5. **Usuario selecciona**: Por ejemplo, opción `3` (Scraping)
6. **Orquestador llama**: `menuScraping.show(rl)`
7. **Módulo ejecuta**: Muestra su propio submenú
8. **Módulo usa utilidades**: Importa `display-utils`, `projects-utils`, `vendor-utils`
9. **Proceso**: Ejecuta la lógica (spawn scripts, modificar archivos, etc.)
10. **Return**: Vuelve al menú principal

---

## 📊 Estado actual de implementación

| Módulo | Estado | Funciones | Descripción |
|--------|--------|-----------|-------------|
| **menu-vendedores.js** | ✅ **100%** | 4/4 | Registrar, ver, borrar, detalle |
| **menu-planes.js** | ✅ **100%** | 4/4 | Simple, batches, estado, resetear |
| **menu-scraping.js** | ✅ **100%** | 4/4 | Simple, batch, avanzadas, progreso |
| **menu-verificacion-usa.js** | ⏳ **0%** | 0/? | Stub creado |
| **menu-oportunidades.js** | ⏳ **0%** | 0/? | Stub creado |
| **menu-plantillas.js** | ⏳ **0%** | 0/? | Stub creado |
| **menu-publicacion.js** | ⏳ **0%** | 0/? | Stub creado |
| **menu-reportes.js** | ⏳ **0%** | 0/? | Stub creado |

**Utilidades (3/3 - 100%):**
- ✅ `display-utils.js` - 10 funciones
- ✅ `projects-utils.js` - 9 funciones
- ✅ `vendor-utils.js` - 11 funciones

---

## 🧪 Testing

### Test básico del orquestador:

```bash
node MENU.js
```

Deberías ver:
- ✅ Banner ASCII
- ✅ Resumen de vendedores
- ✅ Menú con 8 opciones
- ✅ Opción `0` para salir

### Test de módulos completos:

```bash
# Opción 1: Gestión de Vendedores
[1] → [2] Ver vendedores → Debería listar todos

# Opción 2: Generar Plan
[2] → [3] Ver estado → Debería mostrar planes existentes

# Opción 3: Ejecutar Scraping
[3] → [4] Ver progreso → Debería mostrar batches extraídos
```

---

## 📚 Próximos pasos

### Prioridad ALTA:
1. ✅ ~~Implementar `menu-scraping.js`~~ (HECHO)
2. ✅ ~~Implementar `menu-planes.js`~~ (HECHO)
3. ⏳ Implementar `menu-verificacion-usa.js`
4. ⏳ Implementar `menu-oportunidades.js`

### Prioridad MEDIA:
5. ⏳ Implementar `menu-plantillas.js`
6. ⏳ Implementar `menu-publicacion.js`
7. ⏳ Implementar `menu-reportes.js`

### Prioridad BAJA:
8. ⏳ Testing completo de todos los módulos
9. ⏳ Migración de PANELMAESTRO.js antiguo → v2
10. ⏳ Deprecar versión antigua

---

## 🔧 Troubleshooting

### Error: "Cannot find module './modules/menu-*.js'"

**Causa**: El módulo no existe o no fue creado.

**Solución**:
```bash
# Crear el módulo faltante
touch modules/menu-nombremodulo.js

# O comentar temporalmente en MENU.js:
// const menuNombreModulo = require('./modules/menu-nombremodulo');
```

---

### Error: "TypeError: menuNombre.show is not a function"

**Causa**: El módulo no exporta la función `show`.

**Solución**: Asegurarse de que el módulo tenga:
```javascript
module.exports = { show };
```

---

### Error: "projects.json not found"

**Causa**: No existe el archivo de proyectos.

**Solución**:
```bash
# Crear el archivo manualmente
mkdir -p data
echo '{"projects":{}}' > data/projects.json
```

---

## 📖 Documentación relacionada

- `README-EXTRACCION-JERARQUICA.md` - Sistema de extracción por subcategorías
- `README-CONSOLIDACION-CSV.md` - Generación automática de CSV
- `README-SISTEMA-COMPLETO-BATCH.md` - Flujo completo de batches

---

## 🎉 Ventajas de la arquitectura modular

✅ **Mantenibilidad**: Cada módulo es independiente
✅ **Escalabilidad**: Agregar nuevos menús es trivial
✅ **Reutilización**: Utilidades compartidas evitan duplicación
✅ **Testing**: Se puede testear cada módulo por separado
✅ **Claridad**: Código organizado y fácil de entender
✅ **Colaboración**: Múltiples desarrolladores pueden trabajar sin conflictos

---

## 👨‍💻 Creado por

Sistema modular implementado como parte de la mejora continua del flujo de Amazon Scrapping.

**Fecha**: Diciembre 2024
**Versión**: 2.0
**Arquitectura**: Modular con utilidades compartidas

---

¡Disfruta del nuevo **PANELMAESTRO V2**! 🚀
