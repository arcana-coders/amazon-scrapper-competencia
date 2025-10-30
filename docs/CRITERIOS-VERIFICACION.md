# 📋 CRITERIOS DE VERIFICACIÓN

## 🎯 Definición de "Producto Verificado"

### 🇲🇽 Verificación MX

Un producto se considera **verificado en MX** si:

```javascript
producto.fecha_verificacion_mx !== null
```

**Estados posibles:**
1. ✅ **Con precio**: Tiene `precio_actual_mx` y `vendedor_actual_mx`
2. ✅ **No disponible**: Tiene `disponibilidad_mx = 'no disponible'`
3. ✅ **No listado**: Tiene `disponibilidad_mx = 'no listado'`
4. ✅ **Con error**: Tiene `error_verificacion_mx` (timeout, captcha, etc.)

**Todos son válidos** - el producto fue visitado y procesado.

---

### 🇺🇸 Verificación USA

Un producto se considera **verificado en USA** si:

```javascript
producto.fecha_verificacion_usa !== null
```

**Estados posibles:**
1. ✅ **Con precio**: Tiene `precio_actual_usd` y `vendedor_actual_usa`
2. ✅ **No disponible**: Tiene `disponibilidad_usa = 'no disponible'`
3. ✅ **No listado**: Tiene `disponibilidad_usa = 'no listado'`
4. ✅ **Con error registrado**: Tiene `error_verificacion_usa`
   - `PRICE_AND_SELLER_NOT_FOUND`: La página cargó pero no se encontraron precios
   - `TIMEOUT`: Timeout al cargar la página
   - `CAPTCHA`: Amazon bloqueó con captcha

**Todos son válidos** - el producto fue visitado y procesado.

---

## 🔄 Criterio de "Pendiente" en Scripts

Los scripts de verificación usan un criterio **más estricto** para decidir qué productos re-verificar:

### verify-products-mx-batch.js

```javascript
const esPendienteMX = (producto) => {
  // Sin fecha = pendiente
  const fecha = producto.fecha_verificacion_mx;
  if (!fecha) return true;

  // Verificación antigua (> 7 días) = pendiente
  const dias = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24);
  if (dias > 7) return true;

  // Disponible pero sin datos = pendiente
  const disponibilidad = (producto.disponibilidad_mx || '').toLowerCase();
  const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
  const missingCriticos = (!producto.precio_actual_mx && !producto.vendedor_actual_mx) && !producto.error_verificacion_mx;

  return requiereDatos && missingCriticos;
};
```

**Lógica:**
- ✅ **NO pendiente** si tiene precio
- ✅ **NO pendiente** si tiene error registrado
- ✅ **NO pendiente** si NO está disponible
- ⏳ **SÍ pendiente** si dice "disponible" pero no tiene precio NI error

### verify-products-usa-batch.js

```javascript
const esPendienteUSA = (producto) => {
  // Sin fecha = pendiente
  const fecha = producto.fecha_verificacion_usa;
  if (!fecha) return true;

  // Verificación antigua (> 7 días) = pendiente
  const dias = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24);
  if (dias > 7) return true;

  // Disponible pero sin datos = pendiente
  const disponibilidad = (producto.disponibilidad_usa || '').toLowerCase();
  const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
  const missingCriticos = (!producto.precio_actual_usd && !producto.vendedor_actual_usa) && !producto.error_verificacion_usa;

  return requiereDatos && missingCriticos;
};
```

**Misma lógica que MX**.

---

## 📊 Ejemplo Real: AE8MUNDUREHX7 Batch 1

### Estado actual (16/10/2025):

```
Total productos: 642
Con fecha_verificacion_usa: 642
Con precio_actual_usd: 632
Con error_verificacion_usa: 10
```

### Desglose de los 10 sin precio:

#### Grupo 1: Con error registrado (3 productos)
```javascript
{
  asin: 'B0F2FD2VB8',
  disponibilidad_usa: 'disponible',
  precio_actual_usd: null,
  vendedor_actual_usa: null,
  error_verificacion_usa: 'PRICE_AND_SELLER_NOT_FOUND',
  fecha_verificacion_usa: '2025-10-16T03:55:48.464Z'
}
```
**Estado:** ✅ **Verificado** (tiene error registrado)
**Pendiente:** ❌ **NO** (el script no lo re-intentará)

#### Grupo 2: No disponible (7 productos)
```javascript
{
  asin: 'B0B38CMWSL',
  disponibilidad_usa: 'no disponible',
  precio_actual_usd: null,
  vendedor_actual_usa: null,
  error_verificacion_usa: null,
  fecha_verificacion_usa: '2025-10-16T03:42:15.123Z'
}
```
**Estado:** ✅ **Verificado** (no disponible en USA)
**Pendiente:** ❌ **NO** (no hay nada que verificar)

---

## 🎯 Conteo en `detectVendorPhase()`

La función usa este criterio:

