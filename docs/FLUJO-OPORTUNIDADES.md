# 💰 FLUJO COMPLETO - GENERACIÓN DE OPORTUNIDADES

## 📋 Descripción General

El sistema de **generación de oportunidades** es el **Paso 5** del flujo completo. Toma productos que han sido verificados en MX y USA, y genera 3 archivos CSV con diferentes niveles de oportunidades de negocio.

---

## 🎯 Objetivo

Identificar productos que pueden ser rentables basándose en:
- **Precio sugerido**: Calculado como `(precio_usa × tipo_cambio) + costos_importación`
- **Precio actual MX**: Precio del buy box en Amazon México
- **Margen competitivo**: Ajustado según precio del competidor

---

## 🔄 Flujo Completo del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: SCRAPING                                            │
│ → Extrae productos del vendedor                             │
│ → Scripts: extract-batch-products.js                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FASE 2: CONSOLIDACIÓN                                       │
│ → Unifica productos por batch                               │
│ → Genera: batch-N-consolidated.json/csv                     │
│ → Scripts: consolidate-batch-products.js                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FASE 3: VERIFICACIÓN MX (🇲🇽 PRIMERO)                       │
│ → Obtiene precio real del buy box en MX                     │
│ → Agrega: precio_actual_mx, vendedor_actual_mx              │
│ → Scripts: verify-products-mx-batch.js                      │
│ → Panel: Menú [4] Verificar en Amazon MX                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FASE 4: VERIFICACIÓN USA (🇺🇸 SEGUNDO)                      │
│ → Obtiene precio en dólares de Amazon.com                   │
│ → Agrega: precio_actual_usd, vendedor_actual_usa            │
│ → Scripts: verify-products-usa-batch.js                     │
│ → Panel: Menú [5] Verificar en Amazon USA                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FASE 5: GENERACIÓN DE OPORTUNIDADES ⭐ AQUÍ ESTAMOS         │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ PASO 1: FILTRADO (prepare_business_csv.js)              ││
│ │                                                          ││
│ │ • Lee: batch-N-consolidated.csv                         ││
│ │ • Filtra productos con 3 campos necesarios:             ││
│ │   - precio_actual_mx ✓                                  ││
│ │   - precio_actual_usd ✓                                 ││
│ │   - price (del scraping) ✓                              ││
│ │ • Calcula: precio_sugerido = (usd × 41.79) + 314.81    ││
│ │ • Genera: batch-N-productos-filtrados-sugeridos.csv     ││
│ └──────────────────────────────────────────────────────────┘│
│                            ↓                                 │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ PASO 2: OPORTUNIDADES (buscando_productos_csv.js)       ││
│ │                                                          ││
│ │ • Lee: batch-N-productos-filtrados-sugeridos.csv        ││
│ │ • Aplica 3 filtros de oportunidad:                      ││
│ │   1. precio_sugerido < precio_actual_mx                 ││
│ │   2. (precio_sugerido - 50) < precio_actual_mx          ││
│ │   3. (precio_sugerido - 100) < precio_actual_mx         ││
│ │ • Excluye productos > $7,000                            ││
│ │ • Genera 3 archivos:                                    ││
│ │   - batch-N-oportunidades.csv                           ││
│ │   - batch-N-oportunidades_menos_50.csv                  ││
│ │   - batch-N-oportunidades_menos_100.csv                 ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ → Panel: Menú [6] Generar Oportunidades                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FASE 6: GESTIÓN DE PLANTILLAS                               │
│ → Solicita/descarga plantilla de Seller Central             │
│ → Llena plantilla con productos de oportunidades            │
│ → Panel: Menú [7] Gestión de Plantillas                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FASE 7: PUBLICACIÓN                                         │
│ → Sube plantilla a Seller Central                           │
│ → Verifica estado del feed                                  │
│ → Panel: Menú [8] Publicar Productos                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 PASO 1: prepare_business_csv.js

### ¿Qué hace?

Filtra productos que tienen **los 3 precios necesarios** para calcular oportunidades.

### Entrada:
```
data/vendors/SELLER_ID/batch-N-consolidated.csv
```

