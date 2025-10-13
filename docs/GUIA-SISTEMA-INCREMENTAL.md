# 📋 GUÍA: SISTEMA INCREMENTAL POR LOTES

> **Documentación del flujo de trabajo incremental**  
> Actualizado: 12 de octubre de 2025

---

## 🎯 OBJETIVO

Sistema que permite trabajar con vendedores grandes de forma incremental, dividiendo el trabajo en lotes de ~1000 productos para:
- Reducir tiempo de procesamiento por sesión
- Permitir interrupciones y reanudación
- Facilitar detección de errores
- Trabajar por partes manejables

---

## 📊 FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. REGISTRO DE VENDEDOR (test-seller.js)                   │
│    ↓ Análisis rápido: total productos, categorías          │
│    ↓ Guarda en projects.json con status 'discovered'       │
│    ↓ NO inicia scraping automático                         │
├─────────────────────────────────────────────────────────────┤
│ 2. CREACIÓN DE PLANES POR LOTES (create-plan-batches.js)   │
│    ↓ Agrupa categorías en lotes de ~1000 productos         │
│    ↓ Guarda plan-batch-1.json, plan-batch-2.json, etc.     │
│    ↓ Reanudable: detecta batches existentes                │
│    ↓ Actualiza projects.json con cada batch                │
├─────────────────────────────────────────────────────────────┤
│ 3. PROCESAMIENTO POR BATCHES (process-all-categories.js)   │
│    ↓ Detecta y procesa cada batch secuencialmente          │
│    ↓ Extrae productos de categorías del batch              │
│    ↓ Consolida datos por batch                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 SCRIPTS PRINCIPALES

### **1. test-seller.js** - Registro de Vendedores

**Propósito**: Registrar vendedores para análisis posterior sin iniciar scraping.

**Uso**:
```powershell
node test-seller.js A3Q5ASRA7J8Y5E
```

**Qué hace**:
1. Navega a la página del vendedor
2. Extrae total de productos
3. Extrae categorías principales (nombres y URLs)
4. Guarda información en `projects.json`
5. NO inicia scraping

**Output en projects.json**:
```json
{
  "projects": {
    "A3Q5ASRA7J8Y5E": {
      "seller_id": "A3Q5ASRA7J8Y5E",
      "total_products": 10500,
      "main_categories": ["Hogar", "Electrónicos", ...],
      "main_categories_urls": [
        {"name": "Hogar", "url": "https://..."},
        ...
      ],
      "discovered_at": "2025-10-12T...",
      "last_analyzed": "2025-10-12T...",
      "status": "discovered",
      "analysis_completed": true,
      "analysis_date": "2025-10-12T..."
    }
  }
}
```

**Recomendaciones mostradas**:
- Vendedor < 500 productos → Plan único suficiente
- Vendedor < 2000 productos → Plan único o 2 lotes máximo
- Vendedor > 2000 productos → Múltiples lotes recomendados

---

### **2. create-plan-batches.js** - Planes por Lotes

**Propósito**: Crear planes jerárquicos divididos en lotes de ~1000 productos.

**Uso**:
```powershell
node create-plan-batches.js A3Q5ASRA7J8Y5E
```

**Configuración**:
- `MAX_PRODUCTS_PER_CATEGORY = 320` (límite de Amazon)
- `MAX_PRODUCTS_PER_BATCH = 1000` (máximo por lote)
- `MAX_RECURSION_DEPTH = 10` (profundidad máxima)

**Qué hace**:
1. **Detecta batches existentes** (reanudación automática)
2. Navega a cada categoría principal
3. Analiza recursivamente (subdivide si > 320 productos)
4. **Agrupa categorías hasta alcanzar ~1000 productos**
5. **Guarda lote** cuando se alcanza el límite
6. Actualiza `projects.json` con información del batch
7. Continúa con siguiente lote

**Reanudación automática**:
- Detecta archivos `YYYY-MM-DD-plan-batch-N.json`
- Lee categorías ya procesadas
- Salta categorías completadas
- Continúa desde último batch + 1

**Ejemplo con vendedor de 10,000 productos**:

```
Categorías principales: 15

Batch 1: Categorías 1-4 → 1,050 productos
  ✅ Guardado: 2025-10-12-plan-batch-1.json

Batch 2: Categorías 5-8 → 980 productos
  ✅ Guardado: 2025-10-12-plan-batch-2.json

Batch 3: Categorías 9-12 → 1,100 productos
  ✅ Guardado: 2025-10-12-plan-batch-3.json

... (continúa hasta completar todas las categorías)
```

