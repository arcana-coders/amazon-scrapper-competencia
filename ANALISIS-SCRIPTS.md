# 📊 ANÁLISIS DE SCRIPTS (Post-Limpieza)

## ✅ SCRIPTS ACTIVOS Y ESENCIALES

### 📁 Panel Principal
*   `MENU.js`: Orquestador principal.

### 📁 Scraping y Planificación
*   `create-plan.js`: Creación de planes simples.
*   `create-plan-batches.js`: Creación de planes por lotes.
*   `extract-products.js`: **Script Principal** de extracción (reemplaza a los antiguos).
*   `extract-batch-products.js`: Wrapper para extracción por lotes.
*   `consolidate-batch-products.js`: Consolidador de lotes.
*   `test-seller.js`: Validación inicial de vendedores.

### 📁 Verificación
*   `scripts/verify-products-mx-batch.js`: Verificación MX.
*   `scripts/verify-products-usa-batch.js`: Verificación USA.

### 📁 Oportunidades
*   `prepare_business_csv.js`: Filtro inicial de datos.
*   `buscando_productos_csv.js`: Generación de oportunidades.

### 📁 Plantillas y Publicación
*   `solicitar-plantilla-seller.js`
*   `descargar-plantilla-seller.js`
*   `llenar-plantilla-seller.js`
*   `subir-plantilla-seller.js`
*   `consultar-estado-feed-seller.js`

### 📁 Utilidades y Login
*   `reset-plan.js`
*   `scripts/a-login.js`
*   `scripts/login_amazon_usa.js`
*   `scripts/login_seller.js`

---

## 🗑️ SCRIPTS ELIMINADOS (Limpieza Nov 2025)
Se han eliminado los siguientes scripts obsoletos o de prueba para limpiar el proyecto:
*   `PANELMAESTRO.js` (Legacy)
*   `cerebro.js` (Legacy)
*   `scripts/b-scrape-vendedor.js` (Broken)
*   `category-intelligent.js`, `process-all-categories.js` (Old logic)
*   `enrich-products-batch.js` (Replaced by verify scripts)
*   Tests varios (`test-*.js` excepto `test-seller.js`)
*   Utilidades no usadas (`cleanup-inventory.js`, etc.)

El proyecto ahora es más ligero y solo contiene el código necesario para el flujo verificado.
