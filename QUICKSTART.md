# 🚀 Guía Rápida de Inicio

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
node PANELMAESTRO-v2.js
```

### Flujo recomendado

1. **[1] Gestión de Vendedores** → **[1] Registrar nuevo vendedor**
   - Ingresar Seller ID (ej: `A2Q3Y263D00KWC`)
   
2. **[2] Generar Plan** → **[2] Plan Batches**
   - Seleccionar el vendedor recién registrado
   - Sistema genera plan-batch-*.json automáticamente
   
3. **[3] Ejecutar Scraping** → **[2] Scraping por Batch**
   - Seleccionar vendedor
   - Seleccionar batch a extraer
   - Confirmar consolidación (s)
   
4. **Resultado**: Archivos generados en `data/vendors/SELLER_ID/`
   - `consolidated-products.json`
   - `consolidated-products.csv` ✅

## 📚 Documentación

Toda la documentación está en [`docs/`](docs/):

- **Empieza aquí**: [INDICE-DOCUMENTACION.md](docs/INDICE-DOCUMENTACION.md)
- **Sistema modular**: [README-PANELMAESTRO-V2.md](docs/README-PANELMAESTRO-V2.md)
- **Extracción jerárquica**: [README-EXTRACCION-JERARQUICA.md](docs/README-EXTRACCION-JERARQUICA.md)

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

**¿Listo? ¡Ejecuta `node PANELMAESTRO-v2.js` y empieza!** 🚀