### Proceso:
```javascript
// 1. Validar que existan los 3 campos:
if (precio_actual_mx && precio_actual_usd && price) {
  
  // 2. Calcular precio sugerido:
  precio_sugerido = (precio_actual_usd × 41.79) + 314.81
  
  // 3. Agregar al resultado
  resultado.push({
    asin,
    precio_actual_mx,
    precio_actual_usd,
    price,
    title,
    vendedor_actual_mx,
    vendedor_actual_usa,
    precio_sugerido  // ← NUEVO CAMPO
  })
}
```

### Salida:
```
data/vendors/SELLER_ID/batch-N-productos-filtrados-sugeridos.csv
```

### Ejemplo de uso:
```bash
# Vendedor pequeño
node prepare_business_csv.js A3Q5ASRA7J8Y5E

# Batch específico
node prepare_business_csv.js AE8MUNDUREHX7 1
```

### Salida del script:
```
📦 Procesando BATCH 1 del vendedor AE8MUNDUREHX7

✅ ¡Proceso completado!
📄 Archivo generado: data/vendors/AE8MUNDUREHX7/batch-1-productos-filtrados-sugeridos.csv
📊 Total de productos filtrados: 630

📌 Siguiente paso: Ejecutar buscando_productos_csv.js para generar archivos de oportunidades
```

---

## 💎 PASO 2: buscando_productos_csv.js

### ¿Qué hace?

Genera **3 archivos** con diferentes niveles de oportunidades de negocio.

### Entrada:
```
data/vendors/SELLER_ID/batch-N-productos-filtrados-sugeridos.csv
```

### Proceso:

#### 1️⃣ **Oportunidades Principales** (archivo 1)
```javascript
// Condición: precio_sugerido < precio_actual_mx
if (precio_sugerido < precio_actual_mx) {
  // ✅ OPORTUNIDAD DIRECTA
  // Ejemplo: 
  //   precio_sugerido = $1,400 MXN
  //   precio_actual_mx = $1,800 MXN
  //   Margen = $400 MXN
  
  oportunidades.push(producto)
}
```

#### 2️⃣ **Oportunidades Menos $50** (archivo 2)
```javascript
// Condición: (precio_sugerido - 50) < precio_actual_mx
//         Y precio_sugerido >= precio_actual_mx
if ((precio_sugerido - 50) < precio_actual_mx && 
     precio_sugerido >= precio_actual_mx) {
  // ✅ OPORTUNIDAD BAJANDO $50
  // Ejemplo:
  //   precio_sugerido = $1,450 MXN
  //   precio_actual_mx = $1,420 MXN
  //   Bajando $50 → $1,400 MXN
  //   Ahora sí es competitivo
  
  oportunidades_menos_50.push(producto)
}
```

#### 3️⃣ **Oportunidades Menos $100** (archivo 3)
```javascript
// Condición: (precio_sugerido - 100) < precio_actual_mx
//         Y (precio_sugerido - 50) >= precio_actual_mx
if ((precio_sugerido - 100) < precio_actual_mx && 
    (precio_sugerido - 50) >= precio_actual_mx) {
  // ✅ OPORTUNIDAD BAJANDO $100
  // Ejemplo:
  //   precio_sugerido = $1,500 MXN
  //   precio_actual_mx = $1,420 MXN
  //   Bajando $100 → $1,400 MXN
  //   Margen más ajustado pero competitivo
  
  oportunidades_menos_100.push(producto)
}
```

### Ajuste de Precio Competitivo:

```javascript
function ajustarCompetitivo(precio_actual_mx, competitivo) {
  if (precio_actual_mx <= 2500) {
    // Productos económicos: mantener mínimo $100 bajo competencia
    const limite = precio_actual_mx - 100;
    return competitivo < limite ? limite : competitivo;
  } else {
    // Productos caros: mantener mínimo $200 bajo competencia
    const limite = precio_actual_mx - 200;
    return competitivo < limite ? limite : competitivo;
  }
}
```

### Exclusiones:

