/**
 * plan-batches-firefox.js
 *
 * Copia de create-plan-batches.js adaptada para usar Firefox + storageState
 * Guardado de cookies en: scripts/auth/amazonmx-firefox.json (storageState)
 * Intenta usar playwright-extra + stealth si está disponible, con fallback a playwright
 */

// ═══════════════════════════════════════════════════════════════
console.log('\n🎬 EJECUTANDO: plan-batches-firefox-fixed.js (VERSIÓN FIREFOX FIXED)');
console.log('═══════════════════════════════════════════════════════════════\n');
// ═══════════════════════════════════════════════════════════════

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
// CLASES ANTI-LOOP - MEJORADA (Registro estricto de nombres y IDs)
// ============================================================================

class CategoryTracker {
  constructor() {
    this.visitedUrls = new Set();
    this.normalizedUrls = new Set();
    // CAMBIO PRINCIPAL: Usamos un Set para nombres globales. 
    // Una vez visitado un nombre, no se vuelve a entrar nunca.
    this.visitedNames = new Set(); 
    this.categoryPath = [];
  }

  normalizeAmazonUrl(url) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      // El parámetro 'rh' contiene los IDs de nodos (n:xxxx). Es la huella digital real de la categoría.
      const rh = params.get('rh') || '';
      // Si logramos extraer el rh, esa es nuestra mejor comparación, si no, usamos la url completa
      return rh ? rh.toLowerCase() : url;
    } catch (e) {
      return url;
    }
  }

  shouldVisitCategory(url, categoryName) {
    // Limpiamos el nombre para asegurar comparaciones exactas
    const cleanName = categoryName.trim();

    // 1. Check: ¿Ya visitamos este nombre EXACTO antes en cualquier parte del árbol?
    if (this.visitedNames.has(cleanName)) {
      console.log(`🔄 Loop evitado por Nombre: "${cleanName}" ya fue procesada anteriormente.`);
      return false;
    }

    // 2. Check: ¿La URL exacta ya fue visitada?
    if (this.visitedUrls.has(url)) {
      console.log(`⚠️ URL ya visitada: ${cleanName}`);
      return false;
    }

    // 3. Check: ¿La "huella" de la categoría (parametro rh) ya fue visitada?
    // Esto previene entrar a la misma categoría aunque la URL sea distinta
    const normalized = this.normalizeAmazonUrl(url);
    if (this.normalizedUrls.has(normalized)) {
      console.log(`⚠️ Categoría (ID/RH) ya visitada: ${cleanName}`);
      return false;
    }

    // 4. Check: Loop recursivo inmediato (Padre > Hijo > Padre)
    if (this.categoryPath.includes(cleanName)) {
      console.log(`🔄 Loop jerárquico detectado: "${cleanName}" está en el path actual: ${this.categoryPath.join(' > ')}`);
      return false;
    }

    return true;
  }

  markAsVisited(url, categoryName) {
    const cleanName = categoryName.trim();
    this.visitedUrls.add(url);
    this.normalizedUrls.add(this.normalizeAmazonUrl(url));
    // Registramos el nombre para bloqueo global futuro
    this.visitedNames.add(cleanName);
  }

  enterCategory(name) {
    this.categoryPath.push(name.trim());
  }

  exitCategory() {
    this.categoryPath.pop();
  }
}

class AnomalyDetector {
  isAnomalous(productCount, subcategoriesCount, depth, categoryName) {
    if (productCount && productCount > 100000) {
      console.log(`⚠️ ANOMALÍA: ${categoryName} tiene ${productCount} productos (>100k)`);
      return true;
    }
    if (subcategoriesCount > 50) {
      console.log(`⚠️ ANOMALÍA: ${categoryName} tiene ${subcategoriesCount} subcategorías (>50)`);
      return true;
    }
    if (depth > 7 && subcategoriesCount > 0) {
      console.log(`⚠️ ANOMALÍA: ${categoryName} profundidad ${depth} con subcategorías`);
      return true;
    }
    return false;
  }
}

const globalTracker = new CategoryTracker();
const globalAnomalyDetector = new AnomalyDetector();

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

