# 📊 ANÁLISIS COMPLETO DE SCRIPTS

## 🎯 Resumen Ejecutivo

**Total de scripts en raíz**: 37 archivos .js  
**Scripts en uso activo**: 13 archivos (35%)  
**Scripts obsoletos/prueba**: 24 archivos (65%)

---

## ✅ SCRIPTS EN USO ACTIVO (13)

### 📁 Panel Principal
| Script | Tamaño | Propósito | Usado Por |
|--------|--------|-----------|-----------|
| `MENU.js` | 6.1 KB | ✅ Panel principal modular | Usuario final |

### 📁 Generación de Planes
| Script | Tamaño | Propósito | Usado Por |
|--------|--------|-----------|-----------|
| `create-plan.js` | 21.4 KB | ✅ Crear plan simple (< 1000 productos) | menu-planes.js |
| `create-plan-batches.js` | 19.8 KB | ✅ Crear plan por batches (> 1000 productos) | menu-planes.js |

### 📁 Scraping
| Script | Tamaño | Propósito | Usado Por |
|--------|--------|-----------|-----------|
| `test-seller.js` | 9.8 KB | ✅ Validar vendedor y estimar productos | menu-vendedores.js |
| `extract-batch-products.js` | 13.1 KB | ✅ Extraer productos de un batch específico | menu-scraping.js |
| `extract-products.js` | 14.1 KB | ✅ **Extractor base (llamado por extract-batch-products.js)** | extract-batch-products.js |
| `consolidate-batch-products.js` | 13.9 KB | ✅ Consolidar productos extraídos | menu-scraping.js |

### 📁 Verificación
| Script | Tamaño | Propósito | Usado Por |
|--------|--------|-----------|-----------|
| `scripts/verify-products-mx-batch.js` | - | ✅ Verificar precios en MX (snapshot único) | menu-verificacion-mx.js |
| `scripts/verify-products-usa-batch.js` | - | ✅ Verificar precios en USA (snapshot único) | menu-verificacion-usa.js |

### 📁 Oportunidades
| Script | Tamaño | Propósito | Usado Por |
|--------|--------|-----------|-----------|
| `prepare_business_csv.js` | 3.3 KB | ✅ Filtrar productos con datos completos | menu-oportunidades.js |
| `buscando_productos_csv.js` | 7.2 KB | ✅ Generar CSVs de oportunidades | menu-oportunidades.js |

### 📁 Plantillas y Publicación
| Script | Tamaño | Propósito | Usado Por |
|--------|--------|-----------|-----------|
| `solicitar-plantilla-seller.js` | 8.9 KB | ✅ Solicitar plantilla a Seller Central | menu-plantillas.js |
| `descargar-plantilla-seller.js` | 6.6 KB | ✅ Descargar plantilla generada | menu-plantillas.js |
| `llenar-plantilla-seller.js` | 9.7 KB | ✅ Llenar plantilla con productos | menu-plantillas.js |
| `subir-plantilla-seller.js` | 11.1 KB | ✅ Subir plantilla a Seller Central | menu-publicacion.js |
| `consultar-estado-feed-seller.js` | 10.0 KB | ✅ Verificar estado de feed | menu-publicacion.js |

---

## ⚠️ SCRIPTS OBSOLETOS / DE PRUEBA (24)

### 🗑️ Categoría 1: Paneles Antiguos
| Script | Tamaño | Razón | Acción Sugerida |
|--------|--------|-------|-----------------|
| `PANELMAESTRO.js` | 90.7 KB | ❌ Versión antigua, reemplazada por v2 | **ELIMINAR** |
| `PANELMAESTRO-backup-20251013-131704.js` | 90.7 KB | ❌ Backup del panel antiguo | **ELIMINAR** |
| `cerebro.js` | 34.6 KB | ❌ Panel antiguo anterior a PANELMAESTRO | **ELIMINAR** |