```javascript
// ❌ Excluir productos muy caros
if (precio_actual_mx > 7000) {
  excluir(); // No se incluye en ningún archivo
}
```

### Salida:
```
data/vendors/SELLER_ID/batch-N-oportunidades.csv
data/vendors/SELLER_ID/batch-N-oportunidades_menos_50.csv
data/vendors/SELLER_ID/batch-N-oportunidades_menos_100.csv
```

### Ejemplo de uso:
```bash
# Vendedor pequeño
node buscando_productos_csv.js A3Q5ASRA7J8Y5E

# Batch específico
node buscando_productos_csv.js AE8MUNDUREHX7 1
```

### Salida del script:
```
📦 Generando oportunidades para BATCH 1 del vendedor AE8MUNDUREHX7

✅ ¡Proceso finalizado!
📊 Se analizaron 630 productos
⚠️  Se excluyeron 15 productos con precio > $7,000

📈 Resumen de oportunidades:
   Se encontraron 245 oportunidades directas (archivo 'batch-1-oportunidades.csv')
   Se encontraron 89 oportunidades al bajar $50 (archivo 'batch-1-oportunidades_menos_50.csv')
   Se encontraron 42 oportunidades al bajar $100 (archivo 'batch-1-oportunidades_menos_100.csv')

📌 Archivos generados para BATCH 1

🎯 Siguiente paso: Usar el menú de PLANTILLAS para generar templates con estos archivos
```

---

## 🎮 USO DESDE PANELMAESTRO-V2

### Menú [6] Generar Oportunidades

#### Opción 1: Generar oportunidades de un vendedor

**Flujo:**
```
1. Muestra lista de vendedores con su estado actual
2. Usuario selecciona vendedor
3. Sistema detecta si es vendedor con batches
4. Si tiene batches:
   a. Pregunta: ¿batch específico o todos?
   b. Muestra batches disponibles
   c. Usuario selecciona batch
5. Valida que MX y USA estén al 100%
6. Ejecuta prepare_business_csv.js
7. Ejecuta buscando_productos_csv.js
8. Muestra resumen de oportunidades generadas
```

**Ejemplo de interacción:**

```
══════════════════════════════════════════════════
💰 GENERAR OPORTUNIDADES
══════════════════════════════════════════════════

ℹ️  Vendedores disponibles:

  [1] 📦 A3Q5ASRA7J8Y5E - 📦 Consolidado
  [2] ✅ AE8MUNDUREHX7 - 🇺🇸 Listo para oportunidades
  [3] 📦 A27UCZ6SHTD3J2 - 📋 Registrado

👉 Selecciona un vendedor (número) o [0] para cancelar: 2

──────────────────────────────────────────────────

ℹ️  Vendedor con batches detectado (3 batches disponibles)

  [1] 🎯 Generar oportunidades de batch específico
  [2] 🔄 Generar oportunidades de todos los batches
  [0] ← Cancelar

👉 Elige una opción: 1

──────────────────────────────────────────────────

ℹ️  Batches disponibles:

  [1] Batch 1 (640/642 verificados)
  [2] Batch 2 (0/450 verificados)
  [3] Batch 3 (0/380 verificados)

👉 Selecciona un batch (número) o [0] para cancelar: 1

──────────────────────────────────────────────────

✅ Vendedor listo para generar oportunidades

⚠️  Generando oportunidades del batch 1...

ℹ️  🔬 Paso 1/2: Filtrando productos con precios válidos...

📦 Procesando BATCH 1 del vendedor AE8MUNDUREHX7

✅ ¡Proceso completado!
📄 Archivo generado: batch-1-productos-filtrados-sugeridos.csv
📊 Total de productos filtrados: 630

ℹ️  📊 Paso 2/2: Generando archivos de oportunidades...

📦 Generando oportunidades para BATCH 1 del vendedor AE8MUNDUREHX7

✅ ¡Proceso finalizado!
📊 Se analizaron 630 productos

📈 Resumen de oportunidades:
   Se encontraron 245 oportunidades directas
   Se encontraron 89 oportunidades al bajar $50
   Se encontraron 42 oportunidades al bajar $100

──────────────────────────────────────────────────

✅ Oportunidades generadas exitosamente

ℹ️  📈 Resumen de oportunidades:

   Principal: 245 productos
   Menos $50: 89 productos
   Menos $100: 42 productos
   Total: 376 oportunidades encontradas

ℹ️  📌 Siguiente paso: Usar el menú [7] PLANTILLAS para generar templates

Presiona ENTER para continuar...
```