// Configuración para análisis recursivo
const MAX_PRODUCTS_PER_CATEGORY = 320; // Límite de Amazon
const MAX_RECURSION_DEPTH = 10; // Límite de seguridad anti-loops infinitos
const MAX_PRODUCTS_PER_BATCH = 1000; // Máximo productos por lote/plan

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
 * Analiza una categoría recursivamente (CORREGIDA CON LOGS Y ANTI-LOOP)
 */
async function analyzeRecursively(page, category, mainCategories, depth = 1, path = []) {
  // 1. LOG DE PROGRESO (Para que sepas que sigue vivo)
  const indent = ' '.repeat(depth * 2);
  console.log(`${indent}🔍 [Nivel ${depth}] Analizando: "${category.name}"`);

  // 2. CHECK ANTI-LOOP (Integración del Tracker Global)
  // Usamos globalTracker que ya definiste al inicio del archivo
  if (!globalTracker.shouldVisitCategory(category.url, category.name)) {
      console.log(`${indent}🚫 Saltando repetido/loop: "${category.name}"`);
      return null;
  }
  
  // Marcamos como visitado
  globalTracker.markAsVisited(category.url, category.name);
  globalTracker.enterCategory(category.name);

  // 3. CHECK PROFUNDIDAD
  if (depth > MAX_RECURSION_DEPTH) {
      console.log(`${indent}🛑 Profundidad máxima alcanzada en: "${category.name}"`);
      globalTracker.exitCategory();
      return null;
  }

  try {
    // Navegación
    await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Pequeña espera aleatoria para no saturar
    await page.waitForTimeout(1000); 

    const productCount = await extractProductCount(page, category.name);
    
    // Log del conteo encontrado
    if (productCount !== null) {
        console.log(`${indent}   🔢 Productos: ${productCount}`);
    } else {
        console.log(`${indent}   ⚠️ No se pudo leer conteo en: "${category.name}"`);
        globalTracker.exitCategory();
        return null;
    }

    // A. ES UNA HOJA (LEAF)
    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
      console.log(`${indent}   🍃 Es HOJA (Leaf). Agregando.`);
      globalTracker.exitCategory();
      return {
        name: category.name,
        url: category.url,
        expected_products: productCount,
        isLeaf: true,
        depth: depth,
        path: [...path, category.name],
        status: 'pending',
        created_at: new Date().toISOString()
      };
    }

    // B. BUSCAR SUBCATEGORÍAS
    const subcatResult = await extractSubcategories(page, [...path, category.name], mainCategories);
    
    if (subcatResult.valid.length === 0) {
      console.log(`${indent}   🍂 Sin subcategorías válidas. Guardando como hoja forzada.`);
      globalTracker.exitCategory();
      return {
        name: category.name,
        url: category.url,
        expected_products: productCount,
        isLeaf: true,
        depth: depth,
        path: [...path, category.name],
        status: 'pending',
        created_at: new Date().toISOString(),
        note: 'No subcategories found - saved as leaf'
      };
    }

    console.log(`${indent}   🔀 Encontradas ${subcatResult.valid.length} subcategorías. Profundizando...`);
    const subcategoriesAnalysis = [];
    
    for (const subcat of subcatResult.valid) {
      // Llamada recursiva
      const analysis = await analyzeRecursively(page, subcat, mainCategories, depth + 1, [...path, category.name]);
      if (analysis) subcategoriesAnalysis.push(analysis);
    }

    globalTracker.exitCategory();
    return {
      name: category.name,
      url: category.url,
      expected_products: productCount,
      isLeaf: false,
      depth: depth,
      path: [...path, category.name],
      status: 'pending',
      subcategories: subcategoriesAnalysis,
      created_at: new Date().toISOString()
    };

  } catch (error) {
    console.log(`${indent}❌ Error analizando "${category.name}": ${error.message}`);
    globalTracker.exitCategory();
    return null;
  }
}

/**
 * Detecta batches ya creados y última categoría procesada
 */