### 🗑️ Categoría 2: Scripts de Extracción Obsoletos
| Script | Tamaño | Razón | Acción Sugerida |
|--------|--------|-------|-----------------|
| ~~`extract-products.js`~~ | 14.1 KB | ✅ **MANTENER - Usado por extract-batch-products.js** | **NO ELIMINAR** |
| `category-intelligent.js` | 17.7 KB | ❌ Sistema antiguo de categorías, no usado en v2 | **ELIMINAR** |
| `category-detailed-test.js` | 19.0 KB | ❌ Test de categorías, no usado | **ELIMINAR** |
| `process-all-categories.js` | 19.5 KB | ❌ Procesador antiguo, reemplazado por extract-batch | **ELIMINAR** |
| `process-single-batch.js` | 13.2 KB | ❌ Versión antigua de procesamiento | **ELIMINAR** |
| `process-vendor-categories.js` | 14.0 KB | ❌ Sistema antiguo de categorías | **ELIMINAR** |
| `manage-batch-categories.js` | 14.7 KB | ❌ Gestión antigua de categorías | **ELIMINAR** |

### 🗑️ Categoría 3: Scripts de Enriquecimiento Obsoletos
| Script | Tamaño | Razón | Acción Sugerida |
|--------|--------|-------|-----------------|
| `enrich-products-batch.js` | 12.0 KB | ❌ Antiguo enriquecedor, reemplazado por verify-products-mx-batch | **ELIMINAR** |
| `enrich-consolidated-products.js` | 16.8 KB | ❌ Enriquecedor consolidado antiguo | **ELIMINAR** |
| `extract-price-seller.js` | 13.4 KB | ❌ Extractor individual, ahora se usa verify-products | **ELIMINAR** |

### 🗑️ Categoría 4: Scripts de Test
| Script | Tamaño | Razón | Acción Sugerida |
|--------|--------|-------|-----------------|
| `test-oportunidades-flow.js` | 4.1 KB | ❌ Test de flujo, usado una vez | **ELIMINAR** |
| `test-publicacion.js` | 3.8 KB | ❌ Test de publicación, usado una vez | **ELIMINAR** |
| `test-flujo-completo-plantilla.js` | 5.0 KB | ❌ Test de plantillas, usado una vez | **ELIMINAR** |
| `test-sellercentral-cookies.js` | 3.8 KB | ❌ Test de cookies, usado una vez | **ELIMINAR** |
| `test-solicitar-plantilla.js` | 2.3 KB | ❌ Test de solicitud, usado una vez | **ELIMINAR** |

### 🗑️ Categoría 5: Utilidades Antiguas
| Script | Tamaño | Razón | Acción Sugerida |
|--------|--------|-------|-----------------|
| `create-test-plan.js` | 4.0 KB | ❌ Crear plan de prueba, no necesario | **ELIMINAR** |
| `reset-plan.js` | 2.0 KB | ⚠️ Resetear plan - **MANTENER** (útil para debug) |
| `cleanup-inventory.js` | 2.9 KB | ❌ Limpieza antigua, no usado | **ELIMINAR** |
| `renombrar-plantilla.js` | 4.3 KB | ❌ Renombrador de plantillas, no usado | **ELIMINAR** |
| `convertir-plantilla.js` | 8.2 KB | ❌ Convertidor de plantillas, no usado | **ELIMINAR** |
| `fix-isnan-validation.js` | 0.0 KB | ❌ Archivo vacío | **ELIMINAR** |

### 📁 Categoría 6: Scripts de Login (scripts/)
| Script | Usado | Propósito | Acción |
|--------|-------|-----------|--------|
| `scripts/a-login.js` | ✅ | Login Amazon MX (genera cookies) | **MANTENER** |
| `scripts/login_amazon_usa.js` | ✅ | Login Amazon USA (genera cookies) | **MANTENER** |
| `scripts/login_seller.js` | ✅ | Login Seller Central (genera cookies) | **MANTENER** |
| `scripts/b-scrape-vendedor.js` | ❌ | Scraper antiguo | **ELIMINAR** |
| `scripts/check-batch-progress.js` | ❌ | Checker antiguo, no usado | **ELIMINAR** |

---

## 📊 Resumen de Eliminaciones Sugeridas

