# 🌳 EXTRACCIÓN JERÁRQUICA POR SUBCATEGORÍAS

## 📋 Problema Resuelto

**Amazon limita la paginación a 20 páginas (320 productos) por URL**

Aunque una categoría tenga 1000 productos, Amazon solo muestra 320 productos máximo (16 productos/página × 20 páginas).

## ✅ Solución Implementada

### Sistema de Dos Fases

#### **Fase 1: Análisis Jerárquico** (Ya completado)
```bash
node process-single-batch.js SELLER_ID BATCH_NUMBER
```
- Ejecuta `category-intelligent.js`
- Identifica **subcategorías hoja** (sin más subdivisiones)
- Crea archivos `intelligent-*.json` con estructura:
  ```json
  {
    "subcategories": [
      {
        "url": "...",
        "name": "Subcategoría 1",
        "productCount": 150,
        "isLeaf": true  ← Hoja del árbol
      },
      {
        "url": "...",
        "name": "Subcategoría 2",
        "productCount": 280,
        "isLeaf": true
      }
    ]
  }
  ```

#### **Fase 2: Extracción por Subcategorías** ⭐ NUEVO
```bash
node extract-batch-products.js SELLER_ID BATCH_NUMBER
```
- Lee archivos `intelligent-*.json`
- Extrae productos de **cada subcategoría hoja**
- Cada subcategoría = máximo 320 productos
- **Sin límite de subcategorías** = Sin límite total de productos
- Consolida todos los productos en un archivo por categoría

---

## 🎯 Ejemplo Real: Deportes y Aire Libre

### Problema Anterior:
```
Deportes y Aire Libre (URL padre)
└─ 675 productos esperados
   └─ Amazon solo muestra 320 ❌
   └─ Se pierden 355 productos ❌
```

### Solución Nueva:
```
Deportes y Aire Libre (categoría padre)
├─ Accesorios (27 productos) ✅ 27 extraídos
├─ Artes Marciales (12 productos) ✅ 12 extraídos
├─ Basquetbol (25 productos) ✅ 25 extraídos
├─ Béisbol (24 productos) ✅ 24 extraídos
├─ Campismo (49 productos) ✅ 49 extraídos
├─ Ciclismo (37 productos) ✅ 37 extraídos
├─ Correr (44 productos) ✅ 44 extraídos
├─ ... (más subcategorías)
└─ TOTAL: 675 productos ✅ Todos extraídos
```

**Cada subcategoría < 320 productos = Sin pérdida de datos**

---

## 🔄 Flujo Completo Actualizado

### 1️⃣ Crear Plan (una vez)
```bash
node create-plan-batches.js SELLER_ID
```
**Genera:** `plan-batch-1.json`, `plan-batch-2.json`, etc.

### 2️⃣ Análisis Jerárquico (una vez por batch)
```bash
node process-single-batch.js SELLER_ID BATCH_NUMBER
```
**Genera:** `intelligent-*.json` con subcategorías identificadas

**Ejemplo de salida:**
```
🌳 Analizando: Deportes y Aire libre
   ├─ Detectadas 16 subcategorías
   ├─ Profundidad máxima: 2 niveles
   └─ Total productos: 675
```

### 3️⃣ Extracción por Subcategorías ⭐ NUEVO
```bash
node extract-batch-products.js SELLER_ID BATCH_NUMBER
```
**Proceso:**
1. Lee `intelligent-*.json` de cada categoría
2. Filtra subcategorías hoja (`isLeaf: true`)
3. Extrae productos de cada subcategoría (URL única)
4. Consolida en un solo archivo por categoría

**Ejemplo de salida:**
```
📂 Deportes y Aire libre
🌳 Subcategorías hoja encontradas: 16

   📁 [1/16] Accesorios
   📊 27 productos
   ✅ 27 productos extraídos
   ⏸️ Pausa: 3.2s

   📁 [2/16] Artes Marciales
   📊 12 productos
   ✅ 12 productos extraídos
   ⏸️ Pausa: 2.8s
   
   ... (continúa con todas)
   
💾 Consolidado: 675 productos guardados
```

**Genera:** `deportes-y-aire-libre-products.json` con TODOS los productos

### 4️⃣ Consolidar Batch
```bash
node consolidate-batch-products.js SELLER_ID BATCH_NUMBER
```
**Genera:** `batch-N-consolidated.csv` listo para publicar

---

## 📊 Ventajas del Nuevo Sistema

| Aspecto | Sistema Anterior | Sistema Nuevo |
|---------|-----------------|---------------|
| **Límite por URL** | 320 productos | 320 productos |
| **Categorías grandes** | ❌ Pérdida de productos | ✅ Extracción completa |
| **Método** | URL de categoría padre | URL de cada subcategoría |
| **Productos extraídos** | Hasta 320 | **Sin límite** |
| **Seguridad** | ✅ Cookies, pausas, scrolls | ✅ Mismo sistema |
| **Eficiencia** | N/A | ✅ Procesa subcategorías en paralelo |

