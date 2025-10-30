# 🚀 Guía Rápida de Inicio

## 📖 Antes de Empezar

**Lee primero**: [`docs/MODELO-NEGOCIO.md`](docs/MODELO-NEGOCIO.md)

Este documento explica:
- ✅ Qué hace el sistema (dropshipping USA → MX)
- ✅ Por qué copiamos catálogos de competidores
- ✅ Flujo completo de 8 fases
- ✅ Conceptos clave (ASIN, Buy Box, Snapshot, Batches)

**5 minutos de lectura que te ahorrarán horas de confusión.**

---

## ⚡ Instalación en 3 pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-usuario/amazon-scrapper-otherseller.git
cd amazon-scrapper-otherseller

# 2. Instalar dependencias
npm install

# 3. Instalar navegadores
npx playwright install chromium
```

## 🎯 Primer uso

```bash
# Ejecutar panel principal
node MENU.js
```

### Flujo recomendado para primer vendedor

1. **[1] Gestión de Vendedores** → **[1] Registrar nuevo vendedor**
   - Ingresar Seller ID del competidor (ej: `AE8MUNDUREHX7`)
   - Sistema crea carpeta en `data/vendors/SELLER_ID/`
   
2. **[2] Generar Plan** → **[1] Plan Simple** o **[2] Plan Batches**
   - Seleccionar el vendedor recién registrado
   - Sistema analiza tamaño y genera plan automáticamente
   - Simple: < 1000 productos | Batches: > 1000 productos
   
3. **[3] Ejecutar Scraping** → **[2] Scraping por Batch** (o Simple si aplica)
   - Seleccionar vendedor y batch
   - Esperar extracción completa (puede tomar horas)
   - Confirmar consolidación (s)
   - ⚠️ Esto se hace UNA SOLA VEZ por vendedor
   
4. **[4] Verificar en Amazon MX** → **[1] Verificar productos**
   - Obtiene precio del buy box en MX
   - Guarda: precio_actual_mx, vendedor_actual_mx
   - ⚠️ Snapshot único - NO se vuelve a verificar
   
5. **[5] Verificar en Amazon USA** → **[1] Verificar productos**
   - Obtiene precio en USD (nuestro costo)
   - Guarda: precio_actual_usd, vendedor_actual_usa
   - ⚠️ Snapshot único - NO se vuelve a verificar
   
6. **[6] Generar Oportunidades** → **[1] Generar**
   - Aplica fórmulas de ganancia
   - Genera 3 archivos CSV (exacto, -50, -100)
   - Filtra productos rentables
   
7. **[7] Gestión de Plantillas** → **[3] Llenar plantilla**
   - Seleccionar archivo de oportunidades
   - Máximo 500 productos por plantilla
   - Sistema genera plantilla lista para subir
   
8. **[8] Publicar** → **[1] Subir plantilla**
   - Sube a Amazon Seller Central
   - Espera procesamiento del feed
   - ✅ Productos publicados en tu tienda
   
**Resultado**: Productos rentables publicados y listos para vender.  
**Tiempo total**: ~4-6 horas (la mayoría automatizado)

---

## 📊 Ver Progreso

## � Ver Progreso

En cualquier momento puedes ver el estado del vendedor:

```bash
# Opción 1: Desde el panel
node MENU.js → [1] → [2] Ver lista de vendedores → [3] Ver detalles

# Opción 2: Ver archivos directamente
ls data/vendors/SELLER_ID/
```

**Archivos clave**:
- `plan-batch-*.json` → Plan generado
- `batch-N-consolidated.json` → Productos scrapeados y verificados
- `batch-N-oportunidades.csv` → Productos rentables identificados
- `plantilla-llenada-*.xlsx` → Lista para subir a Amazon

---

## 📚 Documentación

**Empieza aquí**: [`docs/MODELO-NEGOCIO.md`](docs/MODELO-NEGOCIO.md) (10 min)

Luego:
- [README-PANELMAESTRO-V2.md](docs/README-PANELMAESTRO-V2.md) - Uso del panel
- [CRITERIOS-VERIFICACION.md](docs/CRITERIOS-VERIFICACION.md) - Verificación

**Total**: 4 documentos esenciales (~40 minutos)

## 🤝 Contribuir

Lee [CONTRIBUTING.md](CONTRIBUTING.md) para conocer el proceso.

## 📝 Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para cambios en cada versión.

## ⚠️ Importante

- Las cookies de sesión van en `scripts/auth/` (no incluido en repo)
- Los datos generados van en `data/` (ignorado por git)
- Cumple con los TOS de Amazon

## 🆘 Ayuda

- 📖 [Documentación completa](docs/)
- 🐛 [Reportar bug](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues)
- 💡 [Sugerir mejora](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues/new)

---

**¿Listo? ¡Ejecuta `node MENU.js` y empieza!** 🚀