**Output: Archivo de batch** (`2025-10-12-plan-batch-1.json`):
```json
{
  "seller_id": "A3Q5ASRA7J8Y5E",
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
    },
    ...
  ]
}
```

**Output: Actualización en projects.json**:
```json
{
  "projects": {
    "A3Q5ASRA7J8Y5E": {
      ...
      "status": "planned",
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

**Si se interrumpe**:
```powershell
# Primera ejecución - crea batch 1 y 2
node create-plan-batches.js A3Q5ASRA7J8Y5E
# [Se interrumpe después de batch 2]

# Segunda ejecución - reanuda desde batch 3
node create-plan-batches.js A3Q5ASRA7J8Y5E
# ♻️  REANUDANDO desde batch 3
# ⏭️  Saltando 7 categorías ya procesadas
```

---

### **3. process-all-categories.js** - Procesamiento por Batches

**Propósito:** Procesar categorías detectando automáticamente si hay batches o plan único.

**Uso:**
```powershell
node process-all-categories.js SELLER_ID
```

**Detección automática:**
- Si encuentra archivos `plan-batch-N.json` → **MODO BATCHES**
- Si solo encuentra `plan.json` → **MODO TRADICIONAL**

**Modo Batches - Qué hace:**
1. Detecta todos los archivos `plan-batch-N.json`
2. Los ordena numéricamente (batch-1, batch-2, ...)
3. Procesa cada batch secuencialmente
4. Actualiza estado en `projects.json`:
   - `plan_created` → `scraping` → `completed`
5. Salta categorías ya completadas (reanudación automática)
6. Pausa entre categorías (2-5s) y entre batches (3-8s)

**Ejemplo de ejecución:**
```powershell
node process-all-categories.js B9876543210

# 🔄 === MODO: PROCESAMIENTO POR BATCHES ===
# 📦 Total batches detectados: 10
# 
# ┌──────────────────────────────────────────────────────────┐
# │ BATCH 1/10                                               │
# └──────────────────────────────────────────────────────────┘
# 📦 === PROCESANDO BATCH 1 ===
# 📄 Archivo: 2025-10-12-plan-batch-1.json
# 📊 Categorías en este batch: 4
# 📦 Productos esperados: 1050
# 📊 Batch 1 actualizado a: scraping
# 
# 📂 [1/4] Hogar y Cocina
# 📊 Productos esperados: 408
# ⚡ Ejecutando: node category-intelligent.js B9876543210 "Hogar y Cocina"
# ✅ Hogar y Cocina completada exitosamente
# ⏸️ Pausa entre categorías: 3.2s
# 
# ... (procesa las 4 categorías del batch)
# 
# ✅ Batch 1 completado
# 📊 Batch 1 actualizado a: completed
# ⏸️ Pausa entre batches: 5.7s
# 
# ┌──────────────────────────────────────────────────────────┐
# │ BATCH 2/10                                               │
# └──────────────────────────────────────────────────────────┘
# ... (continúa con siguiente batch)
```

**Si se interrumpe:**
```powershell
# Primera ejecución - procesa batch 1 y 2
node process-all-categories.js B9876543210
# [Se interrumpe después de batch 2]

# Segunda ejecución - reanuda desde batch 3
node process-all-categories.js B9876543210
# � MODO: PROCESAMIENTO POR BATCHES
# 📦 Total batches detectados: 10
# 
# Batch 1: ✅ Todas las categorías ya procesadas (saltado)
# Batch 2: ✅ Todas las categorías ya procesadas (saltado)
# Batch 3: ⏳ Procesando...
```

**Actualización en projects.json:**
```json
{
  "batches": [
    {
      "batch": 1,
      "status": "completed",        // Actualizado automáticamente
      "started_at": "2025-10-12T10:00:00Z",
      "completed_at": "2025-10-12T10:45:00Z"
    },
    {
      "batch": 2,
      "status": "scraping",         // En proceso
      "started_at": "2025-10-12T10:50:00Z"
    },
    {
      "batch": 3,
      "status": "plan_created"      // Pendiente
    }
  ]
}
```

**Resumen final:**
```powershell
# 🎉 === TODOS LOS BATCHES COMPLETADOS ===
# ✅ Batches procesados: 10
# ✅ Categorías totales: 25
# ❌ Errores: 0
# 📦 Total productos: 12,500
# 📁 Archivos generados en: data/vendors/B9876543210
# 
# 🎯 ¡Fase 3 (Scraping por Batches) COMPLETAMENTE TERMINADA!
# 🚀 Siguiente paso: node process-vendor-categories.js B9876543210
```

---

## � GESTIÓN DE CATEGORÍAS Y PREVENCIÓN DE LOOPS

### **Problema: Loops en Categorías**

Amazon ocasionalmente presenta estructuras de categorías circulares donde:
- Una categoría grande aparece como subcategoría de una más pequeña
- El scraper entra en loops visitando las mismas categorías repetidamente
- Esto afecta especialmente a vendedores con 5000+ productos

**Ejemplo de loop detectado:**
```
Hogar y Cocina (1200 productos)
  └── Decoración (800 productos)
      └── Hogar y Cocina (1200 productos)  ← ¡LOOP!
          └── Decoración (800 productos)
              └── Hogar y Cocina...  ← Se repite infinitamente