---

## 🔍 Estructura de Archivos

### Después del Análisis (Fase 2):
```
data/vendors/SELLER_ID/
├── 2025-10-13-plan-batch-1.json           ← Plan del batch
├── 2025-10-13-intelligent-alimentos.json  ← Análisis jerárquico
├── 2025-10-13-intelligent-deportes.json   ← Análisis jerárquico
└── progress.json                           ← Estado de progreso
```

### Después de la Extracción (Fase 3):
```
data/vendors/SELLER_ID/
├── alimentos-y-bebidas-products.json      ← Productos extraídos ✨
├── deportes-y-aire-libre-products.json    ← Productos extraídos ✨
└── ... (archivos temporales de subcategorías)
```

**Formato del archivo consolidado:**
```json
{
  "metadata": {
    "seller_id": "AE8MUNDUREHX7",
    "category_name": "Deportes y Aire libre",
    "total_products": 675,
    "subcategories_processed": 16,
    "extraction_method": "subcategory_extraction_v2"
  },
  "products": [
    {
      "asin": "B08XX123",
      "title": "Producto 1",
      "price": "$1234.56"
    },
    ...
  ]
}
```

---

## 💡 Casos Especiales

### Categoría sin Subcategorías
Si `intelligent-*.json` no tiene subcategorías o solo tiene 1:
```
⚠️ No hay subcategorías, extrayendo de URL principal...
```
→ Extrae directamente de la URL de la categoría (máximo 320 productos)

### Subcategoría > 320 Productos
Si una subcategoría tiene > 320 productos, Amazon la subdivide automáticamente.
El análisis jerárquico (`category-intelligent.js`) ya lo detecta y crea más subcategorías.

### Errores en Subcategorías
Si alguna subcategoría falla:
```
⚠️ Completado con 2 errores en subcategorías
💾 Consolidado: 540 productos (de 675 esperados)
```
→ Guarda los productos extraídos exitosamente
→ Puedes re-ejecutar para reintentar solo las fallidas

---

## 🎬 Ejemplo Completo: Batch 1

```bash
# 1. Plan ya creado ✅
# 2. Análisis jerárquico ya completado ✅

# 3. Extraer productos de batch 1
node extract-batch-products.js AE8MUNDUREHX7 1

# Output esperado:
📦 Batch 1: 3 categorías
📊 Productos esperados: 708

📂 [1/3] Alimentos y Bebidas
🌳 Subcategorías hoja: 1
   ✅ 55 productos extraídos

📂 [2/3] Automotriz y Motocicletas
🌳 Subcategorías hoja: 8
   ✅ 384 productos extraídos

📂 [3/3] Bebé
🌳 Subcategorías hoja: 5
   ✅ 269 productos extraídos

📊 RESUMEN:
✅ Categorías completadas: 3
🌳 Subcategorías procesadas: 14
📁 Total productos: 708

# 4. Consolidar batch 1
node consolidate-batch-products.js AE8MUNDUREHX7 1

# Output:
📦 Batch 1 consolidado: 708 productos
💾 batch-1-consolidated.csv
```

---

## 🆘 Troubleshooting

### ❌ "No se encontró archivo de análisis"
```bash
# Falta ejecutar el análisis jerárquico
node process-single-batch.js SELLER_ID BATCH_NUMBER
```

### ❌ "0 subcategorías hoja encontradas"
El archivo `intelligent-*.json` puede tener:
- Solo 1 subcategoría (la categoría padre)
- Extracción fallará si categoría tiene > 320 productos

**Solución:** Re-ejecutar análisis con mayor profundidad:
```bash
# Editar category-intelligent.js: MAX_DEPTH = 4
node category-intelligent.js SELLER_ID CATEGORY_NAME
```

### ✅ Verificar Extracción Correcta
```bash
# Ver total de productos extraídos
node consolidate-batch-products.js SELLER_ID BATCH_NUMBER

# Debería mostrar:
📦 Batch 1: 708 productos (esperados: 708) ✅
```

---

## 📚 Scripts Relacionados

| Script | Fase | Propósito |
|--------|------|-----------|
| `create-plan-batches.js` | 1 | Divide en batches |
| `process-single-batch.js` | 2 | **Análisis jerárquico** |
| `extract-batch-products.js` | 3 | **Extracción por subcategorías** ⭐ |
| `consolidate-batch-products.js` | 4 | Consolidación final |

---

## ✅ Resumen Técnico

**Sistema Anterior:**
- Extracción de URL de categoría padre
- Límite: 320 productos por categoría
- Pérdida de datos en categorías grandes

**Sistema Nuevo:**
- Análisis jerárquico previo (intelligent-*.json)
- Extracción de cada subcategoría hoja
- Límite: 320 productos **por subcategoría**
- Sin límite total (N subcategorías × 320)
- Consolidación automática al finalizar

**Clave del éxito:** Dividir categorías grandes en subcategorías pequeñas < 320 productos cada una. Amazon ya lo hace naturalmente en su estructura de navegación.
