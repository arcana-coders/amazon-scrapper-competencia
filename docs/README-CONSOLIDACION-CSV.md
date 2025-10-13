# 📊 CONSOLIDACIÓN Y GENERACIÓN DE CSV

## Proceso Automático

El sistema genera **automáticamente** tanto JSON como CSV al consolidar un batch.

---

## 🔄 Comando de Consolidación

```bash
node consolidate-batch-products.js SELLER_ID BATCH_NUMBER
```

**Ejemplo:**
```bash
node consolidate-batch-products.js AE8MUNDUREHX7 1
```

---

## 📦 Archivos Generados

### 1️⃣ JSON Consolidado
**Archivo:** `batch-N-consolidated.json`

**Estructura:**
```json
{
  "metadata": {
    "seller_id": "AE8MUNDUREHX7",
    "batch_number": 1,
    "consolidation_date": "2025-10-13T...",
    "total_products": 708,
    "categories_in_batch": [
      "Alimentos y Bebidas",
      "Automotriz y Motocicletas",
      "Bebé"
    ],
    "categories_processed": 3,
    "duplicates_removed": 0,
    "source_files": [...]
  },
  "categories": [
    {
      "name": "Alimentos y Bebidas",
      "products_count": 54,
      "source_file": "alimentos-y-bebidas-products.json"
    },
    ...
  ],
  "all_products": [
    {
      "asin": "B08XX123",
      "title": "Producto ejemplo",
      "price": "$1234.56",
      "url": "https://...",
      "category": "Alimentos y Bebidas",
      "batch_number": 1
    },
    ...
  ]
}
```

### 2️⃣ CSV Consolidado ⭐
**Archivo:** `batch-N-consolidated.csv`

**Formato:**
```csv
asin,title,price,url,category,batch_number
"B08XX123","Producto ejemplo","$1234.56","https://...","Alimentos y Bebidas",1
"B09YY456","Otro producto","$567.89","https://...","Automotriz",1
...
```

**Características del CSV:**
- ✅ Comillas dobles escapadas correctamente (`""`)
- ✅ Codificación UTF-8
- ✅ Compatible con Excel, Google Sheets
- ✅ Listo para importar a Amazon Seller Central
- ✅ Incluye batch_number para tracking

---

## 🎯 Flujo Completo: Extracción → Consolidación

### Paso 1: Extracción por Subcategorías
```bash
node extract-batch-products.js AE8MUNDUREHX7 1
```

**Genera:**
- `alimentos-y-bebidas-products.json`
- `automotriz-y-motocicletas-products.json`
- `bebé-products.json`

**Output:**
```
📊 === RESUMEN BATCH 1 ===
✅ Categorías completadas: 3
❌ Con errores: 0
🌳 Subcategorías procesadas: 14
📁 Archivos guardados en: data/vendors/AE8MUNDUREHX7
```

### Paso 2: Consolidación Automática
```bash
node consolidate-batch-products.js AE8MUNDUREHX7 1
```

**Proceso:**
1. Lee todos los `*-products.json` del batch
2. Elimina duplicados por ASIN
3. Agrega metadata (categoría, batch_number)
4. Genera JSON consolidado
5. **Genera CSV automáticamente** ✨

**Output:**
```
🔄 === CONSOLIDANDO BATCH 1 ===
📦 Batch 1: 3 categorías
📂 Total archivos de productos encontrados: 3
✅ Alimentos y Bebidas: 54 productos
✅ Automotriz y Motocicletas: 384 productos
✅ Bebé: 270 productos

📊 === RESUMEN BATCH 1 ===
✅ Productos únicos: 708
🔄 Duplicados eliminados: 0
📂 Categorías procesadas: 3
💾 Guardado en: data/vendors/AE8MUNDUREHX7/batch-1-consolidated.json

📄 Generando CSV...
💾 CSV guardado en: data/vendors/AE8MUNDUREHX7/batch-1-consolidated.csv
```

---

## 📁 Estructura de Archivos Final

```
data/vendors/AE8MUNDUREHX7/
├── 2025-10-13-plan-batch-1.json                  ← Plan del batch
├── 2025-10-13-intelligent-alimentos-y-bebidas.json    ← Análisis jerárquico
├── 2025-10-13-intelligent-automotriz.json             ← Análisis jerárquico
├── 2025-10-13-intelligent-bebé.json                   ← Análisis jerárquico
│
├── alimentos-y-bebidas-products.json             ← Productos extraídos
├── automotriz-y-motocicletas-products.json       ← Productos extraídos
├── bebé-products.json                            ← Productos extraídos
│
├── batch-1-consolidated.json                     ← ✨ CONSOLIDADO JSON
└── batch-1-consolidated.csv                      ← ✨ CONSOLIDADO CSV
```

