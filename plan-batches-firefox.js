/**
 * plan-batches-firefox.js - VERSIÓN CORREGIDA
 *
 * Mejoras implementadas:
 * - Sistema de tracking de URLs visitadas para prevenir loops
 * - Normalización de URLs de Amazon para detectar duplicados
 * - Detección de categorías anómalas (productos masivos)
 * - Sistema de checkpoints para recuperar estado
 * - Límites de profundidad y visitas por categoría
 * - Timeouts configurables para operaciones largas
 */

let browserLauncher = null;
let usingPlaywrightExtra = false;
try {
  const playwrightExtra = require('playwright-extra');
  const stealth = require('playwright-extra-plugin-stealth')();
  playwrightExtra.use(stealth);
  browserLauncher = playwrightExtra.firefox;
  usingPlaywrightExtra = true;
  console.log('🔐 playwright-extra y stealth detectados y activados');
} catch (e) {
  const { firefox } = require('playwright');
  browserLauncher = firefox;
  console.log('⚠️ playwright-extra o plugin stealth no instalado — usando playwright/firefox estándar');
}

const fs = require('fs');
const path = require('path');

// ============================================================================
// CLASE PARA TRACKING DE CATEGORÍAS Y PREVENCIÓN DE LOOPS
// ============================================================================

class CategoryTracker {
  constructor(checkpointFile = null) {
    this.visitedUrls = new Set();           // URLs exactas visitadas
    this.normalizedUrls = new Set();        // URLs normalizadas (sin params irrelevantes)
    this.visitedCategories = new Map();     // nombre -> count
    this.categoryPath = [];                 // breadcrumb actual del árbol
    this.checkpointFile = checkpointFile;
    this.visitLog = [];                     // Log de todas las visitas
  }

  /**
   * Normaliza una URL de Amazon para detectar duplicados
   * Extrae solo los parámetros relevantes que identifican la categoría
   */
  normalizeAmazonUrl(url) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Extraer parámetros clave
      const rh = params.get('rh') || '';
      const me = params.get('me') || '';
      const i = params.get('i') || '';
      
      // Crear clave única ignorando parámetros irrelevantes como qid, ref, etc.
      const key = `${me}|${rh}|${i}`.toLowerCase();
      
