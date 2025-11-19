# 🤖 Amazon Scraper & Publisher System (V2)

> Sistema automatizado y modular para scraping, análisis y publicación de productos en Amazon Seller Central.

## 📖 Descripción
Sistema completo para **dropshipping USA → MX** en Amazon. Identifica productos exitosos de competidores, verifica precios en MX/USA, detecta oportunidades rentables y automatiza la publicación.

**Flujo Principal:**
1.  **Scraping**: Extrae catálogos completos de competidores.
2.  **Verificación**: Compara precios MX (Buy Box) vs USA (Costo).
3.  **Oportunidades**: Filtra productos rentables (Ganancia > $300 MXN).
4.  **Publicación**: Sube productos a Amazon Seller Central.

---

## 🚀 Workflow Verificado (5 Pasos)

### 1. Gestión de Vendedores y Planes
*   **Comando**: `node MENU.js` -> Opción `[1]` y `[2]`
*   **Acción**: Registrar vendedor y crear plan de scraping.
*   **Script**: `create-plan.js` (Simple) o `create-plan-batches.js` (Batches).

### 2. Scraping de Productos
*   **Comando**: `node MENU.js` -> Opción `[3]`
*   **Acción**: Extraer productos del vendedor.
*   **Script**: `extract-products.js`
*   **Output**: `data/vendors/<ID>/all-products-consolidated.json`

### 3. Verificación MX (Buy Box)
*   **Comando**: `node MENU.js` -> Opción `[4]`
*   **Acción**: Obtener precio actual y vendedor en Amazon MX.
*   **Script**: `scripts/verify-products-mx-batch.js`

### 4. Verificación USA (Costo)
*   **Comando**: `node MENU.js` -> Opción `[5]`
*   **Acción**: Obtener costo y disponibilidad en Amazon USA.
*   **Script**: `scripts/verify-products-usa-batch.js`

### 5. Generar Oportunidades
*   **Comando**: `node MENU.js` -> Opción `[6]`
*   **Acción**: Filtrar productos rentables y generar CSVs.
*   **Scripts**: `prepare_business_csv.js` -> `buscando_productos_csv.js`
*   **Output**: `oportunidades.csv`, `productos-filtrados-sugeridos.csv`.

---

## 📁 Estructura del Proyecto

```
amazon-scrapper-otherseller/
│
├── MENU.js                     # 🎮 Panel Principal (Punto de entrada)
│
├── modules/                    # 📦 Módulos del Menú
│   ├── menu-vendedores.js
│   ├── menu-planes.js
│   ├── menu-scraping.js
│   ├── menu-verificacion-mx.js
│   ├── menu-verificacion-usa.js
│   ├── menu-oportunidades.js
│   └── ...
│
├── scripts/                    # 🤖 Scripts de Automatización
│   ├── verify-products-mx-batch.js
│   ├── verify-products-usa-batch.js
│   ├── a-login.js              # Login Amazon MX
│   ├── login_amazon_usa.js     # Login Amazon USA
│   └── login_seller.js         # Login Seller Central
│
├── data/                       # 💾 Datos
│   ├── projects.json           # Base de datos de vendedores
│   └── vendors/                # Archivos por vendedor
│       └── <SELLER_ID>/
│           ├── plan.json
│           ├── all-products-consolidated.json
│           └── oportunidades.csv
│
├── extract-products.js         # 🕷️ Scraper Principal
├── create-plan.js              # 📋 Creador de Planes
├── prepare_business_csv.js     # 💼 Filtro de Negocio
└── buscando_productos_csv.js   # 💰 Generador de Oportunidades
```

---

## 🛠️ Scripts Activos

| Script | Propósito |
|--------|-----------|
| `MENU.js` | Panel interactivo principal. |
| `extract-products.js` | Scraper robusto con rotación de agentes y scroll humano. |
| `create-plan.js` | Analiza categorías del vendedor para planificar el scraping. |
| `verify-products-mx-batch.js` | Verifica estado actual en Amazon MX (Playwright). |
| `verify-products-usa-batch.js` | Verifica costos en Amazon USA (Playwright). |
| `buscando_productos_csv.js` | Aplica fórmulas de rentabilidad. |

---

## ⚠️ Notas Importantes
*   **Cookies**: Los scripts de scraping requieren cookies válidas en `scripts/auth/`.
*   **Batches**: Para vendedores grandes (>1000 productos), el sistema usa automáticamente `create-plan-batches.js` y procesa por lotes.