#### Opción 2: Ver resumen de oportunidades

**Flujo:**
```
1. Lista todos los vendedores
2. Usuario selecciona vendedor
3. Sistema busca archivos de oportunidades
4. Muestra estadísticas por batch:
   - Batch número
   - Oportunidades principales
   - Oportunidades -$50
   - Oportunidades -$100
   - Total
```

---

## ⚠️ VALIDACIONES IMPORTANTES

### 1. Verificaciones al 100%

El sistema **valida** que AMBAS verificaciones estén completas antes de generar oportunidades:

```javascript
if (verificados_mx < total) {
  mostrar_error("Falta completar verificación MX - Menú [4]")
  return
}

if (verificados_usa < total) {
  mostrar_error("Falta completar verificación USA - Menú [5]")
  return
}
```

**Ejemplo de mensaje cuando falta:**
```
⚠️  El vendedor no está listo para generar oportunidades
ℹ️  Estado actual: 🔄 Verificando USA (632/642)

   📊 Productos totales: 642
   🇲🇽 Verificados MX: 640/642
   🇺🇸 Verificados USA: 632/642

❌ Falta completar verificación MX - Menú [4]
❌ Falta completar verificación USA - Menú [5]

💡 Ambas verificaciones (MX y USA) deben estar al 100% antes de generar oportunidades

Presiona ENTER para continuar...
```

### 2. Archivos de entrada

Ambos scripts validan que existan sus archivos de entrada:

```javascript
// prepare_business_csv.js
if (!fs.existsSync('batch-1-consolidated.csv')) {
  error("Asegúrate de haber consolidado los productos primero")
}

// buscando_productos_csv.js
if (!fs.existsSync('batch-1-productos-filtrados-sugeridos.csv')) {
  error("Asegúrate de haber ejecutado prepare_business_csv.js primero")
}
```

---

## 📊 ESTRUCTURA DE ARCHIVOS GENERADOS

### 1. batch-N-productos-filtrados-sugeridos.csv

```csv
asin,precio_actual_mx,precio_actual_usd,price,title,vendedor_actual_mx,vendedor_actual_usa,precio_sugerido
B08XX123,799.00,25.99,899.00,"Lego Classic 123",Amazon.com.mx,ToysRUs,1401.26
B07YY456,1299.00,42.50,1399.00,"Hot Wheels Pack",Liverpool,Walmart,2090.06
...
```

**Campos:**
- `asin`: Identificador único
- `precio_actual_mx`: Precio buy box en MX
- `precio_actual_usd`: Precio en USA
- `price`: Precio listado del vendedor (scraping)
- `title`: Nombre del producto
- `vendedor_actual_mx`: Quien tiene el buy box en MX
- `vendedor_actual_usa`: Vendedor en USA
- `precio_sugerido`: **(NUEVO)** Precio calculado para competir

### 2. batch-N-oportunidades.csv

```csv
asin,precio_actual_mx,precio_actual_usd,price,title,vendedor_actual_mx,vendedor_actual_usa,precio_sugerido,precio_competitivo
B08XX123,799.00,25.99,899.00,"Lego Classic 123",Amazon.com.mx,ToysRUs,1401.26,699.00
...
```

**Campo adicional:**
- `precio_competitivo`: Precio ajustado para ser competitivo

### 3. batch-N-oportunidades_menos_50.csv

Misma estructura, productos que requieren bajar $50 al precio sugerido.

### 4. batch-N-oportunidades_menos_100.csv

Misma estructura, productos que requieren bajar $100 al precio sugerido.

---

## 🎯 EJEMPLO COMPLETO PASO A PASO