function detectExistingBatches() {
  if (!fs.existsSync(VENDOR_DIR)) return { lastBatch: 0, processedCategories: [] };
  const files = fs.readdirSync(VENDOR_DIR);
  const batchFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}-plan-batch-\d+\.json$/));
  if (batchFiles.length === 0) return { lastBatch: 0, processedCategories: [] };
  batchFiles.sort((a, b) => {
    const numA = parseInt(a.match(/batch-(\d+)\.json$/)[1]);
    const numB = parseInt(b.match(/batch-(\d+)\.json$/)[1]);
    return numA - numB;
  });
  const lastBatchFile = batchFiles[batchFiles.length - 1];
  const lastBatchNum = parseInt(lastBatchFile.match(/batch-(\d+)\.json$/)[1]);
  console.log(`✅ Detectados ${batchFiles.length} batch(es) existente(s)`);
  const processedCategories = [];
  for (const batchFile of batchFiles) {
    try {
      const batchData = JSON.parse(fs.readFileSync(path.join(VENDOR_DIR, batchFile), 'utf8'));
      if (batchData.categories && Array.isArray(batchData.categories)) {
        batchData.categories.forEach(cat => { if (cat.name) processedCategories.push(cat.name); });
      }
    } catch (error) {
      console.log(`⚠️  Error leyendo ${batchFile}`);
    }
  }
  console.log(`📂 Categorías ya procesadas: ${processedCategories.length}`);
  return { lastBatch: lastBatchNum, processedCategories };
}

/**
 * Guarda un batch de categorías como plan
 */
function saveBatch(batchNumber, categories, mainCategories) {
  const plan = {
    seller_id: SELLER_ID,
    batch_number: batchNumber,
    created_at: new Date().toISOString(),
    analysis_type: 'recursive_hierarchical_batch',
    max_products_per_leaf: MAX_PRODUCTS_PER_CATEGORY,
    max_recursion_depth: MAX_RECURSION_DEPTH,
    max_products_per_batch: MAX_PRODUCTS_PER_BATCH,
    main_categories: Array.from(mainCategories),
    categories: categories
  };
  const batchFile = path.join(VENDOR_DIR, `${dateStr}-plan-batch-${batchNumber}.json`);
  fs.writeFileSync(batchFile, JSON.stringify(plan, null, 2));
  function countProducts(cats) {
    let total = 0;
    for (const cat of cats) {
      if (cat.isLeaf) total += cat.expected_products || 0;
      else if (cat.subcategories) total += countProducts(cat.subcategories);
    }
    return total;
  }
  const totalProducts = countProducts(categories);
  console.log(`\n💾 === BATCH ${batchNumber} GUARDADO ===`);
  console.log(`📦 Categorías: ${categories.length}`);
  console.log(`📊 Productos estimados: ${totalProducts}`);
  console.log(`📁 Archivo: ${path.basename(batchFile)}`);
  return { batchFile, totalProducts, categories: categories.map(c => c.name) };
}

/**
 * Actualiza projects.json con el progreso del batch
 */
function updateProjectsFile(batchNumber, batchData) {
  let projectsData = { projects: {}, last_updated: new Date().toISOString() };
  if (fs.existsSync(PROJECTS_FILE)) {
    try { projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); } catch (error) { console.log('⚠️  Error leyendo projects.json'); }
  }
  if (!projectsData.projects) projectsData.projects = {};
  if (!projectsData.projects[SELLER_ID]) projectsData.projects[SELLER_ID] = {};
  const project = projectsData.projects[SELLER_ID];
  if (!project.batches) project.batches = [];
  const existingBatchIndex = project.batches.findIndex(b => b.batch === batchNumber);
  const batchInfo = {
    batch: batchNumber,
    status: 'plan_created',
    products: batchData.totalProducts,
    categories: batchData.categories,
    created_at: new Date().toISOString()
  };
  if (existingBatchIndex >= 0) project.batches[existingBatchIndex] = batchInfo; else project.batches.push(batchInfo);
  project.plan_created = true;
  project.plan_date = new Date().toISOString();
  project.last_updated = new Date().toISOString();
  project.status = 'planned';
  projectsData.last_updated = new Date().toISOString();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
}

/**
 * Carga las cookies de autenticación
 * Devuelve { type: 'storageState', path } o { type: 'cookies', cookies }
 */
