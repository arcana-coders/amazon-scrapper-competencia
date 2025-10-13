# 🎯 SISTEMA COMPLETO: EXTRACCIÓN POR BATCH CON SUBCATEGORÍAS

## 📋 Resumen Ejecutivo

**Problema**: Amazon limita paginación a 320 productos por URL  
**Solución**: Extracción jerárquica por subcategorías usando análisis previo  
**Resultado**: Sin límite de productos, archivos JSON y CSV automáticos

---

## 🔄 Flujo Completo (3 Pasos)

### 1️⃣ Análisis Jerárquico (Una vez)
```bash
node process-single-batch.js SELLER_ID BATCH_NUMBER
```
- Ejecuta `category-intelligent.js`
- Identifica subcategorías hoja
- Crea archivos `intelligent-*.json`
- **NO extrae productos** (solo análisis)

**Tiempo:** 5-10 minutos  
**Output:** Archivos `intelligent-*.json` con subcategorías

### 2️⃣ Extracción por Subcategorías
```bash
node extract-batch-products.js SELLER_ID BATCH_NUMBER
```
- Lee archivos `intelligent-*.json`
- Extrae productos de cada subcategoría hoja
- Cada subcategoría: máximo 320 productos
- Sin límite de subcategorías = Sin límite total
- Usa cookies, pausas, scrolls (seguridad completa)
- Crea archivos `*-products.json`

**Tiempo:** 20-60 minutos (depende de número de subcategorías)  
**Output:** Archivos `*-products.json` con productos reales

### 3️⃣ Consolidación (JSON + CSV)
```bash
node consolidate-batch-products.js SELLER_ID BATCH_NUMBER
```
- Lee todos los `*-products.json`
- Elimina duplicados por ASIN
- **Genera JSON consolidado**
- **Genera CSV consolidado** ⭐

**Tiempo:** < 1 minuto  
**Output:** 
- `batch-N-consolidated.json`
- `batch-N-consolidated.csv` ✨

---

## 🎬 Ejemplo Completo: Batch 1

```bash
# PASO 1: Análisis (si no está hecho)
node process-single-batch.js AE8MUNDUREHX7 1

# PASO 2: Extracción por subcategorías
node extract-batch-products.js AE8MUNDUREHX7 1

# Output:
📦 Batch 1: 3 categorías
📊 Productos esperados: 708

📂 [1/3] Alimentos y Bebidas
🌳 Subcategorías hoja: 1
   ✅ 54 productos extraídos

📂 [2/3] Automotriz y Motocicletas
🌳 Subcategorías hoja: 8
   ✅ 384 productos extraídos

📂 [3/3] Bebé
🌳 Subcategorías hoja: 5
   ✅ 270 productos extraídos

✅ Total: 708 productos

# PASO 3: Consolidación (genera JSON + CSV automáticamente)
node consolidate-batch-products.js AE8MUNDUREHX7 1

# Output:
📊 === RESUMEN BATCH 1 ===
✅ Productos únicos: 708
💾 batch-1-consolidated.json ✅
💾 batch-1-consolidated.csv ✅
```

---

## 📁 Archivos Generados

### Después del Análisis (Paso 1):
```
data/vendors/AE8MUNDUREHX7/
├── 2025-10-13-plan-batch-1.json
├── 2025-10-13-intelligent-alimentos-y-bebidas.json
├── 2025-10-13-intelligent-automotriz.json
└── 2025-10-13-intelligent-bebé.json
```

### Después de la Extracción (Paso 2):
```
data/vendors/AE8MUNDUREHX7/
├── alimentos-y-bebidas-products.json        ← Productos extraídos
├── automotriz-y-motocicletas-products.json  ← Productos extraídos
└── bebé-products.json                       ← Productos extraídos
```

### Después de la Consolidación (Paso 3):
```
data/vendors/AE8MUNDUREHX7/
├── batch-1-consolidated.json  ← ✨ CONSOLIDADO JSON
└── batch-1-consolidated.csv   ← ✨ CONSOLIDADO CSV (para Excel/Seller Central)
```

---

## 📊 Formato del CSV

```csv
asin,title,price,url,category,batch_number
"B08XX123","Producto ejemplo","$1234.56","https://...","Alimentos y Bebidas",1
"B09YY456","Otro producto","$567.89","https://...","Automotriz",1
```

**Características:**
- ✅ Comillas dobles escapadas correctamente
- ✅ UTF-8 encoding
- ✅ Compatible con Excel, Google Sheets
- ✅ Listo para Amazon Seller Central
- ✅ Incluye batch_number para tracking

---

## 🚀 Desde PANELMAESTRO

```bash
node PANELMAESTRO.js
```

**Menú:** `[6] Sistema Incremental por Lotes` → `[3] Extraer productos de batch`