```

### **Solución: Sistema de Categorías Marcadas (Skip List)**

El sistema ahora incluye un archivo `skip-categories.json` que permite marcar categorías problemáticas para que sean **saltadas automáticamente** durante la creación de planes.

---

### **Script: manage-batch-categories.js**

**Propósito**: Herramienta interactiva para gestionar categorías problemáticas.

**Uso**:
```powershell
# Desde PANELMAESTRO
node PANELMAESTRO.js
# → [6] Sistema Incremental
# → [4] 🔧 Gestionar categorías (saltar/ver loops)

# O directamente
node manage-batch-categories.js SELLER_ID
```

**Menú de opciones**:
```
╔═══════════════════════════════════════════════════════╗
║   🔧 GESTIÓN DE CATEGORÍAS - SELLER_ID                ║
╠═══════════════════════════════════════════════════════╣
║  [1] 🚫 Marcar categoría para saltar                  ║
║  [2] 📋 Ver categorías marcadas para saltar           ║
║  [3] ✅ Desmarcar categoría                           ║
║  [4] 🧹 Limpiar todas las marcas                      ║
║  [5] 📊 Ver categorías completadas                    ║
║  [6] ❌ Ver categorías con errores                    ║
║  [7] 🔄 Resetear progreso (progress.json)             ║
║  [0] 🚪 Salir                                         ║
╚═══════════════════════════════════════════════════════╝
```

**Funcionalidades principales**:

#### **1. Marcar categoría para saltar**
```powershell
# Cuando detectas un loop, marca la categoría problemática
[1] 🚫 Marcar categoría para saltar

Categorías disponibles:
1. Hogar y Cocina (1200 productos)
2. Electrónicos (850 productos)
3. Decoración (800 productos)
...

Nombre de la categoría a marcar: Decoración
Razón (opcional): Causa loops infinitos con Hogar y Cocina

✅ Categoría 'Decoración' marcada para saltar
   Razón: Causa loops infinitos con Hogar y Cocina
   Fecha: 2025-10-12T15:30:00.000Z
```

#### **2. Ver categorías marcadas**
```powershell
[2] 📋 Ver categorías marcadas para saltar

╔═════════════════════════════════════════════════════════╗
║ CATEGORÍAS MARCADAS PARA SALTAR                        ║
╚═════════════════════════════════════════════════════════╝

🚫 Decoración
   Razón: Causa loops infinitos con Hogar y Cocina
   Marcada: 2025-10-12 15:30

🚫 Jardín Exterior
   Razón: Categoría duplicada en estructura
   Marcada: 2025-10-12 16:00

Total: 2 categorías marcadas
```

#### **3. Desmarcar categoría**
```powershell
[3] ✅ Desmarcar categoría

Categorías marcadas actualmente:
1. Decoración
2. Jardín Exterior

Número de categoría a desmarcar [0 para cancelar]: 1

✅ Categoría 'Decoración' desmarcada exitosamente
```

---

### **Integración con create-plan-batches.js**

El script `create-plan-batches.js` ahora **lee automáticamente** el archivo `skip-categories.json` y salta las categorías marcadas:

**Ejemplo de ejecución con categorías marcadas:**
```powershell
node create-plan-batches.js A3Q5ASRA7J8Y5E

# 🏪 Vendedor: A3Q5ASRA7J8Y5E
# 📊 Total productos estimados: 10,500
# 🗂️  Categorías principales: 15
# 
# ⏭️  Categorías marcadas para saltar: 2
#     - Decoración (Causa loops infinitos)
#     - Jardín Exterior (Categoría duplicada)
# 
# 📦 === INICIANDO BATCH 1 ===
# 
# 📂 [1/15] Analizando: Hogar y Cocina
# 📊 Productos esperados: 1200
# ✅ Agregada a batch 1
# 
# 📂 [2/15] Analizando: Electrónicos
# 📊 Productos esperados: 850
# ✅ Agregada a batch 1
# 
# 🚫 SALTANDO categoría 3/15: Decoración
#    Razón: Causa loops infinitos con Hogar y Cocina
# 
# 📂 [4/15] Analizando: Juguetes
# ...
```

**Logs en consola cuando se salta:**
```
🚫 SALTANDO categoría 8/15: Jardín Exterior
   Razón: Categoría duplicada en estructura
