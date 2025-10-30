# 💼 MODELO DE NEGOCIO - Dropshipping USA → MX

## 🎯 ¿Qué Hacemos?

Operamos una tienda de **dropshipping en Amazon México**, comprando productos de **Amazon USA** y revendiéndolos en México con ganancia.

### El Problema

Encontrar productos rentables manualmente es muy lento. Necesitamos:
1. Productos que existen en USA
2. Productos que tienen listing en MX pero nadie/pocos venden
3. Precio USA + importación < Precio MX actual
4. Margen suficiente para ser rentable

### La Solución

**Usar el trabajo de otros**. Hay tiendas que ya hicieron el análisis (usando software costoso) y tienen catálogos curados de productos rentables. Nosotros:

1. **Identificamos tiendas exitosas** (competidores con buenos productos)
2. **Copiamos su catálogo completo** (scraping de todos sus ASINs)
3. **Verificamos precios actuales** en MX y USA
4. **Aplicamos nuestras fórmulas** de ganancia
5. **Publicamos los rentables** en nuestra tienda

---

## 🔄 Flujo Completo del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: IDENTIFICAR VENDEDOR COMPETIDOR                         │
│                                                                  │
│ • Encontramos tienda exitosa en Amazon MX                       │
│ • Extraemos su Seller ID (ej: AE8MUNDUREHX7)                    │
│ • Registramos en el sistema                                     │
│                                                                  │
│ 📂 Crea: data/vendors/SELLER_ID/                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: GENERAR PLAN DE EXTRACCIÓN                              │
│                                                                  │
│ • Sistema analiza tamaño del catálogo del vendedor              │
│ • Si > 1000 productos: Divide en batches de ~500               │
│ • Si < 1000 productos: Plan simple (todo junto)                │
│                                                                  │
│ 📂 Crea: plan-batch-*.json o plan-simple.json                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: SCRAPING DEL CATÁLOGO (UNA SOLA VEZ)                   │
│                                                                  │
│ • Extraemos TODOS los productos del vendedor competidor         │
│ • Por cada producto obtenemos:                                  │
│   - ASIN (identificador único de Amazon)                        │
│   - Título del producto                                         │
│   - Precio que tiene publicado el vendedor                      │
│   - Rating, reviews, categoría                                  │
│   - URL e imagen                                                │
│                                                                  │
│ • Si es vendedor grande: Scraping por batches                  │
│   (porque no acabamos en un día - podemos pausar/reanudar)     │
│                                                                  │
│ 📂 Crea por batch:                                              │
│   - batch-N-products.json (productos crudos)                    │
│   - batch-N-consolidated.json (productos consolidados)          │
│   - batch-N-consolidated.csv (para análisis)                    │
│                                                                  │
│ ⚠️ IMPORTANTE: Esto se hace UNA SOLA VEZ por vendedor          │
│    No volvemos a scrapear el mismo vendedor                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 4: VERIFICACIÓN EN MÉXICO (SNAPSHOT ÚNICO)                 │
│                                                                  │
│ • Para cada ASIN del catálogo scrapeado:                        │
│   - Visitamos la página del producto en Amazon.com.mx           │
│   - Verificamos quién tiene el BUY BOX                          │
│   - Obtenemos el PRECIO REAL actual en MX                       │
│   - Guardamos disponibilidad (disponible/no disponible)         │
│                                                                  │
│ • ¿Por qué? El vendedor puede tener el listing pero NO el       │
│   buy box. Necesitamos saber el precio del que SÍ lo tiene.     │
│                                                                  │
│ • Agrega a cada producto:                                       │
│   - precio_actual_mx                                            │
│   - vendedor_actual_mx (quien tiene buy box)                    │
│   - disponibilidad_mx                                           │
│   - fecha_verificacion_mx                                       │
│   - error_verificacion_mx (si hubo problema)                    │
│                                                                  │
│ 📂 Actualiza: batch-N-consolidated.json                         │
│                                                                  │
│ ⚠️ IMPORTANTE: Verificación = SNAPSHOT del momento              │
│    NO se vuelve a verificar después                             │
│    El propósito es obtener datos para análisis de oportunidades │
│    No necesitamos precios "frescos" después                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 5: VERIFICACIÓN EN USA (SNAPSHOT ÚNICO)                    │
│                                                                  │
│ • Para cada ASIN del catálogo:                                  │
│   - Visitamos la página en Amazon.com (USA)                     │
│   - Obtenemos el PRECIO en USD                                  │
│   - Obtenemos el VENDEDOR actual                                │
│   - Guardamos disponibilidad                                    │
│                                                                  │
│ • ¿Por qué? Necesitamos saber el COSTO real para calcular       │
│   si es rentable venderlo en MX.                                │
│                                                                  │
│ • Agrega a cada producto:                                       │
│   - precio_actual_usd                                           │
│   - vendedor_actual_usa                                         │
│   - disponibilidad_usa                                          │
│   - fecha_verificacion_usa                                      │
│   - error_verificacion_usa (si hubo problema)                   │
│                                                                  │
│ 📂 Actualiza: batch-N-consolidated.json                         │
│                                                                  │
│ ⚠️ IMPORTANTE: Verificación = SNAPSHOT del momento              │
│    NO se vuelve a verificar después                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 6: ANÁLISIS DE OPORTUNIDADES                               │
│                                                                  │
│ • Aplicamos fórmulas de negocio a cada producto:                │
│                                                                  │
│   precio_sugerido = (precio_usa × tipo_cambio) + costos_fijos  │
│   es_rentable = precio_sugerido < precio_actual_mx              │
│                                                                  │
│ • Filtramos productos:                                          │
│   ✅ Tienen precio en USA                                       │
│   ✅ Tienen precio en MX                                        │
│   ✅ Están disponibles en ambos                                 │
│   ✅ Nuestro precio sería menor que competencia                 │
│   ✅ Margen suficiente para ser rentable                        │
│                                                                  │
│ • Generamos 3 archivos CSV con niveles de agresividad:          │
│   1. oportunidades.csv (precio exacto)                          │
│   2. oportunidades_menos_50.csv (más margen)                    │
│   3. oportunidades_menos_100.csv (máximo margen)                │
│                                                                  │
│ 📂 Crea:                                                        │
│   - batch-N-oportunidades.csv                                   │
│   - batch-N-oportunidades_menos_50.csv                          │
│   - batch-N-oportunidades_menos_100.csv                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 7: GESTIÓN DE PLANTILLAS AMAZON                            │
│                                                                  │
│ • Solicitamos plantilla a Amazon Seller Central                 │
│ • Descargamos plantilla generada por Amazon                     │
│ • Llenamos plantilla con nuestros productos de oportunidades    │
│   (máximo 500 productos por plantilla)                          │
│                                                                  │
│ • La plantilla incluye:                                         │
│   - ASIN del producto                                           │
│   - Precio al que lo publicaremos                               │
│   - Cantidad disponible                                         │
│   - Tiempo de envío                                             │
│   - Otros datos requeridos por Amazon                           │
│                                                                  │
│ 📂 Crea:                                                        │
│   - plantilla-llenada-YYYY-MM-DD.xlsx                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 8: PUBLICACIÓN EN SELLER CENTRAL                           │
│                                                                  │
│ • Subimos plantilla llenada a Amazon Seller Central             │
│ • Amazon procesa el archivo (feed)                              │
│ • Verificamos estado del feed (exitoso/con errores)             │
│                                                                  │
│ • Una vez procesado:                                            │
│   ✅ Productos publicados en nuestra tienda                     │
│   ✅ Visibles para clientes en Amazon MX                        │
│   ✅ Listos para generar ventas                                 │
│                                                                  │
│ 📂 Crea:                                                        │
│   - registro-subida-YYYY-MM-DD.txt                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ RESULTADO FINAL                                                  │
│                                                                  │
│ ✅ Productos rentables publicados en nuestra tienda             │
│ ✅ Precios competitivos vs mercado                              │
│ ✅ Margen de ganancia asegurado                                 │
│ ✅ Proceso repetible con nuevos vendedores                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Conceptos Clave

