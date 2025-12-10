# 🔥 SCRIPT CORRECTO PARA GENERAR PLANES

## ⭐ **plan-batches-firefox-fixed.js** ✅

Este es el **ÚNICO SCRIPT VALIDADO Y PROBADO** que funciona correctamente para generar planes de batches.

---

## 📋 Información Importante

- **Estado:** ✅ VALIDADO Y FUNCIONANDO
- **Ubicación:** Raíz del proyecto `/plan-batches-firefox-fixed.js`
- **Navegador:** Firefox + anti-detección + manejo robusto de timeouts
- **Uso en MENÚ:** Opción `[2] Plan Batches` → ejecuta este script
- **Uso en PIPELINE:** `amazon-pipeline/config/pipeline-config.js` → configurado para usar este script

---

## 🚀 Cómo Usar

### Desde el MENÚ (Recomendado)
```powershell
node MENU.js
# Selecciona [2] Generar Plan → [2] Plan Batches
# Elige un vendedor
```

### Desde Terminal (Directo)
```powershell
node plan-batches-firefox-fixed.js SELLER_ID
```

**Ejemplo:**
```powershell
node plan-batches-firefox-fixed.js A3Q5ASRA7J8Y5E
```

### Desde Pipeline (Automático)
```powershell
node amazon-pipeline/run-pipeline.js SELLER_ID
```

El pipeline usa automáticamente `plan-batches-firefox-fixed.js` para la fase de planificación.

---

## ✅ Características Probadas

- ✅ Detecta categorías correctamente
- ✅ Evita loops infinitos (anti-loop protections)
- ✅ Maneja timeouts de Amazon
- ✅ Firefox + anti-detección
- ✅ Genera batches con límite de 1000 productos
- ✅ Almacena archivos en `data/vendors/{SELLER_ID}/plan-batch-*.json`

---

## ⚠️ Otros Scripts (No Recomendados)

| Script | Estado | Motivo |
|--------|--------|--------|
| `create-plan-batches.js` | ❌ No probado | Chrome, puede que no funcione |
| `create-plan.js` | ❌ No probado | Chrome, puede que no funcione |
| `plan-batches-firefox.js` | ⚠️ Experimental | Versión antigua, usa firefox-fixed en su lugar |
| `plan-batches-v2-math.js` | ⚠️ Experimental | Validación matemática, no validada completamente |
| `create-test-plan.js` | ⚠️ Solo testing | Solo 4 categorías de prueba |

---

## 📁 Archivos Relacionados

### Configuración del Pipeline
```
amazon-pipeline/config/pipeline-config.js  (línea ~20)
  scripts: {
    plan: {
      path: '../plan-batches-firefox-fixed.js',  ← AQUÍ
      args: []
    }
  }
```

### Configuración del MENÚ
```
modules/menu-planes.js
  → Opción [2] Plan Batches ejecuta plan-batches-firefox-fixed.js
```

---

## 🔍 Verificación

Para verificar que está correctamente configurado:

1. **En el MENÚ:**
   - Ejecuta el MENÚ
   - Selecciona `[2] Generar Plan` → `[2] Plan Batches`
   - Debería ver el banner: `🎬 EJECUTANDO: plan-batches-firefox-fixed.js (VERSIÓN FIREFOX FIXED)`

2. **En el Pipeline:**
   - Ejecuta: `node amazon-pipeline/run-pipeline.js SELLER_ID`
   - Debería ver el banner al llegar a la fase de planificación

3. **Directo:**
   - `node plan-batches-firefox-fixed.js SELLER_ID`
   - Debería ver el banner inmediatamente

---

## 📊 Resultados Esperados

Después de ejecutar el script:

- ✅ Se crean archivos en `data/vendors/{SELLER_ID}/plan-batch-*.json`
- ✅ Cada archivo contiene un batch con categorías y productos
- ✅ El log muestra el número de batches generados
- ✅ No hay errores de timeout
- ✅ No hay loops infinitos

**Ejemplo de salida:**
```
🎬 EJECUTANDO: plan-batches-firefox-fixed.js (VERSIÓN FIREFOX FIXED)
═══════════════════════════════════════════════════════════════

[Navegación y análisis de categorías...]

✅ Plan generado exitosamente
📦 Total: 5 batches
```

---

## 🆘 Si Algo Falla

1. **Timeout en Amazon:**
   - Espera unos minutos
   - Vuelve a intentar
   - Si persiste, usa proxy: `node plan-batches-firefox.js SELLER_ID "http://proxy:8080"`

2. **Firefox no abre:**
   - Verifica que Firefox esté instalado: `where firefox`
   - Si no: instala Firefox

3. **Cookies expiradas:**
   - Ejecuta: `node scripts/save-amazon-cookies-firefox.js`
   - Inicia sesión manualmente
   - Luego vuelve a correr el plan

4. **Archivos no se crean:**
   - Verifica permisos en `data/vendors/`
   - Asegúrate que el SELLER_ID existe en `data/projects.json`

---

## 📝 Resumen

**REGLA DE ORO:**
- 🔥 Usa **plan-batches-firefox-fixed.js** para generar planes
- ❌ NO uses otros scripts de plan
- ✅ Está configurado por defecto en MENÚ y Pipeline
- ✅ Funciona y está probado

---

**Última actualización:** Diciembre 2025  
**Validación:** Script funciona correctamente ✅