### Caso: Vendedor AE8MUNDUREHX7, Batch 1

#### Estado inicial:
```
✅ Scraping completo: 642 productos
✅ Consolidación: batch-1-consolidated.json/csv
✅ Verificación MX: 642/642 (100%)
✅ Verificación USA: 642/642 (100%)
❓ Oportunidades: NO GENERADAS
```

#### Paso 1: Ejecutar desde Panel Maestro

```bash
node PANELMAESTRO-v2.js
```

```
[6] 💰 Generar Oportunidades
```

#### Paso 2: Seleccionar vendedor

```
[2] ✅ AE8MUNDUREHX7 - 🇺🇸 Listo para oportunidades
```

#### Paso 3: Seleccionar modo

```
[1] 🎯 Generar oportunidades de batch específico
```

#### Paso 4: Seleccionar batch

```
[1] Batch 1 (642/642 verificados)
```

#### Paso 5: Sistema ejecuta automáticamente

**5.1. prepare_business_csv.js**
```
📦 Procesando BATCH 1 del vendedor AE8MUNDUREHX7
✅ ¡Proceso completado!
📊 Total de productos filtrados: 630
```
*Resultado: 630 productos tienen los 3 precios necesarios (12 excluidos)*

**5.2. buscando_productos_csv.js**
```
📦 Generando oportunidades para BATCH 1
✅ ¡Proceso finalizado!
📊 Se analizaron 630 productos
⚠️  Se excluyeron 15 productos con precio > $7,000

📈 Resumen de oportunidades:
   245 oportunidades directas
   89 oportunidades al bajar $50
   42 oportunidades al bajar $100
```

#### Archivos generados:

```
data/vendors/AE8MUNDUREHX7/
├── batch-1-consolidated.json
├── batch-1-consolidated.csv
├── batch-1-productos-filtrados-sugeridos.csv  ← NUEVO (Paso 1)
├── batch-1-oportunidades.csv                   ← NUEVO (Paso 2)
├── batch-1-oportunidades_menos_50.csv          ← NUEVO (Paso 2)
└── batch-1-oportunidades_menos_100.csv         ← NUEVO (Paso 2)
```

#### Siguiente paso:

```
📌 Usar el menú [7] PLANTILLAS para generar templates con estos archivos
```

---

## 🔍 TROUBLESHOOTING

### Error: "No se encontraron productos con los tres campos necesarios"

**Causa:** Los productos no tienen verificaciones MX y USA completas.

**Solución:**
```bash
# 1. Verificar estado
node PANELMAESTRO-v2.js → [4] → Ver estado de verificación MX
node PANELMAESTRO-v2.js → [5] → Ver estado de verificación USA

# 2. Completar verificaciones faltantes
node PANELMAESTRO-v2.js → [4] → Verificar productos
node PANELMAESTRO-v2.js → [5] → Verificar productos
```

### Error: "No existe el archivo batch-1-consolidated.csv"

**Causa:** El batch no está consolidado.

**Solución:**
```bash
node consolidate-batch-products.js SELLER_ID 1
```

### Error: "No existe el archivo productos-filtrados-sugeridos.csv"

**Causa:** No se ejecutó prepare_business_csv.js primero.

**Solución:**
```bash
node prepare_business_csv.js SELLER_ID 1
```

### Problema: "Se generaron 0 oportunidades"

**Causas posibles:**
1. Precios USA muy altos (precio_sugerido > precio_actual_mx para todos)
2. Productos con precio > $7,000 (excluidos automáticamente)
3. Márgenes muy ajustados

**Análisis:**
```bash
# Ver distribución de precios
node -e "const fs = require('fs'); const csv = require('csv-parser'); let results = []; fs.createReadStream('data/vendors/SELLER_ID/batch-1-productos-filtrados-sugeridos.csv').pipe(csv()).on('data', (r) => results.push({sug: parseFloat(r.precio_sugerido), act: parseFloat(r.precio_actual_mx)})).on('end', () => { console.log('Productos donde sugerido < actual:', results.filter(r => r.sug < r.act).length); console.log('Productos donde sugerido > actual:', results.filter(r => r.sug > r.act).length); });"
```

