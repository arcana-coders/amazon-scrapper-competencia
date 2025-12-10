# 📜 Scripts y Fases del Pipeline

Documentación completa de todos los scripts utilizados en el pipeline automático y cómo se corresponden con las opciones manuales de MENU.

---

## 🔄 Flujo Completo del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  1. REGISTRAR VENDEDOR (Manual - MENU)                          │
│     → data/projects.json                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. GENERAR PLAN (Automático/Manual)                             │
│     Script: create-plan-batches.js                               │
│     Output: data/vendors/<ID>/plan-batch-N.json                  │
│     Descripción: Divide productos en batches si > 1000 productos│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. SCRAPING (Automático/Manual)                                 │
│     Script: extract-batch-products.js                            │
│     Args: <sellerId> all                                         │
│     Output: data/vendors/<ID>/batch-N-products.json              │
│     Descripción: Extrae productos de Amazon MX (Playwright)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. CONSOLIDACIÓN (Automático/Manual)                            │
│     Script: consolidate-batch-products.js                        │
│     Args: <sellerId> all                                         │
│     Output: data/vendors/<ID>/batch-N-consolidated.json          │
│     Descripción: Combina datos de scraping en archivos únicos   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. VERIFICACIÓN MX (Automático/Manual)                          │
│     Script: verify-products-mx-batch.js                          │
│     Args: <sellerId> <batchNum> <lote>                           │
│     Comportamiento: Loop hasta completar CADA batch              │
│     Output: Actualiza batch-N-consolidated.json (precio_mx, etc)│
│     Descripción: Verifica precios en Amazon MX (Playwright)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. VERIFICACIÓN USA (Automático/Manual)                         │
│     Script: verify-products-usa-batch.js                         │
│     Args: <sellerId> <batchNum> <lote>                           │
│     Comportamiento: Loop hasta completar CADA batch              │
│     Output: Actualiza batch-N-consolidated.json (precio_usd, etc│
│     Descripción: Verifica precios en Amazon USA (Playwright)    │
│                                                                   │
│     IMPORTANTE: Este paso usa "Opción [2]" de MENU:             │
│     - Verifica TODOS los batches uno por uno                     │
│     - Loop automático hasta completar cada batch                 │
│     - Lote de 20 productos por iteración                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. GENERAR OPORTUNIDADES CONSOLIDADAS (Automático/Manual)       │
│     Script: generar-oportunidades-consolidadas.js                │
│     Args: <sellerId>                                             │
│     Output: data/vendors/<ID>/vendedor-oportunidades*.csv        │
│     Descripción: Consolida TODOS los batches y genera CSVs      │
│     de máximo 500 ASINs por archivo                              │
│                                                                   │
│     IMPORTANTE: Este paso usa "Opción [3]" de MENU:             │
│     - Consolida TODOS los batches en un solo proceso             │
│     - Aplica filtros de rentabilidad                             │
│     - Divide en archivos de 500 ASINs                            │
│     - Genera 3 tipos: principal, menos-50, menos-100             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Correspondencia MENU ↔ Pipeline

### MENU Opción [5]: Verificar en Amazon USA

**Manual (MENU):**
```
[5] 🇺🇸 Verificar en Amazon USA (Fase 3)
  └─ [1] Verificar productos de un vendedor
      └─ [2] Verificar todos los batches  ← USAMOS ESTA OPCIÓN
```

**Automático (Pipeline):**
```javascript
// pipeline-config.js
verificar_usa: {
  path: '../scripts/verify-products-usa-batch.js',
  args: [null, '20'] // Lote de 20 productos
}

// phase-executor.js - ejecutarFaseConLoop()
// Loop hasta completar CADA batch automáticamente
```

---

### MENU Opción [6]: Generar Oportunidades

**Manual (MENU):**
```
[6] 💰 Generar Oportunidades (Fase 4)
  └─ [1] Generar oportunidades de un vendedor
      └─ [3] Generar oportunidades consolidadas (máx 500 ASINs por archivo)  ← USAMOS ESTA OPCIÓN
```

**Automático (Pipeline):**
```javascript
// pipeline-config.js
oportunidades: {
  path: '../generar-oportunidades-consolidadas.js',
  args: [] // Genera oportunidades consolidadas
}

// phase-executor.js
// Se ejecuta UNA SOLA VEZ para consolidar todos los batches
```

---

## 🆚 Diferencias Clave

### Antes (Incorrecto)
```
Pipeline ejecutaba:
- generar-oportunidades.js para batch 1
- generar-oportunidades.js para batch 2
- generar-oportunidades.js para batch 3
...

Resultado:
- batch-1-oportunidades.csv
- batch-2-oportunidades.csv
- batch-3-oportunidades.csv
...

Equivalente a MENU Opción [2] (no es lo que queremos)
```

### Ahora (Correcto)
```
Pipeline ejecuta:
- generar-oportunidades-consolidadas.js (UNA SOLA VEZ)

Resultado:
- vendedor-oportunidades.csv (o vendedor-oportunidades-parte-1.csv, parte-2.csv, etc.)
- vendedor-oportunidades-menos-50.csv
- vendedor-oportunidades-menos-100.csv

Equivalente a MENU Opción [3] ✅
```

---

## 📁 Archivos Generados por Fase

### Fase 2: Plan
```
data/vendors/<SELLER_ID>/
  ├── plan-batch-1.json
  ├── plan-batch-2.json
  └── ...
```

### Fase 3: Scraping
```
data/vendors/<SELLER_ID>/
  ├── batch-1-products.json
  ├── batch-2-products.json
  └── ...
```

### Fase 4: Consolidación
```
data/vendors/<SELLER_ID>/
  ├── batch-1-consolidated.json  ← Datos crudos + estructura
  ├── batch-2-consolidated.json
  └── ...
```

### Fase 5-6: Verificaciones (MX + USA)
```
data/vendors/<SELLER_ID>/
  ├── batch-1-consolidated.json  ← Actualizado con precio_mx, precio_usd, etc.
  ├── batch-2-consolidated.json
  └── ...
```

### Fase 7: Oportunidades Consolidadas
```
data/vendors/<SELLER_ID>/
  ├── vendedor-oportunidades.csv              ← Si < 500 productos
  ├── vendedor-oportunidades-parte-1.csv      ← Si > 500 productos
  ├── vendedor-oportunidades-parte-2.csv
  ├── vendedor-oportunidades-menos-50.csv
  └── vendedor-oportunidades-menos-100.csv
```

---

## 🔧 Scripts Utilizados

### Scripts de Verificación (Loop Automático)

**verify-products-mx-batch.js**
- Ubicación: `scripts/verify-products-mx-batch.js`
- Comportamiento: El pipeline ejecuta múltiples veces hasta completar cada batch
- Args: `<sellerId> <batchNumber> <lote>`
- Equivalente a: MENU Opción [4] → [1] → [2] "Verificar todos los batches"

**verify-products-usa-batch.js**
- Ubicación: `scripts/verify-products-usa-batch.js`
- Comportamiento: El pipeline ejecuta múltiples veces hasta completar cada batch
- Args: `<sellerId> <batchNumber> <lote>`
- Equivalente a: MENU Opción [5] → [1] → [2] "Verificar todos los batches"

### Script de Oportunidades (Ejecución Única)

**generar-oportunidades-consolidadas.js**
- Ubicación: `generar-oportunidades-consolidadas.js` (raíz del proyecto)
- Comportamiento: Se ejecuta UNA SOLA VEZ, consolida todos los batches
- Args: `<sellerId>`
- Equivalente a: MENU Opción [6] → [1] → [3] "Generar oportunidades consolidadas"

**Lógica del script:**
1. Lee todos los `batch-N-consolidated.json`
2. Consolida eliminando duplicados por ASIN
3. Aplica filtros de rentabilidad (precio sugerido, márgenes)
4. Divide en archivos de 500 ASINs máximo
5. Genera 3 tipos de archivos (principal, menos-50, menos-100)

**Origen de la lógica:**
- Replicado EXACTAMENTE de `modules/menu-oportunidades.js` líneas 720-1005
- Criterios de negocio idénticos al MENU manual
- Solo se eliminó la interacción con usuario (readline)

---

## 💡 Notas Importantes

1. **Verificaciones con Loop**: Las fases de verificación (MX y USA) usan un loop automático hasta completar todos los productos de cada batch. Esto evita tener que ejecutar manualmente múltiples veces.

2. **Oportunidades Consolidadas**: A diferencia de las verificaciones, las oportunidades se generan en UNA SOLA ejecución que consolida todos los batches. Esto replica exactamente la Opción [3] de MENU.

3. **Lógica Intacta**: El script `generar-oportunidades-consolidadas.js` mantiene TODA la lógica de negocio original:
   - Tipo de cambio: 41.79
   - Costos importación: 314.81 MXN
   - Precio máximo: $7,000
   - Precio mínimo principal: $699
   - Precio mínimo otros: $1,000
   - Ajuste competitivo: -$100 (productos <= $2,500), -$200 (productos > $2,500)
   - División en chunks de 500 ASINs

4. **Archivos de Salida**: Los archivos generados son exactamente iguales a los que genera MENU manualmente con la Opción [3].

---

## 🚀 Ejecución Manual de Scripts

Si necesitas ejecutar algún script manualmente (fuera del pipeline):

```bash
# Verificar USA de un batch específico (20 productos por lote)
node scripts/verify-products-usa-batch.js A3HNKG44RHL123 1 20

# Generar oportunidades consolidadas
node generar-oportunidades-consolidadas.js A3HNKG44RHL123
```

---

## 📝 Changelog

### 2025-12-07 - Consolidación de Oportunidades
- ✅ Creado `generar-oportunidades-consolidadas.js` (replica MENU Opción [3])
- ✅ Actualizado `pipeline-config.js` para usar consolidación
- ✅ Actualizado `phase-executor.js` para ejecutar una sola vez (no iterar batches)
- ✅ Documentado flujo completo en `SCRIPTS-Y-FASES.md`

### Antes de 2025-12-07
- ❌ Pipeline usaba `generar-oportunidades.js` iterando cada batch (Opción [2])
- ❌ Generaba archivos separados por batch
- ❌ No coincidía con el proceso manual que se usaba en MENU
