# 🤖 Amazon Scraper & Publisher System

> Sistema automatizado y modular para scraping, análisis y publicación de productos en Amazon Seller Central

[![Node.js](https://img.shields.io/badge/Node.js-16+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.40+-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## � Descripción

Sistema completo para automatizar el flujo de productos en Amazon:

1. **Scraping inteligente** de productos de vendedores en Amazon México
2. **Verificación** de precios y disponibilidad en Amazon USA
3. **Análisis de oportunidades** de negocio con fórmulas personalizables
4. **Gestión de plantillas** de Seller Central
5. **Publicación automatizada** de productos

**Características clave**:
- ✅ Arquitectura modular y escalable
- ✅ Extracción jerárquica por subcategorías (bypass límite 320 productos)
- ✅ Sistema de batches para vendedores grandes (>1000 productos)
- ✅ Generación automática de CSV para importación
- ✅ Panel de control interactivo (PANELMAESTRO V2)
- ✅ Documentación completa

---

## 🚀 Quick Start

### Prerrequisitos

```bash
# Node.js 16 o superior
node --version

# npm
npm --version
```

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/amazon-scrapper-otherseller.git
cd amazon-scrapper-otherseller

# Instalar dependencias
npm install

# Instalar navegadores de Playwright
npx playwright install
```

### Uso básico

```bash
# Ejecutar panel principal
node PANELMAESTRO-v2.js

# O ejecutar scripts individuales
node scripts/test-seller.js SELLER_ID
```

---

## 📁 Estructura del proyecto

```
amazon-scrapper-otherseller/
│
├── PANELMAESTRO-v2.js           # Panel principal modular
├── modules/                      # Módulos del sistema
│   ├── utils/                    # Utilidades compartidas
│   │   ├── display-utils.js      # Funciones de display
│   │   ├── projects-utils.js     # Gestión de vendedores
│   │   └── vendor-utils.js       # Operaciones de vendedores
│   │
│   ├── menu-vendedores.js        # [1] Gestión de vendedores ✅
│   ├── menu-planes.js            # [2] Planes de scraping ✅
│   ├── menu-scraping.js          # [3] Extracción de productos ✅
│   ├── menu-verificacion-usa.js  # [4] Verificación USA ⏳
│   ├── menu-oportunidades.js     # [5] Oportunidades ⏳
│   ├── menu-plantillas.js        # [6] Plantillas Seller Central ⏳
│   ├── menu-publicacion.js       # [7] Publicación ⏳
│   └── menu-reportes.js          # [8] Reportes ⏳
│
├── scripts/                      # Scripts de automatización
│   ├── a-login.js                # Login y cookies
│   ├── b-scrape-vendedor.js      # Scraping completo
│   └── auth/                     # Configuraciones de auth
│
├── data/                         # Datos generados
│   ├── projects.json             # Registro de vendedores
│   └── vendors/                  # Directorio de vendedores
│       └── SELLER_ID/
│           ├── intelligent-*.json         # Análisis de categorías
│           ├── plan-batch-*.json          # Planes de batches
│           ├── batch-*-products.json      # Productos por batch
│           ├── consolidated-products.json # Productos consolidados
│           └── consolidated-products.csv  # CSV para importar
│
└── docs/                         # Documentación completa
    ├── INDICE-DOCUMENTACION.md
    ├── README-PANELMAESTRO-V2.md
    ├── RESUMEN-IMPLEMENTACION.md
    ├── GUIA-MIGRACION-V1-V2.md
    ├── README-EXTRACCION-JERARQUICA.md
    ├── README-CONSOLIDACION-CSV.md
    └── README-SISTEMA-COMPLETO-BATCH.md
```

---

## 🎯 Funcionalidades principales

### 1️⃣ Gestión de Vendedores

- Registrar nuevos vendedores por Seller ID
- Ver lista completa con estadísticas
- Eliminar vendedores del registro
- Ver detalles completos (archivos, batches, productos)

### 2️⃣ Generación de Planes

- **Plan Simple**: Para vendedores < 1000 productos
- **Plan Batches**: División automática en batches de ~500 productos
- Ver estado de planes y progreso
- Resetear planes para regenerar

### 3️⃣ Extracción de Productos

- **Scraping Simple**: Extracción completa del vendedor
- **Scraping por Batch**: Extracción selectiva por batch
- **Extracción Jerárquica**: Bypass del límite de 320 productos de Amazon
- Ver progreso en tiempo real
- Consolidación automática (JSON + CSV)

**Sistema jerárquico**:
```
Categoría padre (ej: Deportes)
└── Análisis inteligente detecta subcategorías
    ├── Subcategoría 1 (320 productos max) ✅
    ├── Subcategoría 2 (320 productos max) ✅
    ├── Subcategoría 3 (320 productos max) ✅
    └── ...
    = Total: N × 320 productos (sin límite)
```

### 4️⃣ Consolidación y CSV

Generación automática de archivos consolidados:

```json
// consolidated-products.json
{
  "sellerId": "ABC123",
  "totalProducts": 1542,
  "extractionDate": "2024-12-13T...",
  "products": [
    {
      "asin": "B08N5HRD6B",
      "title": "Producto ejemplo",
      "price": 299.00,
      "rating": 4.5,
      "reviews": 1234,
      "category": "Deportes > Fitness",
      "url": "https://...",
      "imageUrl": "https://..."
    }
  ]
}
```

CSV generado automáticamente con escape correcto para importación directa.

---

## �️ Tecnologías

| Tecnología | Uso |
|------------|-----|
| **Node.js 16+** | Runtime de JavaScript |
| **Playwright** | Automatización de navegadores |
| **fs/path** | Gestión de archivos |
| **readline** | Interfaz CLI interactiva |
| **child_process** | Spawn de scripts |

---

## 📚 Documentación

Toda la documentación está en la carpeta **`docs/`**:

| Documento | Descripción |
|-----------|-------------|
| [INDICE-DOCUMENTACION.md](docs/INDICE-DOCUMENTACION.md) | 📑 Índice completo |
| [README-PANELMAESTRO-V2.md](docs/README-PANELMAESTRO-V2.md) | 📘 Sistema modular |
| [RESUMEN-IMPLEMENTACION.md](docs/RESUMEN-IMPLEMENTACION.md) | 📊 Estado del proyecto |
| [GUIA-MIGRACION-V1-V2.md](docs/GUIA-MIGRACION-V1-V2.md) | 🔄 Migración V1→V2 |
| [README-EXTRACCION-JERARQUICA.md](docs/README-EXTRACCION-JERARQUICA.md) | 🌳 Sistema jerárquico |
| [README-CONSOLIDACION-CSV.md](docs/README-CONSOLIDACION-CSV.md) | 📊 Generación CSV |
| [README-SISTEMA-COMPLETO-BATCH.md](docs/README-SISTEMA-COMPLETO-BATCH.md) | 🔄 Flujo de batches |

**Empieza aquí**: [docs/INDICE-DOCUMENTACION.md](docs/INDICE-DOCUMENTACION.md)

---

## 🎮 Ejemplos de uso

### Registrar un vendedor

```bash
node PANELMAESTRO-v2.js
# Seleccionar [1] Gestión de Vendedores
# Seleccionar [1] Registrar nuevo vendedor
# Ingresar Seller ID: A2Q3Y263D00KWC
```

### Generar plan de batches

```bash
node PANELMAESTRO-v2.js
# Seleccionar [2] Generar Plan de Scraping
# Seleccionar [2] Plan Batches
# Ingresar Seller ID
```

### Extraer productos por batch

```bash
node PANELMAESTRO-v2.js
# Seleccionar [3] Ejecutar Scraping
# Seleccionar [2] Scraping por Batch
# Seleccionar vendedor y número de batch
# Consolidar automáticamente: s
```

### Scripts individuales

```bash
# Registrar vendedor
node scripts/test-seller.js A2Q3Y263D00KWC

# Generar plan de batches
node create-plan-batches.js A2Q3Y263D00KWC

# Extraer batch específico
node extract-batch-products.js A2Q3Y263D00KWC 1

# Consolidar productos
node consolidate-batch-products.js A2Q3Y263D00KWC
```

---

## 🏗️ Arquitectura modular

```
┌─────────────────────────────────┐
│   PANELMAESTRO-v2.js            │
│   (Orquestador principal)       │
└────────────┬────────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐    ┌─────────┐
│ Módulos │◄───┤  Utils  │
│ 8 menús │    │ 3 files │
└─────────┘    └─────────┘
```

**Ventajas**:
- ✅ Código modular y mantenible
- ✅ Utilidades reutilizables (30 funciones)
- ✅ Fácil de extender
- ✅ Testing independiente por módulo

---

## 🔒 Seguridad y buenas prácticas

- ✅ Cookies de sesión en archivos locales (`.gitignore`)
- ✅ User-Agent realista para evitar detección
- ✅ Pausas aleatorias entre requests
- ✅ Scroll progresivo para simular usuario real
- ✅ Sin credenciales hardcodeadas

**Nota**: El archivo `scripts/auth/` debe estar en `.gitignore`

---

## 📈 Rendimiento

| Métrica | Valor |
|---------|-------|
| **Productos por página** | 16 |
| **Páginas por subcategoría** | 20 (máx 320 productos) |
| **Subcategorías procesadas** | Sin límite |
| **Tiempo por producto** | ~2-3 segundos |
| **Productos por hora** | ~1200-1800 |

**Ejemplo real**:
- Vendedor con 3 categorías, 14 subcategorías
- Total: ~1500 productos
- Tiempo estimado: ~1.5-2 horas

---

## 🤝 Contribuir

Las contribuciones son bienvenidas! Para contribuir:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Roadmap

### ✅ Completado (v2.0)
- [x] Sistema modular PANELMAESTRO V2
- [x] Extracción jerárquica por subcategorías
- [x] Sistema de batches
- [x] Generación automática de CSV
- [x] Gestión de vendedores
- [x] Planes de scraping
- [x] Documentación completa

### ⏳ En desarrollo
- [ ] Verificación en Amazon USA
- [ ] Generación de oportunidades de negocio
- [ ] Gestión de plantillas Seller Central
- [ ] Publicación automatizada
- [ ] Sistema de reportes

### 🔮 Futuro
- [ ] Interfaz web (React/Next.js)
- [ ] API REST
- [ ] Dashboard con métricas en tiempo real
- [ ] Notificaciones por Telegram/Email
- [ ] Sistema de alertas de precios
- [ ] Multi-marketplace (USA, MX, etc.)

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

---

## 👨‍💻 Autor

Desarrollado con ☕ y mucho 💻

---

## 🆘 Soporte

¿Problemas o preguntas?

1. Revisa la [documentación completa](docs/INDICE-DOCUMENTACION.md)
2. Busca en [Issues](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues)
3. Crea un nuevo Issue con detalles

---

## ⚠️ Disclaimer

Este proyecto es solo para fines educativos y de automatización personal. Asegúrate de cumplir con los Términos de Servicio de Amazon y las leyes aplicables de scraping web en tu jurisdicción.

---

<div align="center">

**⭐ Si este proyecto te fue útil, considera darle una estrella!**

[Documentación](docs/) • [Issues](https://github.com/tu-usuario/amazon-scrapper-otherseller/issues) • [Contribuir](#-contribuir)

</div>

d-filtra-productos.js

Entrada: El archivo data/full_data.json.

Proceso:

Lee la lista completa de productos.

Aplica una fórmula de negocio (que definiremos juntos) para decidir si un producto es rentable. Esta fórmula considerará el precio_mx, el costo_usd, comisiones de Amazon, costos de importación y el margen de ganancia deseado.

Filtra la lista para quedarse solo con los productos que califican.

Salida: Un archivo data/publicar.json con la lista final de ASINs listos para ser publicados.

## 🔍 Enriquecimiento de Datos de Productos

El sistema incluye una **Fase 5** automática de enriquecimiento que actualiza cada producto con información en tiempo real de Amazon MX. Esta fase está integrada en el workflow principal de **cerebro.js**.

### 📋 Proceso de Enriquecimiento

**Integrado en cerebro.js**: El enriquecimiento se ejecuta automáticamente tras la extracción de productos
**Procesamiento por lotes**: Procesa productos en lotes pequeños para evitar interrupciones
**Progreso persistente**: Puede interrumpirse y reanudarse automáticamente

### Script Manual: `enrich-products-batch.js`

**Propósito:** Enriquecer productos en lotes controlados con:
- Precio actual en Amazon MX
- Vendedor actual
- Estado de disponibilidad 
- Fecha de última actualización

**Uso manual:**
```bash
node enrich-products-batch.js SELLER_ID [CANTIDAD]
```

**Ejemplos:**
```bash
# Procesar lote de 25 productos (default: 50)
node enrich-products-batch.js A3Q5ASRA7J8Y5E 25

# Procesar lote de 50 productos
node enrich-products-batch.js A3Q5ASRA7J8Y5E
```

### 🛡️ Características de Seguridad

- **Sin backups**: Actualiza archivos directamente (como verificar_en_mx.js)
- **Procesamiento por lotes**: Evita procesos largos que pueden fallar
- **Delays aleatorios**: 3-6 segundos entre productos para comportamiento natural
- **Detección inteligente**: Identifica productos ya enriquecidos o desactualizados
- **Auto-reanudación**: El cerebro continúa automáticamente hasta completar todos los productos

### 📊 Integración con Cerebro

El enriquecimiento es **Fase 5** del proceso automatizado:

1. **Fase 1**: Análisis inicial del vendedor
2. **Fase 2**: Plan de categorías  
3. **Fase 3**: Scraping automático de productos
4. **Fase 4**: Extracción y consolidación de ASINs
5. **Fase 5**: **Enriquecimiento con datos actuales de MX** ← NUEVA
6. **Fase 6**: Verificación en Amazon USA

### 📁 Archivos Actualizados

**Archivo principal enriquecido:**
- `all-products-consolidated.json` - Datos completos con enriquecimiento  
- `all-products-consolidated.csv` - Versión CSV actualizada

**Nuevos campos agregados:**
- `precio_actual_mx`: Precio actual en Amazon MX
- `vendedor_actual_mx`: Vendedor actual
- `disponibilidad_mx`: Estado actual (disponible/no disponible/no listado)
- `fecha_enriquecimiento`: Timestamp de última actualización
- `error_enriquecimiento`: Mensaje de error si ocurrió algún problema

**Archivos enriquecidos:**
- `all-products-enriched.json` - Datos completos con información actualizada
- `all-products-enriched.csv` - Formato CSV para análisis externo
- `enrichment-progress.json` - Progreso del proceso (interno)

### 📊 Información Añadida

Cada producto se enriquece con un objeto `enrichment`:
```json
{
  "asin": "B0FFM7T35T",
  "title": "Producto original...",
  "price": "$921.31",
  "category": "Últimos 90 Días", 
  "enrichment": {
    "current_price": "$850.00",
    "current_seller": "Sky Direct LLC",
    "original_price": "$921.31",
    "price_changed": true,
    "seller_changed": false,
    "last_checked": "2025-10-10T19:45:00.000Z",
    "status": "available"
  }
}
```

### 🔄 Reanudación de Proceso

Si el proceso se interrumpe:
1. El progreso se guarda automáticamente cada 5 productos
2. Al reiniciar, continúa desde donde se quedó
3. No reprocesa ASINs ya completados
4. Mantiene todos los datos previamente enriquecidos

Scripts Existentes (¡Ya funcionan! ✅):
Estos scripts forman la última parte del flujo y se encargarán de la publicación masiva. Tu misión será integrar la salida del script d-filtra-productos.js con este flujo.

e-solicita-archivo.js: Pide a Amazon el template para publicación masiva.

f-descarga-archivo.js: Descarga el archivo solicitado.

g-modifica-archivo.js: Toma los datos de data/publicar.json, calcula los precios finales y días de entrega, y los inserta en el template.

h-sube-archivo.js: Sube el archivo modificado a nuestra cuenta de Seller Central para procesar la publicación.

⚠️ Metodología de Desarrollo y Debugging
Esta es la parte más importante. Para asegurar que construimos un sistema confiable, seguiremos estas reglas estrictamente:

Desarrollo Incremental: Nos enfocaremos en un solo script a la vez. No pasaremos al siguiente hasta que el actual funcione perfectamente.

Pruebas Constantes: Después de cada pequeño cambio, ejecutaremos el script para validar que no hemos roto nada y que el cambio funciona como se espera.

Cero Suposiciones: Si ocurre un error, no intentaremos "parcharlo" o adivinar la causa. Nuestra primera tarea será replicar el error de manera consistente.

Análisis de Causa Raíz: Usaremos console.log, el debugger de Node.js y las herramientas de Playwright (como el modo headless: false para ver el navegador) para entender exactamente por qué ocurre el error. Investigaremos si es un selector CSS que cambió, un CAPTCHA, un bloqueo de IP, etc.

Validación Post-Corrección: Una vez que tengamos una hipótesis clara del problema y una solución, la implementaremos y probaremos exhaustivamente para confirmar que el error se ha resuelto y no hemos introducido nuevos problemas.

En resumen: Paso a paso, probando todo, y sin asumir nada.

🚀 Guía de Inicio y Primeros Pasos
Tu primera tarea será construir el script b-scrape-vendedor.js.

Configuración Inicial
Clona este repositorio en tu máquina local.

Asegúrate de tener Node.js (versión 18 o superior) instalado.

Instala las dependencias del proyecto:

Bash

npm install
Playwright necesitará instalar los navegadores. La primera vez que ejecutes un script, puede que te pida hacerlo, o puedes forzarlo con:

Bash

npx playwright install
Crea un archivo .env en la raíz del proyecto para gestionar las variables de entorno (credenciales, URLs, etc.). Pídeme el contenido del archivo .env.example.

Tu Misión (Paso 1)
Familiarízate: Revisa el script a-login.js que ya está creado para entender cómo se maneja la cookie de sesión.

Crea el Script: Crea un nuevo archivo llamado b-scrape-vendedor.js.

Desarrolla la Lógica:

Importa Playwright.

Crea una función async principal.

Dentro de la función, implementa la lógica para cargar la cookie de sesión guardada.

Navega a la URL de la tienda del vendedor (la definiremos en el archivo .env).

Identifica los selectores CSS para los productos, sus ASINs y sus precios.

Crea un bucle que maneje la paginación para recorrer todas las páginas de la tienda.

Guarda los datos extraídos en el formato especificado en un archivo JSON.

Prueba exhaustivamente: Ejecuta el script contra la tienda real y verifica que extrae todos los productos correctamente y sin errores.

¡Bienvenido al proyecto! Si tienes cualquier duda, pregunta. La comunicación es clave.

## 📄 Exportación automática a CSV

Cada vez que se consolida el archivo `all-products-consolidated.json` (productos únicos, sin duplicados), el sistema genera automáticamente un archivo CSV en la misma carpeta y con el mismo nombre base: `all-products-consolidated.csv`.

**Ubicación:**
- `data/vendors/SELLER_ID/all-products-consolidated.csv`

**Formato de columnas:**
- `asin`: Código ASIN del producto
- `title`: Título del producto
- `price`: Precio extraído
- `category`: Categoría principal donde fue encontrado
- `also_appears_in`: Otras categorías donde aparece (separadas por `|`)
- `extracted_at`: Fecha/hora de extracción

**Ejemplo de fila CSV:**
```
asin,title,price,category,also_appears_in,extracted_at
B0FFM7T35T,"XSHINOVA - Soporte para cápsulas...",$921.31,Últimos 90 Días,Cocina|Meses sin Intereses,2025-10-10T17:11:52.328Z
```

Esto permite importar fácilmente los productos únicos a Excel, Google Sheets o cualquier sistema externo.

---

## 🔄 SISTEMA INCREMENTAL POR LOTES

Para vendedores grandes con más de 2,000 productos, el proyecto incluye un **Sistema Incremental por Lotes** que permite trabajar de forma modular y resumible.

### 📋 ¿Por qué usar el sistema incremental?

**Problemas con vendedores grandes:**
- ❌ Sesiones muy largas (horas de scraping ininterrumpido)
- ❌ Si falla a mitad del proceso, se pierde todo el progreso
- ❌ Difícil detectar errores en miles de productos
- ❌ Imposible interrumpir sin perder trabajo

**Ventajas del sistema incremental:**
- ✅ Sesiones cortas y manejables (~1000 productos por lote)
- ✅ Reanudación automática desde el último lote
- ✅ Fácil detección de errores por lote
- ✅ Puedes interrumpir y reanudar cuando quieras
- ✅ Ideal para vendedores de 10,000+ productos

### 🎯 Flujo de Trabajo Incremental

```
1. REGISTRO
   node test-seller.js SELLER_ID
   ↓ Análisis rápido (productos totales, categorías)
   ↓ Guarda en projects.json
   ↓ NO inicia scraping

2. PLANIFICACIÓN POR LOTES
   node create-plan-batches.js SELLER_ID
   ↓ Agrupa categorías en lotes de ~1000 productos
   ↓ Guarda: plan-batch-1.json, plan-batch-2.json, ...
   ↓ Reanudable automáticamente
   ↓ Actualiza projects.json con cada batch

3. PROCESAMIENTO POR BATCHES ✅
   node process-all-categories.js SELLER_ID
   ↓ Detecta archivos batch-N.json automáticamente
   ↓ Procesa cada batch secuencialmente
   ↓ Actualiza estado en projects.json
   ↓ Reanudable por batch
   ↓ Extrae productos de categorías del batch
```

### 📦 Archivos de Batch

**Ubicación:**
```
data/vendors/SELLER_ID/
├── 2025-10-12-plan-batch-1.json    # Lote 1 (categorías 1-3, ~1000 productos)
├── 2025-10-12-plan-batch-2.json    # Lote 2 (categorías 4-7, ~980 productos)
├── 2025-10-12-plan-batch-3.json    # Lote 3 (categorías 8-10, ~1100 productos)
└── ...
```

**Estructura de un batch:**
```json
{
  "seller_id": "A3Q5ASRA7J8Y5E",
  "batch_number": 1,
  "created_at": "2025-10-12T...",
  "analysis_type": "recursive_hierarchical_batch",
  "max_products_per_batch": 1000,
  "main_categories": ["Hogar", "Electrónicos", ...],
  "categories": [
    {
      "name": "Hogar y Cocina",
      "url": "https://...",
      "expected_products": 408,
      "depth": 1,
      "status": "pending",
      "subcategories": [...]
    }
  ]
}
```

### 🔧 Scripts del Sistema Incremental

#### **1. test-seller.js** - Registro de Vendedores

**Propósito:** Registrar vendedores para análisis posterior sin iniciar scraping.

**Uso:**
```bash
node test-seller.js SELLER_ID
```

**Qué hace:**
- Navega a la página del vendedor
- Extrae total de productos
- Extrae categorías principales
- Guarda en `projects.json` con status `discovered`
- NO inicia scraping automáticamente

**Ejemplo:**
```bash
node test-seller.js A3Q5ASRA7J8Y5E
# ✅ 10,500 productos detectados
# ✅ 15 categorías principales
# 💡 Recomendación: Usar sistema de lotes (>2000 productos)
```

#### **2. create-plan-batches.js** - Planificación por Lotes

**Propósito:** Crear planes jerárquicos divididos en lotes de ~1000 productos.

**Uso:**
```bash
node create-plan-batches.js SELLER_ID
```

**Configuración:**
- `MAX_PRODUCTS_PER_BATCH = 1000` (máximo por lote)
- `MAX_PRODUCTS_PER_CATEGORY = 320` (límite de Amazon)
- `MAX_RECURSION_DEPTH = 10` (profundidad máxima)

**Qué hace:**
1. Detecta batches existentes (reanudación automática)
2. Navega a cada categoría principal
3. Analiza recursivamente (subdivide si > 320 productos)
4. Agrupa categorías hasta ~1000 productos
5. Guarda lote cuando alcanza el límite
6. Actualiza `projects.json` con información del batch
7. Continúa con siguiente lote

**Reanudación automática:**
```bash
# Primera ejecución - crea batch 1 y 2
node create-plan-batches.js A3Q5ASRA7J8Y5E
# [Se interrumpe después de batch 2]

# Segunda ejecución - reanuda desde batch 3
node create-plan-batches.js A3Q5ASRA7J8Y5E
# ♻️  REANUDANDO desde batch 3
# ⏭️  Saltando 7 categorías ya procesadas
```

**Ejemplo de output:**
```
Categorías principales: 15

Batch 1: Categorías 1-4 → 1,050 productos
  ✅ Guardado: 2025-10-12-plan-batch-1.json

Batch 2: Categorías 5-8 → 980 productos
  ✅ Guardado: 2025-10-12-plan-batch-2.json

Batch 3: Categorías 9-12 → 1,100 productos
  ✅ Guardado: 2025-10-12-plan-batch-3.json
```

### 📊 Panel de Control: PANELMAESTRO.js

El panel incluye una nueva opción **[6] Sistema Incremental por Lotes** con submenu completo:

**Opciones disponibles:**
- `[1]` Registrar nuevo vendedor (test-seller.js)
- `[2]` Crear planes por lotes (create-plan-batches.js)
- `[3]` Ver estado de batches de un vendedor
- `[4]` Ver documentación del sistema incremental

**Ejemplo de uso:**
```bash
node PANELMAESTRO.js
# Seleccionar opción [6]
# Luego [1] para registrar vendedor
# Luego [2] para crear planes por lotes
# Finalmente [3] para ver progreso
```

### 📖 Documentación Completa

Para información detallada sobre el sistema incremental, consulta:
- **GUIA-SISTEMA-INCREMENTAL.md** - Guía completa con ejemplos y casos de uso

### 🎯 Casos de Uso Recomendados

**Vendedor pequeño (< 1000 productos):**
```bash
# Usar flujo tradicional
node cerebro.js SELLER_ID
```

**Vendedor mediano (1000-2000 productos):**
```bash
# Puede usar cualquiera de los dos sistemas
# Sistema incremental recomendado si quieres control granular
node test-seller.js SELLER_ID
node create-plan-batches.js SELLER_ID  # Creará 2 batches
```

**Vendedor grande (10,000+ productos):**
```bash
# Sistema incremental ALTAMENTE RECOMENDADO
node test-seller.js SELLER_ID
node create-plan-batches.js SELLER_ID  # Creará ~10 batches
# Puedes interrumpir y reanudar cuando quieras
```

### 💡 Mejores Prácticas

1. **Registra múltiples vendedores primero:**
   ```bash
   node test-seller.js A111111111
   node test-seller.js B222222222
   node test-seller.js C333333333
   # Luego revisa y elige cuál trabajar desde el panel
   ```

2. **Para vendedores grandes, trabaja en sesiones:**
   ```bash
   # Sesión 1: Crea primeros 3 batches (1 hora de trabajo)
   node create-plan-batches.js B222222222
   
   # Sesión 2: Continúa donde quedó (automáticamente)
   node create-plan-batches.js B222222222
   ```

3. **Verifica batches antes de procesar:**
   ```bash
   # Lista archivos de batch
   ls data/vendors/B222222222/*batch*.json
   
   # O usa el panel para ver detalle completo
   node PANELMAESTRO.js  # Opción [6] → [3]
   ```

### ✅ Sistema Completo Implementado

El sistema de procesamiento por batches ya está completamente funcional:
- ✅ Procesar cada batch secuencialmente
- ✅ Ver progreso detallado por batch
- ✅ Reanudar procesamiento desde cualquier batch
- ✅ Actualización automática de estado en projects.json
- ✅ Detección automática de modo (batches vs plan único)

**Uso:**
```bash
# El mismo script detecta automáticamente el modo
node process-all-categories.js SELLER_ID

# Si hay archivos batch-N.json → Modo batches
# Si solo hay plan.json → Modo tradicional
```

---