# 🎯 EXTRACCIÓN DE PRODUCTOS POR BATCH

## Descripción

Este sistema permite **extraer productos** de batches específicos que ya tienen el **análisis de categorías completado**. Puedes procesar batch por batch sin esperar a que termine todo el vendedor.

---

## 📋 Flujo de Trabajo Completo

### 1️⃣ Crear Plan por Lotes (una sola vez)
```bash
node create-plan-batches.js SELLER_ID
```
- Divide las categorías en batches manejables
- Crea archivos `plan-batch-1.json`, `plan-batch-2.json`, etc.

### 2️⃣ Analizar Categorías (una sola vez por batch)
```bash
node process-single-batch.js SELLER_ID BATCH_NUMBER
```
- Analiza la jerarquía de categorías del batch
- Identifica subcategorías y cuenta productos
- Crea archivos `intelligent-*.json` con la estructura
- **NO extrae productos todavía** (solo análisis)

### 3️⃣ Extraer Productos (cuando quieras)
```bash
node extract-batch-products.js SELLER_ID BATCH_NUMBER
```
- **Lee el plan del batch** (debe existir `plan-batch-N.json`)
- **Extrae productos** de cada categoría del batch
- Crea archivos `*-products.json` con los datos
- Puedes ejecutarlo múltiples veces si falla

### 4️⃣ Consolidar Productos
```bash
node consolidate-batch-products.js SELLER_ID BATCH_NUMBER
```
- Consolida todos los productos del batch
- Genera `batch-N-consolidated.json` y `batch-N-consolidated.csv`
- Listo para publicar en Amazon

---

## 🚀 Uso desde PANELMAESTRO

### Menú Principal → [6] Gestión por Lotes

**[1] Crear planes por lotes** → Divide en batches (paso 1)

**[2] Analizar categorías por batch** → Analiza estructura (paso 2)

**[3] Extraer productos de batch** → **Extrae y consolida** (pasos 3+4)
- Elige vendedor
- Elige batch
- Extrae productos automáticamente
- Consolida al finalizar

**[4] Consolidar batch** → Solo consolida (si ya tienes productos)

---

## 📊 Estados de los Batches

| Estado | Descripción | Siguiente Paso |
|--------|-------------|---------------|
| `planned` | Plan creado, sin análisis | `process-single-batch.js` |
| `analyzing` | Analizando categorías | Esperar o reintentar |
| `analyzed` | Análisis completo | **`extract-batch-products.js`** ← TÚ ESTÁS AQUÍ |
| `scraping` | Extrayendo productos | Esperar o reintentar |
| `completed` | Todo listo | `consolidate-batch-products.js` |

---

## 🎯 Escenario Real: Tu Caso

Tienes un vendedor con **8 batches**, todos ya analizados:

```bash
# Batch 1 analizado ✅ → Extraer productos
node extract-batch-products.js AE8MUNDUREHX7 1

# Mientras extrae batch 1, puedes empezar batch 2
node extract-batch-products.js AE8MUNDUREHX7 2

# O desde el PANELMAESTRO:
# [6] → [3] → Elige vendedor → Elige batch
```

**Ventaja**: No necesitas esperar a que termine el batch 1 para empezar el 2.

---

## 🔍 Verificar Estado

### Archivos que debe tener cada batch después del análisis:
```
data/vendors/AE8MUNDUREHX7/
├── 2025-10-13-plan-batch-1.json       ← Plan (paso 1)
├── 2025-10-13-intelligent-alimentos.json ← Análisis (paso 2)
├── 2025-10-13-intelligent-belleza.json   ← Análisis (paso 2)
└── ...
```

### Archivos que tendrá después de extraer productos:
```
data/vendors/AE8MUNDUREHX7/
├── alimentos-y-bebidas-products.json  ← Productos (paso 3) ✨ NUEVO
├── belleza-products.json              ← Productos (paso 3) ✨ NUEVO
├── batch-1-consolidated.json          ← Consolidado (paso 4)
└── batch-1-consolidated.csv           ← Consolidado (paso 4)
```

---

## 🆘 Solución de Problemas

### ❌ "No se encontraron archivos de batch"
```bash
# Primero crea el plan por lotes
node create-plan-batches.js SELLER_ID
```

### ❌ "No se encontró intelligent-*.json"
```bash
# Primero analiza las categorías
node process-single-batch.js SELLER_ID BATCH_NUMBER
```

### ❌ "Consolidación encontró 0 productos"
```bash
# Extrae los productos primero
node extract-batch-products.js SELLER_ID BATCH_NUMBER
```

### ✅ Verificar qué categorías ya tienen productos
```bash
# Ver archivos en la carpeta del vendedor
dir data\vendors\SELLER_ID\*-products.json
```

---

## 💡 Tips

1. **Extrae mientras publicas**: Mientras publicas batch 1, extrae batch 2
2. **Reintentos**: Si falla alguna categoría, vuelve a ejecutar
3. **Batch "all"**: Extrae todos los batches de una vez
   ```bash
   node extract-batch-products.js SELLER_ID all
   ```
4. **Verificación**: Después de extraer, verifica el archivo consolidado
   ```bash
   node consolidate-batch-products.js SELLER_ID BATCH_NUMBER
   ```

---

## 🎬 Ejemplo Completo

```bash
# 1. Crear plan (una sola vez)
node create-plan-batches.js AE8MUNDUREHX7
# → Crea 8 batches

# 2. Analizar batch 1 (una sola vez)
node process-single-batch.js AE8MUNDUREHX7 1
# → Crea intelligent-*.json

# 3. Extraer productos de batch 1
node extract-batch-products.js AE8MUNDUREHX7 1
# → Crea *-products.json

# 4. Consolidar batch 1
node consolidate-batch-products.js AE8MUNDUREHX7 1
# → Crea batch-1-consolidated.csv

# 5. Publicar batch 1 en Amazon
# (proceso manual en Seller Central)

# 6. Mientras tanto, extraer batch 2
node extract-batch-products.js AE8MUNDUREHX7 2

# 7. Y así sucesivamente...
```

---

## 📚 Scripts Relacionados

| Script | Propósito |
|--------|-----------|
| `create-plan-batches.js` | Divide categorías en batches |
| `process-single-batch.js` | Analiza jerarquía de categorías |
| **`extract-batch-products.js`** | **Extrae productos del batch** ⭐ |
| `consolidate-batch-products.js` | Consolida productos extraídos |
| `PANELMAESTRO.js` | Interfaz unificada para todo |

---

## 🎯 Diferencia Clave

**Antes (proceso-vendor-categories.js)**:
- Extraía productos de **TODAS** las categorías del vendedor
- No permitía procesar por batch

**Ahora (extract-batch-products.js)**:
- Extrae productos solo del **batch específico**
- Permite procesar batch por batch
- Perfecto para ir publicando mientras se sigue extrayendo

---

## ✅ Resumen

1. ✅ **Plan creado** → `create-plan-batches.js`
2. ✅ **Categorías analizadas** → `process-single-batch.js`
3. 🎯 **Productos extraídos** → `extract-batch-products.js` ← **USA ESTO**
4. 📦 **Productos consolidados** → `consolidate-batch-products.js`
5. 🚀 **Publicar en Amazon** → Seller Central

**Tu vendedor está en el paso 2, listo para el paso 3.**
