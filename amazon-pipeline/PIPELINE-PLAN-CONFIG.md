# 🔄 CONFIGURACIÓN DE PIPELINE

## Script de Plan Configurado

**Script:** `plan-batches-firefox-fixed.js`  
**Estado:** ✅ Validado y funcionando  
**Ubicación en config:** `config/pipeline-config.js` línea ~20

```javascript
scripts: {
  plan: {
    path: '../plan-batches-firefox-fixed.js',  // ← ESTE ES EL CORRECTO
    args: []
  }
```

---

## ¿Por qué plan-batches-firefox-fixed.js?

- ✅ Único script validado para generar planes correctamente
- ✅ Maneja timeouts de Amazon robustamente
- ✅ Firefox + anti-detección
- ✅ Evita loops infinitos
- ✅ Probado en producción

---

## Cómo Usar el Pipeline

### Ejecución Completa
```powershell
node run-pipeline.js SELLER_ID
```

Ejecutará automáticamente todas las fases en orden:
1. **Plan** → `plan-batches-firefox-fixed.js` ← AQUÍ
2. **Scraping** → `extract-batch-products.js`
3. **Consolidation** → `consolidate-batch-products.js`
4. **Verificar MX** → `scripts/verify-products-mx-batch.js`
5. **Verificar USA** → `scripts/verify-products-usa-batch.js`
6. **Oportunidades** → `generar-oportunidades-consolidadas.js`

### Ejecución de Fase Específica
```powershell
node run-pipeline.js SELLER_ID plan
```

Solo ejecuta la fase de plan.

---

## Monitoreo

Durante la ejecución del pipeline, verás:

```
🎬 EJECUTANDO: plan-batches-firefox-fixed.js (VERSIÓN FIREFOX FIXED)
═══════════════════════════════════════════════════════════════

[Logs de navegación y análisis...]

✅ Plan generado exitosamente
📦 Total: 5 batches

[Pipeline continúa con siguiente fase...]
```

---

## Si Necesitas Cambiar el Script

**⚠️ NO recomendado.** Pero si es necesario:

1. Abre: `amazon-pipeline/config/pipeline-config.js`
2. Busca: `scripts: { plan: {`
3. Cambia el `path` a otro script
4. Guarda y documenta por qué

**Ejemplo:**
```javascript
scripts: {
  plan: {
    path: '../create-plan-batches.js',  // Cambio manual NO RECOMENDADO
    args: []
  }
```

⚠️ Si cambias esto, el pipeline puede fallar.

---

## Referencia Completa

Ver documentación principal: `/SCRIPT-PLAN-CORRECTO.md`