function loadCookies() {
  try {
    // Preferir storageState de Firefox si existe
    if (fs.existsSync(COOKIES_FILE_FIREFOX)) {
      console.log('🔁 Usando storageState de Firefox:', COOKIES_FILE_FIREFOX);
      return { type: 'storageState', path: COOKIES_FILE_FIREFOX };
    }
    // Fallback al formato antiguo (cookies array)
    if (!fs.existsSync(COOKIES_FILE_OLD)) {
      console.error('❌ Archivo de cookies no encontrado:', COOKIES_FILE_OLD);
      console.log('🔑 Ejecuta primero: node scripts/a-login.js o node scripts/save-amazon-cookies-firefox.js');
      return null;
    }
    const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE_OLD, 'utf8'));
    if (!cookieData.cookies || !Array.isArray(cookieData.cookies)) {
      console.error('❌ Formato de cookies inválido en archivo antiguo');
      return null;
    }
    console.log(`✅ Cookies cargadas (antiguo formato): ${cookieData.cookies.length}`);
    return { type: 'cookies', cookies: cookieData.cookies };
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Crea planes por lotes para el vendedor
 */
async function createBatchedPlans() {
  console.log('📋 === CREADOR DE PLANES POR LOTES (Firefox) ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`📦 Límite por lote: ${MAX_PRODUCTS_PER_BATCH} productos`);
  const { lastBatch, processedCategories } = detectExistingBatches();
  if (lastBatch > 0) {
    console.log(`\n♻️  REANUDANDO desde batch ${lastBatch + 1}`);
    console.log(`⏭️  Saltando ${processedCategories.length} categorías ya procesadas`);
  }
  const auth = loadCookies();
  if (!auth) return;

  console.log('\n🚀 Iniciando navegador Firefox...');
  if (PROXY_URL) {
    console.log(`🌐 Usando proxy: ${PROXY_URL}`);
  }
  
  const launchOptions = { headless: false };
  if (PROXY_URL) {
    launchOptions.proxy = { server: PROXY_URL };
  }
  
  const browser = await browserLauncher.launch(launchOptions);

  const selectedUserAgent = getRandomUserAgent();
  console.log(`🎭 User-Agent seleccionado: ${selectedUserAgent.substring(0, 60)}...`);

  const contextOptions = {
    userAgent: selectedUserAgent,
    viewport: { width: 1920, height: 1080 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    }
  };

  if (auth.type === 'storageState') {
    contextOptions.storageState = auth.path;
  }

  const context = await browser.newContext(contextOptions);

  // Ocultar señales de automatización
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  if (auth.type === 'cookies') {
    await context.addCookies(auth.cookies);
  }

  const page = await context.newPage();
  // Función robusta de navegación con reintentos y degradación de estrategia
  async function robustNavigate(url) {
    const attempts = [
      { waitUntil: 'domcontentloaded', timeout: 90000 },
      { waitUntil: 'load', timeout: 90000 },
      // networkidle se deja al final como intento opcional
      { waitUntil: 'networkidle', timeout: 60000 }
    ];
    for (let i = 0; i < attempts.length; i++) {
      const opt = attempts[i];
      console.log(`🔍 Navegando (intento ${i + 1}/${attempts.length}) → ${opt.waitUntil}`);
      try {
        await page.goto(url, opt);
        console.log(`✅ Navegación completada con waitUntil='${opt.waitUntil}'`);
        return true;
      } catch (err) {
        console.log(`⚠️ Falló intento ${i + 1} (${opt.waitUntil}): ${err.message}`);
        // Si es el último intento, devolver false
        if (i === attempts.length - 1) return false;
        console.log('↺ Reintentando con otra estrategia...');
      }
    }
    return false;
  }
  try {
    console.log('🔍 Navegando al vendedor...');
    console.log(`📍 URL: ${BASE_URL}`);
    const ok = await robustNavigate(BASE_URL);
    if (!ok) {
      throw new Error('No se pudo cargar la página del vendedor tras reintentos');
    }
    console.log('⏳ Esperando a que cargue componentes iniciales...');
    // Esperar a que aparezca algún resultado o refinements, pero con timeout corto
    try {
      await Promise.race([
        page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 }),
        page.waitForSelector('#s-refinements', { timeout: 10000 })
      ]);
      console.log('✅ Elementos clave detectados');
    } catch (e) {
      console.log('⚠️ Elementos clave no detectados en los primeros 10s, continuando...');
    }
    // Pausa ligera adicional para estabilizar
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log(`📍 URL actual después de cargar: ${currentUrl}`);
    const screenshotPath = path.join(VENDOR_DIR, 'debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Screenshot guardado en: ${screenshotPath}`);
    const sidebarInfo = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a[href]');
      const linksWithRh = Array.from(allLinks).filter(a => a.href.includes('rh=n'));
      const sidebarSelectors = ['#s-refinements', '#leftNav', '[data-cy="nav-subnav"]', '.s-navigation-left'];
      let sidebarLinks = [];
      for (const selector of sidebarSelectors) {
        const sidebar = document.querySelector(selector);
        if (sidebar) {
          const links = Array.from(sidebar.querySelectorAll('a[href]'));
          sidebarLinks = links.map(a => ({
            text: a.textContent?.trim(),
            href: a.href,
            hasRh: a.href.includes('rh='),
            hasN: a.href.includes('rh=n'),
            hasI: a.href.includes('rh=i'),
            hasP: a.href.includes('rh=p')
          }));
          break;
        }
      }
      return {
        total: allLinks.length,
        withRhN: linksWithRh.length,
        rhNSamples: linksWithRh.slice(0, 5).map(a => ({ text: a.textContent?.trim(), href: a.href })),
        sidebarFound: sidebarLinks.length > 0,
        sidebarLinks: sidebarLinks.slice(0, 20)
      };
    });
    console.log(`🔗 Enlaces en la página: ${sidebarInfo.total} totales, ${sidebarInfo.withRhN} con "rh=n"`);
    if (sidebarInfo.rhNSamples.length > 0) {
      console.log('📝 Ejemplos de enlaces con rh=n:');
      sidebarInfo.rhNSamples.forEach((s, i) => { console.log(`   ${i + 1}. "${s.text}" -> ${s.href.substring(0, 100)}...`); });
    }
    if (sidebarInfo.sidebarFound) {
      console.log(`\n📂 Enlaces encontrados en el SIDEBAR (primeros 20):`);
      sidebarInfo.sidebarLinks.forEach((link, i) => {
        const flags = [];
        if (link.hasN) flags.push('rh=n');
        if (link.hasI) flags.push('rh=i');
        if (link.hasP) flags.push('rh=p');
        if (!link.hasRh) flags.push('sin rh=');
        console.log(`   ${i + 1}. "${link.text?.substring(0, 40)}" [${flags.join(', ')}]`);
        console.log(`      -> ${link.href.substring(0, 120)}...`);
      });
    } else {
      console.log('\n⚠️ NO se encontró sidebar con ninguno de los selectores conocidos');
    }
    console.log('\n📂 Extrayendo categorías principales...');
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]',
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]'
    ];
    let categories = [];
    for (const selector of categorySelectors) {
      console.log(`\n🔍 Probando selector: ${selector}`);
      const elements = await page.$$(selector);
      console.log(`   Encontrados ${elements.length} elementos con este selector`);
      for (const element of elements) {
        try {
          const href = await element.getAttribute('href');
          const text = await element.textContent();
          const trimmedText = text ? text.trim() : '';
          console.log(`   📄 Elemento: "${trimmedText}" | href: ${href ? href.substring(0, 80) + '...' : 'null'}`);
          if (href && trimmedText && href.includes('rh=n')) {
            let fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
            if (!fullUrl.includes(SELLER_ID)) {
              const separator = fullUrl.includes('?') ? '&' : '?';
              fullUrl = `${fullUrl}${separator}me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
            }
            console.log(`   ✅ Categoría válida agregada: "${trimmedText}"`);
            categories.push({ name: trimmedText, url: fullUrl });
          } else {
            console.log(`   ❌ Rechazado: href=${!!href}, text=${!!trimmedText}, tiene_rh_n=${href ? href.includes('rh=n') : false}`);
          }
        } catch (e) {
          console.log(`   ⚠️  Error procesando elemento: ${e.message}`);
        }
      }
      console.log(`\n📊 Total categorías encontradas hasta ahora: ${categories.length}`);
      if (categories.length > 0) break;
    }
    const uniqueCategories = categories.filter((cat, index, self) => index === self.findIndex(c => c.name === cat.name));
    const validCategories = uniqueCategories.filter(cat => isValidCategory(cat.name));
    console.log(`✅ Encontradas ${validCategories.length} categorías principales (${uniqueCategories.length} antes de filtrar)`);
    let skipCategories = [];
    if (fs.existsSync(SKIP_CATEGORIES_FILE)) {
      skipCategories = JSON.parse(fs.readFileSync(SKIP_CATEGORIES_FILE, 'utf8'));
      if (skipCategories.length > 0) {
        console.log(`\n⏭️  Categorías marcadas para saltar: ${skipCategories.length}`);
        skipCategories.forEach(cat => { console.log(`   - ${cat.name} (${cat.reason})`); });
      }
    }
    const skipCategoryNames = new Set(skipCategories.map(c => c.name));
    const mainCategories = new Set(validCategories.map(cat => cat.name));
    console.log('\n🧠 === ANÁLISIS RECURSIVO POR LOTES ===');
    console.log(`📊 Límite por categoría hoja: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
    console.log(`📦 Límite por lote: ${MAX_PRODUCTS_PER_BATCH} productos`);
    console.log(`🔄 Profundidad máxima: ${MAX_RECURSION_DEPTH} niveles`);
    console.log(`🛡️ Filtro anti-loops: ${mainCategories.size} categorías principales`);
    let currentBatch = [];
    let currentBatchProducts = 0;
    let batchNumber = lastBatch + 1;
    let totalBatchesSaved = 0;
    function countCategoryProducts(category) {
      if (category.isLeaf) return category.expected_products || 0;
      else if (category.subcategories && Array.isArray(category.subcategories)) return category.subcategories.reduce((sum, sub) => sum + countCategoryProducts(sub), 0);
      return 0;
    }
    for (let i = 0; i < validCategories.length; i++) {
      const category = validCategories[i];
      if (processedCategories.includes(category.name)) { console.log(`\n⏭️  SALTANDO categoría ${i + 1}/${validCategories.length}: ${category.name} (ya procesada)`); continue; }
      if (skipCategoryNames.has(category.name)) {
        const skipInfo = skipCategories.find(c => c.name === category.name);
        console.log(`\n🚫 SALTANDO categoría ${i + 1}/${validCategories.length}: ${category.name}`);
        console.log(`   Razón: ${skipInfo.reason}`);
        continue;
      }
      console.log(`\n🎯 === ANALIZANDO CATEGORÍA ${i + 1}/${validCategories.length}: ${category.name} ===`);
      const analysis = await analyzeRecursively(page, category, mainCategories, 1, []);
      let categoryData;
      if (analysis) { console.log(`✅ ${category.name} analizada exitosamente`); categoryData = analysis; }
      else { console.log(`❌ ${category.name} falló en el análisis`); categoryData = { name: category.name, url: category.url, expected_products: null, isLeaf: true, depth: 1, path: [category.name], status: 'error', error_during_creation: 'Analysis failed', created_at: new Date().toISOString() }; }
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
    }
    if (currentBatch.length > 0) {
      console.log(`\n📦 Guardando último lote ${batchNumber}`);
      const batchData = saveBatch(batchNumber, currentBatch, mainCategories);
      updateProjectsFile(batchNumber, batchData);
      totalBatchesSaved++;
    }
    console.log('\n🎉 === PLANIFICACIÓN COMPLETA ===');
    console.log(`✅ Total de lotes creados en esta sesión: ${totalBatchesSaved}`);
    console.log(`📂 Batch inicial: ${lastBatch + 1}`);
    console.log(`📂 Batch final: ${batchNumber}`);
    console.log(`💾 Archivos guardados en: ${path.relative(__dirname, VENDOR_DIR)}`);
    console.log(`\n🚀 Siguiente paso:`);
    console.log(`   node process-all-categories.js ${SELLER_ID}`);
    console.log(`   (Procesará todos los batches secuencialmente)`);
  } catch (error) {
    console.error('❌ Error creando planes:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar
if (require.main === module) {
  createBatchedPlans().catch(error => { console.error('💥 Error fatal:', error); process.exit(1); });
}

module.exports = { createBatchedPlans };