### Vendedor Competidor
Tienda exitosa en Amazon MX que ya hizo el trabajo de:
- Encontrar productos rentables
- Validar que se venden bien
- Mantener catálogo actualizado

**Nosotros copiamos su estrategia, no sus productos físicos.**

### ASIN
**Amazon Standard Identification Number**. Identificador único de cada producto en Amazon. El mismo ASIN funciona en Amazon USA, MX, etc.

Ejemplo: `B08N5HRD6B`

### Buy Box
El precio y vendedor que aparece como **predeterminado** cuando un cliente visita la página del producto. Es el que tiene mayor probabilidad de venta.

**Por eso verificamos quién tiene el buy box y a qué precio.**

### Snapshot Único
La verificación de precios (MX y USA) se hace **una sola vez** cuando procesamos el vendedor. No necesitamos re-verificar porque:

1. El análisis de oportunidades es puntual (con esos precios)
2. Hay **muchos** vendedores por procesar
3. No actualizamos precios de productos ya publicados
4. Si queremos datos frescos → procesamos un nuevo vendedor

### Batches
División del catálogo grande en grupos de ~500 productos para:
- Poder pausar y reanudar el proceso (no termina en un día)
- Evitar timeouts o bloqueos de Amazon
- Trabajar en paralelo en diferentes vendedores
- Organizar mejor el trabajo

