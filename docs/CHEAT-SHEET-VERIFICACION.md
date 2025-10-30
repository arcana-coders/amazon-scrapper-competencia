# 🚀 CHEAT SHEET - Verificación MX + USA por Batch

## 📋 Comandos Rápidos

### Ver Progreso
```bash
node scripts/check-batch-progress.js AE8MUNDUREHX7 1
```

### Verificar MX (20 productos)
```bash
node scripts/verify-products-mx-batch.js AE8MUNDUREHX7 1
```

### Verificar MX (5 productos - prueba)
```bash
node scripts/verify-products-mx-batch.js AE8MUNDUREHX7 1 5
```

### Verificar USA (20 productos)
```bash
node scripts/verify-products-usa-batch.js AE8MUNDUREHX7 1
```

---

## 🔄 Workflow Completo: Batch 1

```bash
# 1. CONSOLIDAR (si no está hecho)
node consolidate-batch-products.js AE8MUNDUREHX7 1

# 2. VERIFICAR MX (ejecutar ~32 veces hasta completar)
node scripts/verify-products-mx-batch.js AE8MUNDUREHX7 1

# 3. VERIFICAR USA (ejecutar ~32 veces hasta completar)
node scripts/verify-products-usa-batch.js AE8MUNDUREHX7 1

# 4. FILTRAR OPORTUNIDADES
node prepare_business_csv.js AE8MUNDUREHX7 1
node buscando_productos_csv.js AE8MUNDUREHX7 1

# 5. PUBLICAR
node solicitar-plantilla-seller.js
# ... seguir proceso de plantillas
```

---

## 🔐 Cookies (Regenerar si expiran)

```bash
# Amazon MX
node scripts/login_amazon_mx.js

# Amazon USA
node scripts/login_amazon_usa.js

# Seller Central
node scripts/login_amazon_seller.js
```

---

## 📊 Ver Datos de un Producto

```powershell
$json = Get-Content "data\vendors\AE8MUNDUREHX7\batch-1-consolidated.json" | ConvertFrom-Json
$producto = $json.all_products[0]
$producto | ConvertTo-Json
```

---

## 🎯 Diferencias entre Scripts

| Script | Archivo | Cookies | Campo Precio |
|--------|---------|---------|--------------|
| `verify-products-mx-batch.js` | `batch-N-consolidated.json` | `amazonmx.json` | `precio_actual_mx` |
| `verify-products-usa-batch.js` | `batch-N-consolidated.json` | `pedirplantilla-usa.json` | `precio_actual_usd` |
| `enrich-products-batch.js` | `all-products-consolidated.json` | Sin cookies | `precio_actual_mx` |

---

## ⏱️ Tiempos Estimados

| Batch Size | Lote | Ejecuciones | Tiempo Total |
|------------|------|-------------|--------------|
| 642 productos | 20 | 32 | ~64 minutos |
| 642 productos | 10 | 64 | ~64 minutos |
| 642 productos | 50 | 13 | ~65 minutos |

**Recomendado**: Lote de 20 (balance velocidad/seguridad)

---

## 🚨 Troubleshooting

### Captcha detectado
```bash
# Regenerar cookies
node scripts/login_amazon_mx.js

# Reducir lote
node scripts/verify-products-mx-batch.js AE8MUNDUREHX7 1 10

# Esperar 1-2 horas
```

### Archivo no encontrado
```bash
# Consolidar batch primero
node consolidate-batch-products.js AE8MUNDUREHX7 1
```

### Ver cuántos faltan
```bash
node scripts/check-batch-progress.js AE8MUNDUREHX7 1
```

---

## 📁 Archivos Generados

```
data/vendors/AE8MUNDUREHX7/
├── batch-1-consolidated.json  ← Actualizado con campos MX/USA
├── batch-1-consolidated.csv   ← Regenerado con nuevas columnas
├── batch-1-productos-filtrados-sugeridos.csv
├── batch-1-oportunidades.csv
├── batch-1-oportunidades_menos_50.csv
└── batch-1-oportunidades_menos_100.csv
```

---

## 🎯 Campos Agregados

### Por verify-products-mx-batch.js
```json
{
  "precio_actual_mx": 650.00,
  "vendedor_actual_mx": "The mystics",
  "disponibilidad_mx": "disponible",
  "fecha_verificacion_mx": "2025-10-14T...",
  "url_mx": "https://www.amazon.com.mx/dp/...",
  "error_verificacion_mx": null
}
```

### Por verify-products-usa-batch.js
```json
{
  "precio_actual_usd": 25.99,
  "vendedor_actual_usa": "ToysRUs",
  "disponibilidad_usa": "disponible",
  "fecha_verificacion_usa": "2025-10-14T...",
  "url_usa": "https://www.amazon.com/dp/...",
  "error_verificacion_usa": null
}
```

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| `docs/COMO-FUNCIONA-VERIFICACION-MX.md` | Guía técnica completa MX |
| `docs/COMO-FUNCIONA-VERIFICACION-USA.md` | Guía técnica completa USA |
| `docs/WORKFLOW-VERIFICACION-MX-USA.md` | Orden correcto del workflow |
| `docs/PRUEBAS-VERIFICACION-MX.md` | Resultados de pruebas |
| `docs/INVENTARIO-SCRIPTS.md` | Todos los scripts del proyecto |

---

## 🎨 Scripts de Utilidad

```bash
# Ver progreso
node scripts/check-batch-progress.js AE8MUNDUREHX7 1

# Verificar errores
node get_errors.js

# Buscar archivos
ls data\vendors\AE8MUNDUREHX7\batch-1-*

# Contar productos con MX
(Get-Content "data\vendors\AE8MUNDUREHX7\batch-1-consolidated.json" | ConvertFrom-Json).all_products | Where-Object { $_.precio_actual_mx -ne $null } | Measure-Object | Select-Object Count
```

---

**Última actualización**: 14 de octubre de 2025  
**Estado**: ✅ LISTO PARA PRODUCCIÓN