```

---

### **Archivo skip-categories.json**

**Ubicación**: `data/vendors/SELLER_ID/skip-categories.json`

**Formato**:
```json
[
  {
    "name": "Decoración",
    "reason": "Causa loops infinitos con Hogar y Cocina",
    "marked_at": "2025-10-12T15:30:00.000Z"
  },
  {
    "name": "Jardín Exterior",
    "reason": "Categoría duplicada en estructura",
    "marked_at": "2025-10-12T16:00:00.000Z"
  }
]
```

---

### **Flujo de Trabajo para Loops**

**Cuando detectas un loop:**

1. **Detener el proceso** (Ctrl+C si está ejecutando)

2. **Marcar la categoría problemática:**
   ```powershell
   node manage-batch-categories.js SELLER_ID
   # [1] Marcar categoría para saltar
   # Nombre: [categoría que causa loop]
   # Razón: Causa loops infinitos
   ```

3. **Reanudar la creación de planes:**
   ```powershell
   node create-plan-batches.js SELLER_ID
   # Automáticamente reanuda y salta la categoría marcada
   ```

4. **Verificar que se saltó:**
   - Los logs mostrarán: `🚫 SALTANDO categoría N/M: [nombre]`
   - El batch NO incluirá esa categoría
   - Continúa con las siguientes categorías

5. **Si la categoría era válida, desmarcarla:**
   ```powershell
   node manage-batch-categories.js SELLER_ID
   # [3] Desmarcar categoría
   ```

---

### **Otras Funcionalidades**

#### **Ver categorías completadas**
```powershell
[5] 📊 Ver categorías completadas

✅ CATEGORÍAS COMPLETADAS (progress.json):
   - Hogar y Cocina
   - Electrónicos
   - Juguetes
   - Deportes
   
   Total: 4 categorías completadas
```

#### **Ver categorías con errores**
```powershell
[6] ❌ Ver categorías con errores

❌ CATEGORÍAS CON ERRORES (progress.json):
   - Mascotas
     Error: Timeout después de 30s
   
   Total: 1 categoría con errores
```

#### **Resetear progreso**
```powershell
[7] 🔄 Resetear progreso (progress.json)

⚠️  ADVERTENCIA: Esto eliminará el archivo progress.json
   Se perderá el registro de categorías completadas/falladas.

¿Está seguro? Escriba 'CONFIRMAR' para continuar: CONFIRMAR

✅ Archivo progress.json eliminado
   El próximo scraping comenzará desde cero
```

---

### **Ventajas del Sistema de Skip**

✅ **Prevención de loops infinitos**: Evita quedar atrapado en estructuras circulares  
✅ **Auditoría**: Cada skip tiene razón y timestamp  
✅ **Reversible**: Puedes desmarcar categorías fácilmente  
✅ **Transparente**: Los logs muestran qué se saltó y por qué  
✅ **Manual**: Tú decides qué categorías son problemáticas  
✅ **Persistente**: La lista se guarda entre ejecuciones  

---

## �📁 ESTRUCTURA DE ARCHIVOS

```
data/
├── projects.json                    # Estado global de vendedores
└── vendors/
    └── A3Q5ASRA7J8Y5E/
        ├── 2025-10-12-plan-batch-1.json    # Lote 1 (categorías 1-3)
        ├── 2025-10-12-plan-batch-2.json    # Lote 2 (categorías 4-7)
        ├── 2025-10-12-plan-batch-3.json    # Lote 3 (categorías 8-10)
        ├── skip-categories.json             # 🆕 Categorías marcadas para saltar
        ├── progress.json                    # Progreso de scraping
        ├── categories/                      # Datos scrapeados por categoría
        │   ├── 2025-10-12-intelligent-Hogar-A3Q5ASRA7J8Y5E.json
        │   └── ...
        └── all-products-consolidated.json   # Consolidado final
```

---

## 🎯 CASOS DE USO

### **Caso 1: Vendedor Pequeño (< 1000 productos)**

```powershell
# 1. Registrar vendedor
node test-seller.js A1234567890
# ✅ 700 productos, 8 categorías

# 2. Crear plan (UN SOLO LOTE)
node create-plan-batches.js A1234567890
# ✅ Batch 1 guardado: 700 productos, 8 categorías