      return key;
    } catch (e) {
      return url; // fallback
    }
  }

  /**
   * Verifica si debemos visitar una categoría
   */
  shouldVisitCategory(url, categoryName) {
    // 1. Verificar URL exacta
    if (this.visitedUrls.has(url)) {
      console.log(`⚠️ URL ya visitada: ${categoryName}`);
      this.visitLog.push({ 
        timestamp: new Date().toISOString(), 
        category: categoryName, 
        action: 'SKIP_URL_EXACT', 
        url: url.substring(0, 100) 
      });
      return false;
    }

    // 2. Verificar URL normalizada (detecta parámetros equivalentes)
    const normalized = this.normalizeAmazonUrl(url);
    if (this.normalizedUrls.has(normalized)) {
      console.log(`⚠️ URL normalizada ya visitada: ${categoryName}`);
      console.log(`   Clave normalizada: ${normalized}`);
      this.visitLog.push({ 
        timestamp: new Date().toISOString(), 
        category: categoryName, 
        action: 'SKIP_URL_NORMALIZED', 
        normalized 
      });
      return false;
    }

    // 3. Verificar loop en el path actual (misma categoría en la cadena)
    if (this.categoryPath.includes(categoryName)) {
      console.log(`🔄 Loop detectado: "${categoryName}" ya está en el path actual`);
      console.log(`   Path: ${this.categoryPath.join(' > ')}`);
      this.visitLog.push({ 
        timestamp: new Date().toISOString(), 
        category: categoryName, 
        action: 'SKIP_LOOP_IN_PATH', 
        path: [...this.categoryPath] 
      });
      return false;
    }

    // 4. Límite de visitas por nombre de categoría
    const visitCount = this.visitedCategories.get(categoryName) || 0;
    const MAX_VISITS_PER_CATEGORY = 3; // Máximo 3 variaciones de la misma categoría
    
    if (visitCount >= MAX_VISITS_PER_CATEGORY) {
      console.log(`⚠️ Categoría "${categoryName}" ya visitada ${visitCount} veces (límite alcanzado)`);
      this.visitLog.push({ 
        timestamp: new Date().toISOString(), 
        category: categoryName, 
        action: 'SKIP_MAX_VISITS', 
        count: visitCount 
      });
      return false;
    }

    return true;
  }

  /**
   * Marca una categoría como visitada
   */
  markAsVisited(url, categoryName) {
    this.visitedUrls.add(url);
    this.normalizedUrls.add(this.normalizeAmazonUrl(url));
    this.visitedCategories.set(categoryName, (this.visitedCategories.get(categoryName) || 0) + 1);
    
    this.visitLog.push({ 
      timestamp: new Date().toISOString(), 
      category: categoryName, 
      action: 'VISITED', 
      url: url.substring(0, 100),
      visitNumber: this.visitedCategories.get(categoryName)
    });
  }

  /**
   * Entrar a una categoría (añadir al breadcrumb)
   */
  enterCategory(name) {
    this.categoryPath.push(name);
  }

  /**
   * Salir de una categoría (remover del breadcrumb)
   */
  exitCategory() {
    this.categoryPath.pop();
  }

  /**
   * Guardar checkpoint del estado actual
   */
  saveCheckpoint() {
    if (!this.checkpointFile) return;

    try {
      const data = {
        timestamp: new Date().toISOString(),
        visitedUrls: Array.from(this.visitedUrls),
        normalizedUrls: Array.from(this.normalizedUrls),
        visitedCategories: Object.fromEntries(this.visitedCategories),
        categoryPath: [...this.categoryPath],
        totalVisits: this.visitedUrls.size,
        visitLog: this.visitLog.slice(-50) // Solo últimas 50 entradas
      };

      fs.writeFileSync(this.checkpointFile, JSON.stringify(data, null, 2));
      console.log(`💾 Checkpoint guardado: ${this.visitedUrls.size} URLs visitadas`);
    } catch (error) {
      console.error(`❌ Error guardando checkpoint: ${error.message}`);
    }
  }

  /**
   * Cargar checkpoint previo
   */
  loadCheckpoint() {
    if (!this.checkpointFile || !fs.existsSync(this.checkpointFile)) {
      return false;
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf8'));
      
      this.visitedUrls = new Set(data.visitedUrls || []);
      this.normalizedUrls = new Set(data.normalizedUrls || []);
      this.visitedCategories = new Map(Object.entries(data.visitedCategories || {}));
      this.categoryPath = data.categoryPath || [];
      this.visitLog = data.visitLog || [];

      console.log(`📥 Checkpoint cargado del ${data.timestamp}`);
      console.log(`   ${this.visitedUrls.size} URLs ya visitadas`);
      console.log(`   ${this.visitedCategories.size} categorías únicas procesadas`);
      
      return true;
    } catch (error) {
      console.error(`❌ Error cargando checkpoint: ${error.message}`);
      return false;
    }
  }

  /**
   * Guardar log de visitas en archivo separado
   */
  saveVisitLog(filepath) {
    try {
      fs.writeFileSync(filepath, JSON.stringify(this.visitLog, null, 2));
      console.log(`📋 Log de visitas guardado: ${filepath}`);
    } catch (error) {
      console.error(`❌ Error guardando log: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      totalUrls: this.visitedUrls.size,
      totalCategories: this.visitedCategories.size,
      currentDepth: this.categoryPath.length,
      currentPath: this.categoryPath.join(' > '),
      topCategories: Array.from(this.visitedCategories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))
    };
  }
}

// ============================================================================
// DETECTOR DE ANOMALÍAS
// ============================================================================

class AnomalyDetector {
  constructor() {
    this.MAX_PRODUCTS_THRESHOLD = 100000;  // 100k productos es sospechoso
    this.MAX_SUBCATEGORIES_THRESHOLD = 50;  // Demasiadas subcategorías
    this.anomaliesFound = [];
  }

  /**
   * Verifica si una categoría presenta anomalías
   */
  isAnomalous(categoryData) {
    const anomalies = [];

    // Anomalía 1: Cantidad masiva de productos
    if (categoryData.expected_products && categoryData.expected_products > this.MAX_PRODUCTS_THRESHOLD) {
      anomalies.push({
        type: 'MASSIVE_PRODUCTS',
        value: categoryData.expected_products,
        threshold: this.MAX_PRODUCTS_THRESHOLD
      });
      console.log(`⚠️ ANOMALÍA: ${categoryData.name} tiene ${categoryData.expected_products} productos (>${this.MAX_PRODUCTS_THRESHOLD})`);
    }

    // Anomalía 2: Demasiadas subcategorías
    if (categoryData.subcategories && categoryData.subcategories.length > this.MAX_SUBCATEGORIES_THRESHOLD) {
      anomalies.push({
        type: 'TOO_MANY_SUBCATEGORIES',
        value: categoryData.subcategories.length,
        threshold: this.MAX_SUBCATEGORIES_THRESHOLD
      });
      console.log(`⚠️ ANOMALÍA: ${categoryData.name} tiene ${categoryData.subcategories.length} subcategorías (>${this.MAX_SUBCATEGORIES_THRESHOLD})`);
    }

    // Anomalía 3: Profundidad excesiva sin convergencia
    if (categoryData.depth > 7 && categoryData.subcategories && categoryData.subcategories.length > 0) {
      anomalies.push({
        type: 'EXCESSIVE_DEPTH',
        value: categoryData.depth
      });
      console.log(`⚠️ ANOMALÍA: ${categoryData.name} en profundidad ${categoryData.depth} aún tiene subcategorías`);
    }

    if (anomalies.length > 0) {
      this.anomaliesFound.push({
        timestamp: new Date().toISOString(),
        category: categoryData.name,
        anomalies: anomalies
      });
      return true;
    }

    return false;
  }

  /**
   * Guardar reporte de anomalías
   */
  saveReport(filepath) {
    if (this.anomaliesFound.length === 0) return;

    try {
      const report = {
        timestamp: new Date().toISOString(),
        totalAnomalies: this.anomaliesFound.length,
        anomalies: this.anomaliesFound
      };
      fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      console.log(`⚠️ Reporte de anomalías guardado: ${filepath}`);
    } catch (error) {
      console.error(`❌ Error guardando reporte: ${error.message}`);
    }
  }
}

// ============================================================================
// CONFIGURACIÓN Y ARGUMENTOS
// ============================================================================

// Obtener SELLER_ID como argumento obligatorio y PROXY opcional
if (process.argv.length < 3) {
  console.log('❌ Uso: node plan-batches-firefox.js SELLER_ID [PROXY_URL]');
  console.log('📋 Ejemplo: node plan-batches-firefox.js A3Q5ASRA7J8Y5E');
  console.log('📋 Con proxy: node plan-batches-firefox.js A3Q5ASRA7J8Y5E http://user:pass@proxy:port');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const PROXY_URL = process.argv[3] || null; // Opcional
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const COOKIES_FILE_OLD = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const COOKIES_FILE_FIREFOX = path.join(__dirname, 'scripts', 'auth', 'amazonmx-firefox.json');

// Pool de User-Agents para rotación (Firefox reales en Windows)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0'
];

// Seleccionar user-agent aleatorio
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Archivos y directorios
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');
const SKIP_CATEGORIES_FILE = path.join(VENDOR_DIR, 'skip-categories.json');
const CHECKPOINT_FILE = path.join(VENDOR_DIR, 'checkpoint.json');
const VISIT_LOG_FILE = path.join(VENDOR_DIR, 'visit-log.json');
const ANOMALIES_FILE = path.join(VENDOR_DIR, 'anomalies.json');

// Configuración para análisis recursivo
const MAX_PRODUCTS_PER_CATEGORY = 320; // Límite de Amazon
const MAX_RECURSION_DEPTH = 8; // Reducido de 10 a 8 para mayor seguridad
const MAX_PRODUCTS_PER_BATCH = 1000; // Máximo productos por lote/plan
const NAVIGATION_TIMEOUT = 45000; // 45 segundos para navegación
const SCRAPE_TIMEOUT = 30000; // 30 segundos para scraping

// Filtros para evitar elementos no deseados
const FILTER_PATTERNS = [
  /^\$[\d,.]+ a \$[\d,.]+$/,
  /^\$[\d,.]+ y más$/,
  /^Hasta \$[\d,.]+$/,
  /^\d+ Stars?\s*o más$/i,
  /^Planes de Pago/i,
  /^Amazon (Estados Unidos|Europa|México)$/i,
  /^\w+ SHOP$/i,
  /^\d+$/,
  /^Siguiente$/i,
  /^Anterior$/i,
  /^Incluir no Disponibles$/i,
  /^[A-Z\s]+ [A-Z]{2,}$/
];

// Crear carpeta del vendedor si no existe
if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  console.log(`📁 Carpeta creada para vendedor: ${VENDOR_DIR}`);
}

/**
 * Verifica si una categoría es válida (no es filtro ni loop)
 */
function isValidCategory(name, currentPath = [], mainCategories = new Set()) {
  if (!name || name.trim().length === 0) return false;
  const cleanName = name.trim();
  if (mainCategories.size > 0 && mainCategories.has(cleanName)) return false;
  if (currentPath.includes(cleanName)) return false;
  for (const pattern of FILTER_PATTERNS) {
    if (pattern.test(cleanName)) return false;
  }
  return true;
}

/**
 * Extrae el conteo de productos de la página actual
 */
async function extractProductCount(page, categoryName) {
  try {
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      '.s-desktop-width-max .a-section h1',
      '[data-component-type="s-search-result"] h2',
      '.s-size-small.s-color-secondary'
    ];
    for (const selector of selectors) {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const text = await element.textContent();
        if (text && text.includes('resultado')) {
          const patterns = [
            /1-\d+\s+de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
            /(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
            /más de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i
          ];
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              const count = parseInt(match[1].replace(/,/g, ''));
              return count;
            }
          }
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extrae subcategorías de la página actual
 */
async function extractSubcategories(page, currentPath = [], mainCategories = new Set()) {
  try {
    const subcategories = await page.evaluate((sellerId) => {
      const results = [];
      const selectors = [
        'div[data-cy="nav-subnav"] a',
        '#s-refinements a[href*="rh=n"]',
        '.s-navigation-item a[href*="rh=n"]', 
        '#leftNav a[href*="rh=n"]'
      ];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const href = element.getAttribute('href');
          const text = element.textContent?.trim();
          if (href && text && href.includes(sellerId)) {
            const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
            results.push({ name: text, url: fullUrl });
          }
        }
      }
      return results;
    }, SELLER_ID);
    const validSubcategories = [];
    for (const subcat of subcategories) {
      if (isValidCategory(subcat.name, currentPath, mainCategories)) {
        validSubcategories.push(subcat);
      }
    }
    return { valid: validSubcategories.slice(0, 15), stats: { total: subcategories.length } };
  } catch (error) {
    return { valid: [], stats: { total: 0 } };
  }
}

/**
 * Análisis recursivo con protecciones anti-loop mejoradas
 */
async function analyzeRecursively(page, category, mainCategories, depth = 1, currentPath = [], tracker, anomalyDetector) {
  const indent = '  '.repeat(depth);
  
  // Protección 1: Límite de profundidad
  if (depth > MAX_RECURSION_DEPTH) {
    console.log(`${indent}🛑 Profundidad máxima alcanzada (${MAX_RECURSION_DEPTH})`);
    return null;
  }

  // Protección 2: Verificar con el tracker si debemos visitar
  if (!tracker.shouldVisitCategory(category.url, category.name)) {
    console.log(`${indent}⏭️ Categoría omitida por el tracker`);
    return null;
  }

  try {
    // Marcar como visitada ANTES de procesar (crucial para evitar re-entrada)
    tracker.markAsVisited(category.url, category.name);
    tracker.enterCategory(category.name);

    const newPath = [...currentPath, category.name];
    console.log(`${indent}📂 [${depth}] ${category.name}`);

    // Navegar con timeout
    try {
      await Promise.race([
        page.goto(category.url, { waitUntil: 'domcontentloaded' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), NAVIGATION_TIMEOUT))
      ]);
    } catch (navError) {
      console.log(`${indent}❌ Timeout navegando a: ${category.name}`);
      return {
        name: category.name,
        url: category.url,
        expected_products: null,
        isLeaf: true,
        depth: depth,
        path: newPath,
        status: 'navigation_timeout',
        created_at: new Date().toISOString()
      };
    }

    await page.waitForTimeout(2000);

    // Extraer información con timeout
    let productCount, subcategoriesData;
    try {
      [productCount, subcategoriesData] = await Promise.race([
        Promise.all([
          extractProductCount(page, category.name),
          extractSubcategories(page, newPath, mainCategories)
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Scrape timeout')), SCRAPE_TIMEOUT))
      ]);
    } catch (scrapeError) {
      console.log(`${indent}❌ Timeout extrayendo datos de: ${category.name}`);
      return {
        name: category.name,
        url: category.url,
        expected_products: null,
        isLeaf: true,
        depth: depth,
        path: newPath,
        status: 'scrape_timeout',
        created_at: new Date().toISOString()
      };
    }

    const subcategories = subcategoriesData.valid;
    const hasSubcategories = subcategories.length > 0;

    console.log(`${indent}📊 Productos: ${productCount || 'N/A'} | Subcategorías: ${subcategories.length}`);

    // Crear objeto de categoría
    const categoryData = {
      name: category.name,
      url: category.url,
      expected_products: productCount,
      isLeaf: !hasSubcategories || (productCount && productCount <= MAX_PRODUCTS_PER_CATEGORY),
      depth: depth,
      path: newPath,
      status: 'success',
      created_at: new Date().toISOString()
    };

    // Protección 3: Detectar anomalías
    if (anomalyDetector.isAnomalous(categoryData)) {
      console.log(`${indent}⚠️ Categoría anómala detectada, limitando exploración`);
      categoryData.anomaly_detected = true;
      categoryData.isLeaf = true; // Forzar como hoja para no explorar subcategorías
      return categoryData;
    }

    // Si es hoja, retornar
    if (categoryData.isLeaf) {
      console.log(`${indent}🍃 Hoja: ${productCount || 'N/A'} productos`);
      return categoryData;
    }

    // Explorar subcategorías recursivamente
    categoryData.subcategories = [];
    console.log(`${indent}↓ Explorando ${subcategories.length} subcategorías...`);

    for (let i = 0; i < subcategories.length; i++) {
      const subcat = subcategories[i];
      console.log(`${indent}├─ ${i + 1}/${subcategories.length}: ${subcat.name}`);

      const subAnalysis = await analyzeRecursively(
        page,
        subcat,
        mainCategories,
        depth + 1,
        newPath,
        tracker,
        anomalyDetector
      );

      if (subAnalysis) {
        categoryData.subcategories.push(subAnalysis);
      }

      // Guardar checkpoint cada 5 subcategorías
      if ((i + 1) % 5 === 0) {
        tracker.saveCheckpoint();
      }
    }

    // Si no se pudo analizar ninguna subcategoría, convertir en hoja
    if (categoryData.subcategories.length === 0 && hasSubcategories) {
      console.log(`${indent}⚠️ No se pudieron analizar subcategorías, convirtiendo en hoja`);
      categoryData.isLeaf = true;
      delete categoryData.subcategories;
    }

    return categoryData;

  } catch (error) {
    console.error(`${indent}❌ Error en ${category.name}: ${error.message}`);
    return {
      name: category.name,
      url: category.url,
      expected_products: null,
      isLeaf: true,
      depth: depth,
      path: [...currentPath, category.name],
      status: 'error',
      error: error.message,
      created_at: new Date().toISOString()
    };
  } finally {
    // Siempre salir de la categoría al terminar
    tracker.exitCategory();
  }
}

/**
 * Función para guardar un lote
 */
function saveBatch(batchNumber, categories, mainCategories) {
  const batchData = {
    batch_number: batchNumber,
    seller_id: SELLER_ID,
    created_at: new Date().toISOString(),
    main_categories: Array.from(mainCategories),
    categories: categories,
    stats: {
      total_categories: categories.length,
      total_products: categories.reduce((sum, cat) => sum + countCategoryProducts(cat), 0),
      leaf_categories: categories.filter(cat => cat.isLeaf).length,
      branch_categories: categories.filter(cat => !cat.isLeaf).length
    }
  };

  const batchFile = path.join(VENDOR_DIR, `batch-${String(batchNumber).padStart(3, '0')}.json`);
  fs.writeFileSync(batchFile, JSON.stringify(batchData, null, 2));
  console.log(`💾 Lote ${batchNumber} guardado: ${batchFile}`);
  console.log(`   Categorías: ${batchData.stats.total_categories}`);
  console.log(`   Productos esperados: ${batchData.stats.total_products}`);
  
  return batchData;
}

/**
 * Función para contar productos en una categoría (recursiva)
 */
function countCategoryProducts(category) {
  if (category.isLeaf) {
    return category.expected_products || 0;
  } else if (category.subcategories && Array.isArray(category.subcategories)) {
    return category.subcategories.reduce((sum, sub) => sum + countCategoryProducts(sub), 0);
  }
  return 0;
}

/**
 * Función para actualizar el archivo projects.json
 */
function updateProjectsFile(batchNumber, batchData) {
  let projects = {};
  if (fs.existsSync(PROJECTS_FILE)) {
    projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  }

  if (!projects[SELLER_ID]) {
    projects[SELLER_ID] = {
      seller_id: SELLER_ID,
      created_at: new Date().toISOString(),
      batches: {}
    };
  }

  projects[SELLER_ID].batches[batchNumber] = {
    file: `batch-${String(batchNumber).padStart(3, '0')}.json`,
    created_at: batchData.created_at,
    categories_count: batchData.stats.total_categories,
    expected_products: batchData.stats.total_products,
    status: 'pending'
  };

  projects[SELLER_ID].updated_at = new Date().toISOString();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

/**
 * Función para obtener el último batch procesado
 */
function getLastBatchNumber() {
  const files = fs.readdirSync(VENDOR_DIR)
    .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
    .map(f => parseInt(f.match(/batch-(\d+)\.json/)?.[1] || '0'))
    .filter(n => !isNaN(n));
  
  return files.length > 0 ? Math.max(...files) : 0;
}

/**
 * Función para obtener categorías ya procesadas
 */
function getProcessedCategories() {
  const categories = new Set();
  const files = fs.readdirSync(VENDOR_DIR)
    .filter(f => f.startsWith('batch-') && f.endsWith('.json'));

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(VENDOR_DIR, file), 'utf8'));
      if (data.categories && Array.isArray(data.categories)) {
        data.categories.forEach(cat => categories.add(cat.name));
      }
    } catch (e) {
      // Ignorar archivos corruptos
    }
  }

  return Array.from(categories);
}

/**
 * Función principal para crear planes en lotes
 */
async function createBatchedPlans() {
  console.log('\n🚀 === AMAZON VENDOR CATEGORY PLAN CREATOR (FIREFOX + ANTI-LOOP) ===');
  console.log(`📦 Vendedor: ${SELLER_ID}`);
  console.log(`🌐 Marketplace: ${MARKETPLACE_ID}`);
  console.log(`📁 Directorio: ${VENDOR_DIR}`);
  console.log(`🔒 Usando: ${usingPlaywrightExtra ? 'playwright-extra + stealth' : 'playwright estándar'}`);
  if (PROXY_URL) console.log(`🌐 Proxy: ${PROXY_URL}`);

  // Inicializar tracker y detector de anomalías
  const tracker = new CategoryTracker(CHECKPOINT_FILE);
  const anomalyDetector = new AnomalyDetector();

  // Intentar cargar checkpoint previo
  const checkpointLoaded = tracker.loadCheckpoint();
  if (checkpointLoaded) {
    console.log('✅ Continuando desde checkpoint anterior');
  }

  const lastBatch = getLastBatchNumber();
  const processedCategories = getProcessedCategories();
  console.log(`📊 Último batch: ${lastBatch}`);
  console.log(`📝 Categorías ya procesadas: ${processedCategories.length}`);

  // Configurar opciones del browser
  const launchOptions = {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  };

  if (PROXY_URL) {
    launchOptions.proxy = { server: PROXY_URL };
  }

  const browser = await browserLauncher.launch(launchOptions);

  try {
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City'
    });

    // Cargar cookies si existen
    if (fs.existsSync(COOKIES_FILE_FIREFOX)) {
      const storageState = JSON.parse(fs.readFileSync(COOKIES_FILE_FIREFOX, 'utf8'));
      await context.addCookies(storageState.cookies || []);
      console.log('🍪 Cookies de Firefox cargadas');
    } else if (fs.existsSync(COOKIES_FILE_OLD)) {
      const oldCookies = JSON.parse(fs.readFileSync(COOKIES_FILE_OLD, 'utf8'));
      await context.addCookies(oldCookies);
      console.log('🍪 Cookies antiguas cargadas');
    }

    const page = await context.newPage();
    console.log(`\n🌐 Navegando a: ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Esperar elementos clave
    try {
      await page.waitForSelector([
        '[data-component-type="s-search-result"]',
        '.s-result-item',
        '#s-refinements'
      ].join(','), { timeout: 10000 });
      console.log('✅ Elementos clave detectados');
    } catch (e) {
      console.log('⚠️ Elementos clave no detectados, continuando...');
    }

    await page.waitForTimeout(2000);

    // Extraer categorías principales
    console.log('\n📂 Extrayendo categorías principales...');
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]',
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]'
    ];

    let categories = [];
    for (const selector of categorySelectors) {
      const elements = await page.$$(selector);
      for (const element of elements) {
        try {
          const href = await element.getAttribute('href');
          const text = await element.textContent();
          const trimmedText = text ? text.trim() : '';
          
          if (href && trimmedText && href.includes('rh=n')) {
            let fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
            if (!fullUrl.includes(SELLER_ID)) {
              const separator = fullUrl.includes('?') ? '&' : '?';
              fullUrl = `${fullUrl}${separator}me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
            }
            categories.push({ name: trimmedText, url: fullUrl });
          }
        } catch (e) {
          // Ignorar elementos problemáticos
        }
      }
      if (categories.length > 0) break;
    }

    const uniqueCategories = categories.filter((cat, index, self) => 
      index === self.findIndex(c => c.name === cat.name)
    );
    const validCategories = uniqueCategories.filter(cat => isValidCategory(cat.name));
    
    console.log(`✅ Encontradas ${validCategories.length} categorías principales`);

    // Cargar categorías a saltar
    let skipCategories = [];
    if (fs.existsSync(SKIP_CATEGORIES_FILE)) {
      skipCategories = JSON.parse(fs.readFileSync(SKIP_CATEGORIES_FILE, 'utf8'));
      if (skipCategories.length > 0) {
        console.log(`\n⏭️ Categorías marcadas para saltar: ${skipCategories.length}`);
      }
    }

    const skipCategoryNames = new Set(skipCategories.map(c => c.name));
    const mainCategories = new Set(validCategories.map(cat => cat.name));

    console.log('\n🧠 === ANÁLISIS RECURSIVO POR LOTES (CON PROTECCIÓN ANTI-LOOP) ===');
    console.log(`📊 Límite por categoría hoja: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
    console.log(`📦 Límite por lote: ${MAX_PRODUCTS_PER_BATCH} productos`);
    console.log(`🔄 Profundidad máxima: ${MAX_RECURSION_DEPTH} niveles`);
    console.log(`🛡️ Sistema anti-loop: ACTIVADO`);
    console.log(`💾 Checkpoints: ACTIVADOS (cada 5 subcategorías)`);

    let currentBatch = [];
    let currentBatchProducts = 0;
    let batchNumber = lastBatch + 1;
    let totalBatchesSaved = 0;

    // Procesar cada categoría principal
    for (let i = 0; i < validCategories.length; i++) {
      const category = validCategories[i];

      // Saltar si ya fue procesada
      if (processedCategories.includes(category.name)) {
        console.log(`\n⏭️ SALTANDO ${i + 1}/${validCategories.length}: ${category.name} (ya procesada)`);
        continue;
      }

      // Saltar si está en la lista de skip
      if (skipCategoryNames.has(category.name)) {
        const skipInfo = skipCategories.find(c => c.name === category.name);
        console.log(`\n🚫 SALTANDO ${i + 1}/${validCategories.length}: ${category.name}`);
        console.log(`   Razón: ${skipInfo.reason}`);
        continue;
      }

      console.log(`\n🎯 === ANALIZANDO CATEGORÍA ${i + 1}/${validCategories.length}: ${category.name} ===`);
      
      // Mostrar estadísticas del tracker
      const stats = tracker.getStats();
      console.log(`📊 Tracker: ${stats.totalUrls} URLs visitadas, profundidad actual: ${stats.currentDepth}`);

      // Análisis recursivo con todas las protecciones
      const analysis = await analyzeRecursively(
        page,
        category,
        mainCategories,
        1,
        [],
        tracker,
        anomalyDetector
      );

      let categoryData;
      if (analysis) {
        console.log(`✅ ${category.name} analizada exitosamente`);
        categoryData = analysis;
      } else {
        console.log(`❌ ${category.name} fue omitida por el tracker`);
        continue; // Saltar esta categoría
      }

      // Calcular productos y verificar si hay que crear nuevo batch
      const categoryProducts = countCategoryProducts(categoryData);
      
      if (currentBatchProducts + categoryProducts > MAX_PRODUCTS_PER_BATCH && currentBatch.length > 0) {
        console.log(`\n📦 Lote ${batchNumber} alcanzó ${currentBatchProducts} productos`);
        const batchData = saveBatch(batchNumber, currentBatch, mainCategories);
        updateProjectsFile(batchNumber, batchData);
        totalBatchesSaved++;
        batchNumber++;
        currentBatch = [];
        currentBatchProducts = 0;
      }

      currentBatch.push(categoryData);
      currentBatchProducts += categoryProducts;
      console.log(`📊 Lote actual: ${currentBatch.length} categoría(s), ${currentBatchProducts} productos`);

      // Guardar checkpoint después de cada categoría principal
      tracker.saveCheckpoint();
    }

    // Guardar último batch si tiene contenido
    if (currentBatch.length > 0) {
      console.log(`\n📦 Guardando último lote ${batchNumber}`);
      const batchData = saveBatch(batchNumber, currentBatch, mainCategories);
      updateProjectsFile(batchNumber, batchData);
      totalBatchesSaved++;
    }

    // Guardar logs finales
    tracker.saveVisitLog(VISIT_LOG_FILE);
    anomalyDetector.saveReport(ANOMALIES_FILE);

    // Resumen final
    console.log('\n🎉 === PLANIFICACIÓN COMPLETA ===');
    console.log(`✅ Total de lotes creados: ${totalBatchesSaved}`);
    console.log(`📂 Batch inicial: ${lastBatch + 1}`);
    console.log(`📂 Batch final: ${batchNumber}`);
    console.log(`🔗 URLs visitadas: ${tracker.visitedUrls.size}`);
    console.log(`📁 Categorías únicas: ${tracker.visitedCategories.size}`);
    console.log(`⚠️ Anomalías detectadas: ${anomalyDetector.anomaliesFound.length}`);
    console.log(`💾 Archivos guardados en: ${path.relative(__dirname, VENDOR_DIR)}`);
    
    // Mostrar top categorías más visitadas
    const stats = tracker.getStats();
    if (stats.topCategories.length > 0) {
      console.log('\n📊 Top categorías más visitadas:');
      stats.topCategories.forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat.name}: ${cat.count} veces`);
      });
    }

    console.log(`\n🚀 Siguiente paso:`);
    console.log(`   node process-all-categories.js ${SELLER_ID}`);

  } catch (error) {
    console.error('❌ Error creando planes:', error.message);
    console.error(error.stack);
    
    // Guardar estado en caso de error
    tracker.saveCheckpoint();
    tracker.saveVisitLog(VISIT_LOG_FILE);
    anomalyDetector.saveReport(ANOMALIES_FILE);
    
  } finally {
    await browser.close();
  }
}

// Ejecutar
if (require.main === module) {
  createBatchedPlans().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { createBatchedPlans };