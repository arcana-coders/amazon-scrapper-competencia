# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.0.0] - 2024-12-13

### 🎉 Lanzamiento Mayor - Arquitectura Modular

Esta versión representa una reescritura completa del sistema con arquitectura modular.

### ✨ Agregado

#### Sistema Modular
- **MENU.js**: Orquestador principal completamente modular
- **modules/**: Nueva estructura de módulos independientes
  - `menu-vendedores.js`: Gestión completa de vendedores (100% funcional)
  - `menu-planes.js`: Generación de planes simple y por batches (100% funcional)
  - `menu-scraping.js`: Sistema de extracción con batches (100% funcional)
  - 5 módulos stub listos para implementación

#### Utilidades Compartidas (modules/utils/)
- `display-utils.js`: 10 funciones de display y formateo
- `projects-utils.js`: 9 funciones de gestión de proyectos
- `vendor-utils.js`: 11 funciones de operaciones de vendedores
- Total: 30 funciones reutilizables

#### Sistema de Extracción Jerárquica
- Análisis inteligente de categorías y subcategorías
- Bypass del límite de 320 productos de Amazon
- Extracción por subcategorías sin límite
- Consolidación automática JSON + CSV

#### Documentación Completa
- `docs/INDICE-DOCUMENTACION.md`: Índice completo de documentación
- `docs/README-PANELMAESTRO-V2.md`: Guía completa del sistema modular
- `docs/RESUMEN-IMPLEMENTACION.md`: Estado del proyecto y métricas
- `docs/GUIA-MIGRACION-V1-V2.md`: Guía de migración paso a paso
- `docs/README-EXTRACCION-JERARQUICA.md`: Sistema jerárquico explicado
- `docs/README-CONSOLIDACION-CSV.md`: Generación de CSV
- `docs/README-SISTEMA-COMPLETO-BATCH.md`: Flujo completo de batches

#### Configuración para GitHub
- `README.md`: README profesional con badges y estructura completa
- `.gitignore`: Configuración apropiada para Node.js
- `LICENSE`: Licencia MIT
- `CONTRIBUTING.md`: Guía completa de contribución
- `CHANGELOG.md`: Este archivo

### 🔄 Cambiado

- **Arquitectura**: De monolítico a modular
- **Organización**: Módulos independientes en lugar de un archivo gigante
- **Utilidades**: De funciones duplicadas a utilities compartidas
- **Documentación**: Reorganizada en carpeta `docs/`

### 🚀 Mejorado

- **Mantenibilidad**: Código más limpio y organizado
- **Escalabilidad**: Fácil agregar nuevos módulos
- **Testing**: Posibilidad de testear módulos independientemente
- **Rendimiento**: Optimización en extracción jerárquica
- **UX**: Interfaz CLI más clara con typewriter effects

### 📊 Métricas

- **Líneas de código**: ~2,350 líneas
- **Archivos creados**: 18 archivos nuevos
- **Funciones de utilidades**: 30
- **Módulos completos**: 3/8 (37.5%)
- **Cobertura de documentación**: 100%

---

## [1.0.0] - 2024-10-13

### 🎉 Lanzamiento Inicial

Primera versión funcional del sistema de scraping de Amazon.

### ✨ Agregado

#### Scripts Core
- `scripts/a-login.js`: Login y gestión de cookies
- `scripts/b-scrape-vendedor.js`: Scraping completo de vendedor
- `test-seller.js`: Registro de vendedores

#### Sistema de Batches
- `create-plan-batches.js`: Generación de planes de batches
- `extract-batch-products.js`: Extracción por batch
- `consolidate-batch-products.js`: Consolidación de productos

#### Análisis Inteligente
- Sistema de análisis de categorías
- Detección automática de subcategorías
- Generación de archivos `intelligent-*.json`

#### Estructura de Datos
- `data/projects.json`: Registro de vendedores
- `data/vendors/`: Directorio por vendedor
- Archivos JSON con productos extraídos

#### Documentación Inicial
- `readme.md`: Documentación básica del proyecto
- Scripts de ejemplo en `examples/`

### 🔧 Configuración

- Playwright para automatización de navegadores
- Node.js 16+ como runtime
- Estructura básica de directorios

---

## [Unreleased]

### 🔮 Planificado

#### Módulos Pendientes
- [ ] `menu-verificacion-usa.js`: Verificación en Amazon USA
- [ ] `menu-oportunidades.js`: Generación de oportunidades
- [ ] `menu-plantillas.js`: Gestión de plantillas Seller Central
- [ ] `menu-publicacion.js`: Publicación de productos
- [ ] `menu-reportes.js`: Sistema de reportes

#### Mejoras Futuras
- [ ] Interfaz web (React/Next.js)
- [ ] API REST
- [ ] Dashboard con métricas en tiempo real
- [ ] Notificaciones por Telegram/Email
- [ ] Sistema de alertas de precios
- [ ] Multi-marketplace (USA, MX, etc.)
- [ ] Sistema de logs estructurados
- [ ] Retry logic en operaciones críticas
- [ ] Tests automatizados (Jest/Mocha)

---

## Tipos de cambios

- `✨ Agregado`: Para nuevas funcionalidades
- `🔄 Cambiado`: Para cambios en funcionalidades existentes
- `❌ Deprecado`: Para funcionalidades que serán eliminadas
- `🗑️ Eliminado`: Para funcionalidades eliminadas
- `🐛 Corregido`: Para corrección de bugs
- `🔒 Seguridad`: Para cambios de seguridad
- `🚀 Mejorado`: Para mejoras de rendimiento o UX
- `📚 Documentación`: Para cambios solo en documentación

---

## Links

- [Repositorio](https://github.com/tu-usuario/amazon-scrapper-otherseller)
- [Issues](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues)
- [Pull Requests](https://github.com/tu-usuario/amazon-scrapper-otherseller/pulls)
- [Documentación](docs/INDICE-DOCUMENTACION.md)