---

## 📚 COMANDOS DE REFERENCIA RÁPIDA

### Ejecución manual (sin panel):

```bash
# Vendedor pequeño
node prepare_business_csv.js A3Q5ASRA7J8Y5E
node buscando_productos_csv.js A3Q5ASRA7J8Y5E

# Vendedor con batches - Batch 1
node prepare_business_csv.js AE8MUNDUREHX7 1
node buscando_productos_csv.js AE8MUNDUREHX7 1

# Vendedor con batches - Batch 2
node prepare_business_csv.js AE8MUNDUREHX7 2
node buscando_productos_csv.js AE8MUNDUREHX7 2
```

### Desde Panel Maestro (recomendado):

```bash
node PANELMAESTRO-v2.js
→ [6] Generar Oportunidades
→ [1] Generar oportunidades de un vendedor
→ Seleccionar vendedor
→ Seleccionar batch
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de generar oportunidades, asegúrate de tener:

- [ ] ✅ Productos scrapeados
- [ ] ✅ Batch consolidado (batch-N-consolidated.json/csv)
- [ ] ✅ Verificación MX al 100%
- [ ] ✅ Verificación USA al 100%
- [ ] ✅ Cookies vigentes (< 30 días)

Después de generar, debes tener:

- [ ] ✅ batch-N-productos-filtrados-sugeridos.csv
- [ ] ✅ batch-N-oportunidades.csv
- [ ] ✅ batch-N-oportunidades_menos_50.csv
- [ ] ✅ batch-N-oportunidades_menos_100.csv

---

## 📈 ESTADÍSTICAS TÍPICAS

Para un batch de 642 productos:

- **Productos filtrados:** ~630 (98%)
  - 12 sin alguno de los 3 precios necesarios
  
- **Oportunidades totales:** ~350-400 (60%)
  - Principal: ~245 (40%)
  - Menos $50: ~89 (15%)
  - Menos $100: ~42 (7%)
  
- **Excluidos > $7,000:** ~15 (2%)

**Tiempo de ejecución:**
- prepare_business_csv.js: ~5 segundos
- buscando_productos_csv.js: ~8 segundos
- **Total: ~15 segundos por batch**

---

## 🎓 CONCEPTOS CLAVE

### Precio Sugerido
```
precio_sugerido = (precio_usa × tipo_cambio) + costos_importación
                = (precio_usa × 41.79) + 314.81
```

**Componentes:**
- `precio_usa`: Precio en Amazon.com (USD)
- `41.79`: Tipo de cambio USD → MXN
- `314.81`: Costos de importación estimados

### Precio Competitivo
```
if (precio_actual_mx <= $2,500) {
  precio_competitivo = max(precio_sugerido, precio_actual_mx - 100)
} else {
  precio_competitivo = max(precio_sugerido, precio_actual_mx - 200)
}
```

**Lógica:**
- Productos económicos: mantener mínimo $100 bajo competencia
- Productos caros: mantener mínimo $200 bajo competencia

### Niveles de Oportunidad

1. **Principal**: Directamente competitivo
2. **Menos $50**: Bajando $50 al precio sugerido
3. **Menos $100**: Bajando $100 al precio sugerido

---

## 📝 RESUMEN EJECUTIVO

**¿Cuándo ejecutar este paso?**
- Después de completar verificaciones MX y USA al 100%

**¿Qué genera?**
- 4 archivos CSV con diferentes niveles de oportunidades

**¿Cuánto tarda?**
- ~15 segundos por batch

**¿Qué sigue?**
- Usar archivos de oportunidades para generar plantillas
- Menú [7] Gestión de Plantillas

**¿Cómo se ejecuta?**
- Panel Maestro → [6] → [1] → Seleccionar vendedor y batch
- **O manualmente:** `node prepare_business_csv.js SELLER_ID BATCH && node buscando_productos_csv.js SELLER_ID BATCH`

---

**Última actualización:** 16 de octubre de 2025  
**Versión:** 1.0  
**Estado:** ✅ Documentado y funcionando