---

## 💡 Usos del CSV

### 1. Verificación en Excel
```bash
# Abrir en Excel para revisar
start data\vendors\AE8MUNDUREHX7\batch-1-consolidated.csv
```

### 2. Importar a Google Sheets
- Subir archivo CSV
- Revisar productos
- Aplicar filtros
- Editar precios si necesario

### 3. Preparar para Amazon Seller Central
El CSV tiene todos los datos necesarios:
- ✅ ASIN (identificador único)
- ✅ Title (nombre del producto)
- ✅ Price (precio actual)
- ✅ URL (para verificar)
- ✅ Category (organización)
- ✅ Batch_number (tracking)

### 4. Análisis de Datos
```powershell
# Contar productos por categoría
Import-Csv "batch-1-consolidated.csv" | Group-Object category | Select-Object Name, Count

# Ver productos más caros
Import-Csv "batch-1-consolidated.csv" | Sort-Object price -Descending | Select-Object -First 10
```

---

## 🔄 Consolidación de Todos los Batches

Si quieres un consolidado de **TODOS** los batches:

```bash
node consolidate-batch-products.js AE8MUNDUREHX7 all
```

**Genera:**
- `all-products-consolidated.json` (todos los batches)
- `all-products-consolidated.csv` (todos los batches)

**Output:**
```
🔄 === CONSOLIDANDO TODOS LOS BATCHES ===
📦 Total batches encontrados: 8

🔄 === CONSOLIDANDO BATCH 1 ===
✅ Productos únicos: 708

🔄 === CONSOLIDANDO BATCH 2 ===
✅ Productos únicos: 823

... (continúa con todos)

📊 === RESUMEN GENERAL ===
📦 Batches procesados: 8
✅ Productos únicos totales: 8857
📂 Categorías totales: 13
💾 Guardado en: all-products-consolidated.json

📄 Generando CSV general...
💾 CSV guardado en: all-products-consolidated.csv
```

---

## 🆘 Verificación de Archivos

### Verificar que CSV se generó
```powershell
dir data\vendors\SELLER_ID\*.csv
```

### Ver primeras líneas del CSV
```powershell
Get-Content "data\vendors\AE8MUNDUREHX7\batch-1-consolidated.csv" | Select-Object -First 5
```

**Output esperado:**
```
asin,title,price,url,category,batch_number
"B08XX123","Producto 1","$1234.56","https://...","Alimentos",1
"B09YY456","Producto 2","$567.89","https://...","Automotriz",1
...
```

### Contar productos en CSV
```powershell
(Get-Content "data\vendors\AE8MUNDUREHX7\batch-1-consolidated.csv" | Measure-Object).Count - 1
```
*(Resta 1 por el header)*

### Verificar que JSON y CSV tienen el mismo número
```powershell
$json = Get-Content "data\vendors\AE8MUNDUREHX7\batch-1-consolidated.json" | ConvertFrom-Json
$csv = Import-Csv "data\vendors\AE8MUNDUREHX7\batch-1-consolidated.csv"

Write-Host "Productos en JSON: $($json.metadata.total_products)"
Write-Host "Productos en CSV: $($csv.Count)"
```

---

## ✅ Resumen

| Archivo | Formato | Uso Principal |
|---------|---------|---------------|
| `batch-N-consolidated.json` | JSON | Metadatos + Productos |
| `batch-N-consolidated.csv` | CSV | Excel, Sheets, Seller Central |
| `all-products-consolidated.json` | JSON | Consolidado general |
| `all-products-consolidated.csv` | CSV | Consolidado general |

**Ambos archivos (JSON y CSV) se generan automáticamente** al ejecutar `consolidate-batch-products.js`.

No necesitas comandos adicionales. El CSV estará listo para usar inmediatamente después de la consolidación.

---

## 🎬 Ejemplo Completo

```bash
# 1. Extraer productos del batch 1
node extract-batch-products.js AE8MUNDUREHX7 1
# ✅ Genera: *-products.json

# 2. Consolidar (genera JSON y CSV automáticamente)
node consolidate-batch-products.js AE8MUNDUREHX7 1
# ✅ Genera: batch-1-consolidated.json
# ✅ Genera: batch-1-consolidated.csv ⭐

# 3. Abrir CSV en Excel
start data\vendors\AE8MUNDUREHX7\batch-1-consolidated.csv

# ¡Listo! 🎉
```