```javascript
verificadosUSA = productos.filter(p => {
  // Sin fecha = no verificado
  if (!p.fecha_verificacion_usa) return false;
  
  // Con precio = verificado
  if (p.precio_actual_usd) return true;
  
  // Con error = verificado
  if (p.error_verificacion_usa) return true;
  
  // No disponible/no listado = verificado
  const disponibilidad = (p.disponibilidad_usa || '').toLowerCase();
  return disponibilidad !== '' && disponibilidad !== 'disponible';
}).length;
```

**Resultado para AE8MUNDUREHX7:**
- ✅ 632 con precio
- ✅ 3 con error `PRICE_AND_SELLER_NOT_FOUND`
- ✅ 7 con `disponibilidad_usa = 'no disponible'`
- **Total: 642/642 (100%)**

---

## ⚠️ Casos Especiales

### 1. Productos "disponible" sin precio ni error

**Caso:**
```javascript
{
  asin: 'B08XX123',
  disponibilidad_usa: 'disponible',
  precio_actual_usd: null,
  error_verificacion_usa: null,
  fecha_verificacion_usa: '2025-10-10T12:00:00Z'
}
```

**Estado:** ⚠️ **Verificado incompleto**
- El script lo visitó
- La página cargó (por eso dice "disponible")
- No encontró precio ni vendedor
- NO registró error

**Solución:** Re-verificar
```bash
node scripts/verify-products-usa-batch.js SELLER_ID BATCH
```

El script lo detectará como pendiente y lo re-intentará.

### 2. Productos con verificación antigua (> 7 días)

**Caso:**
```javascript
{
  asin: 'B08XX123',
  precio_actual_usd: 49.99,
  fecha_verificacion_usa: '2025-10-01T12:00:00Z' // Hace 15 días
}
```

**Estado:** ⚠️ **Verificado pero antiguo**

**Solución:** Re-verificar para actualizar precios
```bash
node scripts/verify-products-usa-batch.js SELLER_ID BATCH
```

---

## 🧪 Comandos de Diagnóstico

### Ver resumen completo:

```javascript
node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('data/vendors/SELLER_ID/batch-N-consolidated.json', 'utf8')); const productos = data.all_products; console.log('Total productos:', productos.length); console.log('Con fecha_verificacion_usa:', productos.filter(p => p.fecha_verificacion_usa).length); console.log('Con precio_actual_usd:', productos.filter(p => p.precio_actual_usd).length); console.log('Con error_verificacion_usa:', productos.filter(p => p.error_verificacion_usa).length); console.log('No disponible:', productos.filter(p => (p.disponibilidad_usa || '').toLowerCase() === 'no disponible').length); console.log('No listado:', productos.filter(p => (p.disponibilidad_usa || '').toLowerCase() === 'no listado').length);"
```

### Ver productos pendientes según script:

```javascript
node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('data/vendors/SELLER_ID/batch-N-consolidated.json', 'utf8')); const productos = data.all_products; const esPendienteUSA = (p) => { const fecha = p.fecha_verificacion_usa; if (!fecha) return true; const dias = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24); if (dias > 7) return true; const disponibilidad = (p.disponibilidad_usa || '').toLowerCase(); const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible'; const missingCriticos = (!p.precio_actual_usd && !p.vendedor_actual_usa) && !p.error_verificacion_usa; return requiereDatos && missingCriticos; }; const pendientes = productos.filter(esPendienteUSA); console.log('Pendientes según script:', pendientes.length); if (pendientes.length > 0) { console.log('Ejemplos:'); pendientes.slice(0, 5).forEach(p => console.log(' -', p.asin, ':', p.disponibilidad_usa || 'sin disponibilidad')); }"
```

### Ver productos con errores:

```javascript
node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('data/vendors/SELLER_ID/batch-N-consolidated.json', 'utf8')); const productos = data.all_products; const conError = productos.filter(p => p.error_verificacion_usa); console.log('Productos con error_verificacion_usa:', conError.length); conError.forEach(p => console.log('ASIN:', p.asin, '| Error:', p.error_verificacion_usa, '| Disp:', p.disponibilidad_usa));"
```

---

## 📝 Resumen

| Campo | Valor | Interpretación |
|-------|-------|----------------|
| `fecha_verificacion_usa = null` | ❌ | **No verificado** - Nunca visitado |
| `fecha_verificacion_usa != null` | ✅ | **Verificado** - Fue visitado |
| `precio_actual_usd != null` | ✅ | **Con precio** - Verificación exitosa |
| `disponibilidad_usa = 'no disponible'` | ✅ | **No disponible** - Verificación correcta |
| `disponibilidad_usa = 'no listado'` | ✅ | **No listado** - Verificación correcta |
| `error_verificacion_usa != null` | ✅ | **Con error** - Verificación completa (con problema) |
| `disponibilidad_usa = 'disponible'` + sin precio + sin error | ⚠️ | **Incompleto** - Necesita re-verificación |

---

**Última actualización:** 16 de octubre de 2025  
**Versión:** 1.0