---

## 📊 Ejemplo Real

### Vendedor: AE8MUNDUREHX7

1. **Scraping**: 4,921 productos extraídos (8 batches)
2. **Verificación MX**: En progreso por batches
3. **Verificación USA**: En progreso por batches  
4. **Oportunidades**: Pendiente
5. **Publicación**: Pendiente

**Detalle de batches**:
- Batch 1: 642 productos
- Batch 2: 616 productos
- Batch 3: 0 productos (vacío)
- Batch 4: 818 productos
- Batch 5: 2,032 productos
- Batch 6: 0 productos (vacío)
- Batch 7: 48 productos
- Batch 8: 765 productos

**Total invertido**: ~6-8 horas de procesamiento automatizado (para 5K productos)  
**Resultado**: Catálogo completo listo para análisis y publicación

---

## ❓ Preguntas Frecuentes

### ¿Por qué no verificamos precios en tiempo real al publicar?

Porque el análisis de oportunidades ya se hizo con los precios del snapshot. Si publicamos 100 productos y 10 ya no son rentables por cambio de precio, seguimos ganando con los otros 90.

### ¿Qué pasa si un producto ya no está disponible cuando un cliente compra?

Es riesgo del dropshipping. Por eso publicamos muchos productos - la tasa de éxito grupal compensa las fallas individuales.

### ¿Re-procesamos vendedores después de X tiempo?

**No**. Hay demasiados vendedores por procesar. Una vez terminado un vendedor, pasamos al siguiente. Si en el futuro queremos datos frescos del mismo vendedor, sería como procesar uno nuevo desde cero.

### ¿Podemos procesar múltiples vendedores en paralelo?

**Sí**. El sistema está diseñado para trabajar con múltiples vendedores simultáneamente. Cada vendedor tiene su carpeta independiente.

### ¿Cuántos vendedores hay por procesar?

**Miles**. Por eso el sistema está optimizado para procesar vendedores una sola vez y avanzar al siguiente.

---

## 🎯 Métricas de Éxito

- **Vendedores procesados**: Cantidad de tiendas analizadas
- **Productos scrapeados**: Total de ASINs extraídos
- **Tasa de verificación**: % productos con precio en MX y USA
- **Tasa de oportunidad**: % productos rentables del total
- **Productos publicados**: Cantidad en nuestra tienda

---

**Última actualización**: 28 de octubre de 2025  
**Versión**: 1.0