### Por Categoría:
```
Paneles antiguos:              3 scripts (256.0 KB)
Extractores obsoletos:         7 scripts (112.2 KB)
Enriquecedores obsoletos:      3 scripts  (42.2 KB)
Tests:                         5 scripts  (19.0 KB)
Utilidades antiguas:           5 scripts  (19.4 KB)
Scripts en scripts/:           2 scripts
────────────────────────────────────────────────
TOTAL A ELIMINAR:             25 scripts (448.8 KB)
```

### Scripts a Mantener:
```
✅ Panel:              1 script  (MENU.js)
✅ Planes:             2 scripts (create-plan*.js)
✅ Scraping:           3 scripts (test-seller, extract-batch, consolidate)
✅ Verificación:       2 scripts (verify-products-mx/usa-batch)
✅ Oportunidades:      2 scripts (prepare_business, buscando_productos)
✅ Plantillas:         5 scripts (solicitar, descargar, llenar, subir, consultar)
✅ Login:              3 scripts (a-login, login_amazon_usa, login_seller)
✅ Utilidad:           1 script  (reset-plan.js)
────────────────────────────────────────────────
TOTAL A MANTENER:     19 scripts
```

---

## 🎯 Recomendación de Limpieza

### Fase 1: Eliminar Obvios (Seguro al 100%)
```bash
# Paneles antiguos
rm PANELMAESTRO.js
rm PANELMAESTRO-backup-20251013-131704.js
rm cerebro.js

# Tests
rm test-*.js

# Archivo vacío
rm fix-isnan-validation.js
```

### Fase 2: Eliminar Extractores Antiguos
```bash
rm extract-products.js
rm category-*.js
rm process-*.js
rm manage-batch-categories.js
```

### Fase 3: Eliminar Enriquecedores Antiguos
```bash
rm enrich-*.js
rm extract-price-seller.js
```

### Fase 4: Eliminar Utilidades No Usadas
```bash
rm create-test-plan.js
rm cleanup-inventory.js
rm renombrar-plantilla.js
rm convertir-plantilla.js
```

### Fase 5: Limpiar scripts/
```bash
rm scripts/b-scrape-vendedor.js
rm scripts/check-batch-progress.js
```

---

## 📁 Estructura Final Propuesta

```
amazon-scrapper-otherseller/
│
├── MENU.js              # ✅ Panel principal
│
├── create-plan.js                  # ✅ Plan simple
├── create-plan-batches.js          # ✅ Plan batches
├── reset-plan.js                   # ✅ Resetear plan (debug)
│
├── test-seller.js                  # ✅ Validar vendedor
├── extract-batch-products.js       # ✅ Extraer batch
├── consolidate-batch-products.js   # ✅ Consolidar
│
├── prepare_business_csv.js         # ✅ Filtrar
├── buscando_productos_csv.js       # ✅ Oportunidades
│
├── solicitar-plantilla-seller.js   # ✅ Solicitar
├── descargar-plantilla-seller.js   # ✅ Descargar
├── llenar-plantilla-seller.js      # ✅ Llenar
├── subir-plantilla-seller.js       # ✅ Subir
├── consultar-estado-feed-seller.js # ✅ Consultar feed
│
├── scripts/
│   ├── a-login.js                  # ✅ Login MX
│   ├── login_amazon_usa.js         # ✅ Login USA
│   ├── login_seller.js             # ✅ Login Seller
│   ├── verify-products-mx-batch.js # ✅ Verificar MX
│   └── verify-products-usa-batch.js# ✅ Verificar USA
│
└── modules/                        # ✅ Módulos del panel
```

**Total**: 19 scripts esenciales (vs 37 actuales = 48% de reducción)

---

## ⚠️ Consideraciones Antes de Eliminar

1. **Hacer backup**: `git commit` antes de eliminar cualquier archivo
2. **Verificar dependencias**: Algunos scripts pueden ser llamados indirectamente
3. **Eliminar por fases**: Empezar con los más obvios (tests, backups)
4. **Probar después de cada fase**: Verificar que el panel funciona correctamente

---

**Fecha de análisis**: 28 de octubre de 2025  
**Analista**: Sistema automatizado  
**Estado**: Pendiente aprobación del usuario