**Flujo automático:**
1. Elige vendedor
2. Elige batch
3. **Extrae productos** (paso 2)
4. **Consolida automáticamente** (paso 3)
5. **Genera CSV automáticamente** ✨

**Resultado:** Archivos JSON y CSV listos en `data/vendors/SELLER_ID/`

---

## 🌳 Ventajas del Sistema Jerárquico

| Aspecto | Sistema Anterior | Sistema Nuevo |
|---------|------------------|---------------|
| **Límite por URL** | 320 productos | 320 productos |
| **Categorías > 320** | ❌ Pérdida de datos | ✅ Extracción completa |
| **Método** | URL de categoría padre | URL de cada subcategoría |
| **Productos totales** | Hasta 320 | **Sin límite** |
| **Subcategorías** | No soportado | ✅ N × 320 productos |
| **Seguridad** | ✅ Cookies, pausas | ✅ Mismo sistema |
| **CSV automático** | ❌ No | ✅ Sí |

---

## 💡 Ejemplo Real: Deportes y Aire Libre

**Sin Sistema Jerárquico:**
```
Deportes y Aire Libre (URL padre)
└─ 675 productos esperados
   └─ Amazon muestra solo 320 ❌
   └─ Se pierden 355 productos (52%) ❌
```

**Con Sistema Jerárquico:**
```
Deportes y Aire Libre (categoría padre)
├─ Accesorios (27 productos) → 27 extraídos ✅
├─ Artes Marciales (12 productos) → 12 extraídos ✅
├─ Basquetbol (25 productos) → 25 extraídos ✅
├─ Béisbol (24 productos) → 24 extraídos ✅
├─ Campismo (49 productos) → 49 extraídos ✅
├─ ... (11 subcategorías más)
└─ TOTAL: 675 productos → 675 extraídos ✅ (100%)
```

---

## 🆘 Troubleshooting

### ❌ Error: "No se encontró archivo de análisis"
```bash
# Ejecutar análisis primero
node process-single-batch.js SELLER_ID BATCH_NUMBER
```

### ❌ Consolidación muestra 0 productos
```bash
# Verificar que existan archivos *-products.json
dir data\vendors\SELLER_ID\*-products.json

# Si no existen, ejecutar extracción
node extract-batch-products.js SELLER_ID BATCH_NUMBER
```

### ❌ CSV no se generó
```bash
# El CSV se genera automáticamente con el JSON
# Verificar que consolidate-batch-products.js terminó exitosamente

# Ver archivos generados
dir data\vendors\SELLER_ID\batch-*-consolidated.*
```

### ✅ Verificar extracción correcta
```bash
# Consolidar y verificar
node consolidate-batch-products.js SELLER_ID BATCH_NUMBER

# Debería mostrar:
# ✅ Productos únicos: XXX (cerca del esperado)
# 💾 batch-N-consolidated.json
# 💾 batch-N-consolidated.csv
```

---

## 📚 Documentación Relacionada

| Archivo | Contenido |
|---------|-----------|
| `README-EXTRACCION-JERARQUICA.md` | Sistema jerárquico detallado |
| `README-CONSOLIDACION-CSV.md` | Generación de CSV |
| `README-BATCH-INDIVIDUAL.md` | Procesamiento batch por batch |
| `DOCUMENTACION-MAESTRA.md` | Guía completa del proyecto |

---

## ✅ Checklist de Éxito

**Después de ejecutar los 3 pasos, debes tener:**

- [ ] Archivos `intelligent-*.json` (análisis)
- [ ] Archivos `*-products.json` (productos extraídos)
- [ ] Archivo `batch-N-consolidated.json` ✨
- [ ] Archivo `batch-N-consolidated.csv` ✨
- [ ] CSV se abre correctamente en Excel
- [ ] Número de productos en CSV ≈ Productos esperados
- [ ] Todos los campos tienen datos (asin, title, price)

---

## 🎯 Próximos Pasos

Después de tener el CSV:

1. **Verificar en Excel/Sheets**
   ```bash
   start data\vendors\AE8MUNDUREHX7\batch-1-consolidated.csv
   ```

2. **Verificación en Amazon USA** (Fase 2)
   ```bash
   node verify-batch-usa.js AE8MUNDUREHX7 1
   ```

3. **Filtrado de oportunidades** (Fase 3)
   ```bash
   node filter-opportunities-batch.js AE8MUNDUREHX7 1
   ```

4. **Publicación en Seller Central** (Fase 4)
   - Usa el CSV generado
   - O continúa con el flujo de publicación automatizado

---

## 🎊 Resumen Final

✅ **Sistema Jerárquico**: Sin límite de productos  
✅ **Extracción Automática**: Por subcategorías  
✅ **Consolidación Automática**: JSON + CSV  
✅ **Seguridad Completa**: Cookies, pausas, scrolls  
✅ **Listo para Producción**: Archivos CSV para Seller Central  

**Todo funciona desde PANELMAESTRO con un par de clics** 🎮