# 3. Procesar
node process-all-categories.js A1234567890
```

### **Caso 2: Vendedor Grande (10,000+ productos)**

```powershell
# 1. Registrar vendedor
node test-seller.js B9876543210
# ✅ 12,500 productos, 25 categorías

# 2. Crear planes por lotes
node create-plan-batches.js B9876543210
# ✅ Batch 1: 1,050 productos (categorías 1-4)
# ✅ Batch 2: 980 productos (categorías 5-8)
# ... trabaja hasta donde puedas, se puede interrumpir

# 3. Continuar después (reanuda automáticamente)
node create-plan-batches.js B9876543210
# ♻️  REANUDANDO desde batch 5
# ✅ Batch 5: 1,100 productos
# ...

# 4. Procesar por batches (AHORA SOPORTADO)
node process-all-categories.js B9876543210
# 🔄 MODO: PROCESAMIENTO POR BATCHES
# 📦 Total batches detectados: 10
# 
# Batch 1/10: Procesando...
# ✅ Batch 1 completado
# 
# Batch 2/10: Procesando...
# ✅ Batch 2 completado
# ... (continúa con todos los batches)
```

### **Caso 3: Interrumpir y Reanudar**

```powershell
# Primera sesión (viernes tarde)
node create-plan-batches.js C555555555
# ✅ Batch 1, 2, 3 creados
# [Se va la luz o cierras el navegador]

# Segunda sesión (lunes mañana)
node create-plan-batches.js C555555555
# ♻️  REANUDANDO desde batch 4
# ⏭️  Saltando 12 categorías ya procesadas
# ✅ Batch 4, 5, 6... continúa donde se quedó
```

---

## 🔍 DIFERENCIAS: create-plan.js vs create-plan-batches.js

| Aspecto | create-plan.js (Original) | create-plan-batches.js (Nuevo) |
|---------|---------------------------|--------------------------------|
| **Salida** | 1 archivo plan.json | N archivos plan-batch-N.json |
| **Límite** | Sin límite por plan | ~1000 productos por batch |
| **Reanudación** | No soportada | Automática, detecta batches |
| **Interrupciones** | Pierde progreso | Guarda cada batch |
| **Vendedores grandes** | 1 plan enorme | Múltiples planes manejables |
| **Estado en projects.json** | `plan_created: true` | Array `batches[]` con detalle |
| **Uso recomendado** | Vendedores < 2000 | Vendedores > 2000 |

---

## 📊 ESTADOS EN PROJECTS.JSON

### **Estados de vendedor**:
- `discovered` → Registrado, sin planes
- `planned` → Planes creados (uno o más batches)
- `scraping` → En proceso de extracción
- `completed` → Scraping completado

### **Estados de batch**:
- `plan_created` → Plan creado, pendiente scraping
- `scraping` → En proceso
- `completed` → Scraping completado

---

## 💡 MEJORES PRÁCTICAS

### **1. Registra múltiples vendedores primero**
```powershell
node test-seller.js A111111111
node test-seller.js B222222222
node test-seller.js C333333333

# Luego revisa y elige cuál trabajar
node PANELMAESTRO.js
# [1] Ver detalle de un vendedor
```

### **2. Para vendedores grandes, trabaja en sesiones**
```powershell
# Sesión 1: Crea primeros 3 batches
node create-plan-batches.js B222222222
# (trabaja 1 hora, cierra)

# Sesión 2: Continúa donde quedó
node create-plan-batches.js B222222222
# (automáticamente reanuda)
```

### **3. Verifica batches antes de procesar**
```powershell
# Lista archivos de batch
ls data/vendors/B222222222/*batch*.json

# Revisa projects.json para ver progreso
cat data/projects.json | grep -A 20 "B222222222"
```

---

## 🚀 SIGUIENTE PASO: PROCESAMIENTO

Una vez creados los planes por lotes, el siguiente paso es modificar `process-all-categories.js` o crear `process-batches.js` para:

1. Detectar todos los archivos `plan-batch-N.json`
2. Procesar cada batch secuencialmente
3. Actualizar estado en `projects.json`
4. Consolidar resultados

**Próxima implementación**: Script para procesar batches automáticamente.

---

## 📞 COMANDOS RÁPIDOS

```powershell
# Registrar vendedor
node test-seller.js SELLER_ID

# Crear planes por lotes (resumible)
node create-plan-batches.js SELLER_ID

# Ver estado en panel
node PANELMAESTRO.js

# Listar batches creados
ls data/vendors/SELLER_ID/*batch*.json
```

---

**Versión**: 1.0.0  
**Autor**: Sistema de scraping incremental Amazon MX  
**Fecha**: 12 de octubre de 2025
