const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Obtener SELLER_ID como argumento obligatorio
if (process.argv.length < 3) {
  console.log('❌ Uso: node create-plan-batches.js SELLER_ID');
  console.log('📋 Ejemplo: node create-plan-batches.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');

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
  
  // Evitar loops: categorías principales como subcategorías
  if (mainCategories.size > 0 && mainCategories.has(cleanName)) {
    return false;
  }
  
  // Evitar loops circulares
  if (currentPath.includes(cleanName)) {
    return false;
  }
  
  // Evitar filtros conocidos
  for (const pattern of FILTER_PATTERNS) {
    if (pattern.test(cleanName)) {
      return false;
    }
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
 * Analiza una categoría recursivamente
 */
async function analyzeRecursively(page, category, mainCategories, depth = 1, path = []) {
  if (depth > MAX_RECURSION_DEPTH) {
    return null;
  }
  
  try {
    await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const productCount = await extractProductCount(page, category.name);
    
    if (productCount === null) {
      return null;
    }
    
    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
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
    
    const subcatResult = await extractSubcategories(page, [...path, category.name], mainCategories);
    
    if (subcatResult.valid.length === 0) {
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
    
    const subcategoriesAnalysis = [];
    
    for (const subcat of subcatResult.valid) {
      const analysis = await analyzeRecursively(page, subcat, mainCategories, depth + 1, [...path, category.name]);
      if (analysis) {
        subcategoriesAnalysis.push(analysis);
      }
    }
    
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
    return null;
  }
}

/**
 * Detecta batches ya creados y última categoría procesada
 */
function detectExistingBatches() {
  if (!fs.existsSync(VENDOR_DIR)) {
    return { lastBatch: 0, processedCategories: [] };
  }
  
  const files = fs.readdirSync(VENDOR_DIR);
  const batchFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}-plan-batch-\d+\.json$/));
  
  if (batchFiles.length === 0) {
    return { lastBatch: 0, processedCategories: [] };
  }
  
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
        batchData.categories.forEach(cat => {
          if (cat.name) processedCategories.push(cat.name);
        });
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
      if (cat.isLeaf) {
        total += cat.expected_products || 0;
      } else if (cat.subcategories) {
        total += countProducts(cat.subcategories);
      }
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
    try {
      projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    } catch (error) {
      console.log('⚠️  Error leyendo projects.json');
    }
  }
  
  if (!projectsData.projects) {
    projectsData.projects = {};
  }
  
  if (!projectsData.projects[SELLER_ID]) {
    projectsData.projects[SELLER_ID] = {};
  }
  
  const project = projectsData.projects[SELLER_ID];
  
  if (!project.batches) {
    project.batches = [];
  }
  
  const existingBatchIndex = project.batches.findIndex(b => b.batch === batchNumber);
  const batchInfo = {
    batch: batchNumber,
    status: 'plan_created',
    products: batchData.totalProducts,
    categories: batchData.categories,
    created_at: new Date().toISOString()
  };
  
  if (existingBatchIndex >= 0) {
    project.batches[existingBatchIndex] = batchInfo;
  } else {
    project.batches.push(batchInfo);
  }
  
  project.plan_created = true;
  project.plan_date = new Date().toISOString();
  project.last_updated = new Date().toISOString();
  project.status = 'planned';
  
  projectsData.last_updated = new Date().toISOString();
  
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
}

/**
 * Carga las cookies de autenticación
 */
function loadCookies() {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.error('❌ Archivo de cookies no encontrado:', COOKIES_FILE);
      console.log('🔑 Ejecuta primero: node scripts/a-login.js');
      return null;
    }
    
    const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    
    if (!cookieData.cookies || !Array.isArray(cookieData.cookies)) {
      console.error('❌ Formato de cookies inválido');
      return null;
    }
    
    console.log(`✅ Cookies cargadas: ${cookieData.cookies.length}`);
    return cookieData.cookies;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Crea planes por lotes para el vendedor
 */
async function createBatchedPlans() {
  console.log('📋 === CREADOR DE PLANES POR LOTES ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`📦 Límite por lote: ${MAX_PRODUCTS_PER_BATCH} productos`);
  
  // Detectar batches existentes
  const { lastBatch, processedCategories } = detectExistingBatches();
  
  if (lastBatch > 0) {
    console.log(`\n♻️  REANUDANDO desde batch ${lastBatch + 1}`);
    console.log(`⏭️  Saltando ${processedCategories.length} categorías ya procesadas`);
  }
  
  // Cargar cookies
  const cookies = loadCookies();
  if (!cookies) return;
  
  console.log('\n🚀 Iniciando navegador...');
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });
  
  await context.addCookies(cookies);
  const page = await context.newPage();
  
  try {
    console.log('🔍 Navegando al vendedor...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Extraer categorías principales
    console.log('📂 Extrayendo categorías principales...');
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
          
          if (href && trimmedText && href.includes('rh=n') && href.includes(SELLER_ID)) {
            const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
            categories.push({
              name: trimmedText,
              url: fullUrl
            });
          }
        } catch (e) {
          // Continuar
        }
      }
      
      if (categories.length > 0) break;
    }
    
    // Eliminar duplicados
    const uniqueCategories = categories.filter((cat, index, self) => 
      index === self.findIndex(c => c.name === cat.name)
    );
    
    console.log(`✅ Encontradas ${uniqueCategories.length} categorías principales`);
    
    // Cargar categorías a saltar
    let skipCategories = [];
    if (fs.existsSync(SKIP_CATEGORIES_FILE)) {
      skipCategories = JSON.parse(fs.readFileSync(SKIP_CATEGORIES_FILE, 'utf8'));
      if (skipCategories.length > 0) {
        console.log(`\n⏭️  Categorías marcadas para saltar: ${skipCategories.length}`);
        skipCategories.forEach(cat => {
          console.log(`   - ${cat.name} (${cat.reason})`);
        });
      }
    }
    
    const skipCategoryNames = new Set(skipCategories.map(c => c.name));
    
    const mainCategories = new Set(uniqueCategories.map(cat => cat.name));
    
    console.log('\n🧠 === ANÁLISIS RECURSIVO POR LOTES ===');
    console.log(`📊 Límite por categoría hoja: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
    console.log(`📦 Límite por lote: ${MAX_PRODUCTS_PER_BATCH} productos`);
    console.log(`🔄 Profundidad máxima: ${MAX_RECURSION_DEPTH} niveles`);
    console.log(`🛡️ Filtro anti-loops: ${mainCategories.size} categorías principales`);
    
    // Variables para control de lotes
    let currentBatch = [];
    let currentBatchProducts = 0;
    let batchNumber = lastBatch + 1;
    let totalBatchesSaved = 0;
    
    function countCategoryProducts(category) {
      if (category.isLeaf) {
        return category.expected_products || 0;
      } else if (category.subcategories && Array.isArray(category.subcategories)) {
        return category.subcategories.reduce((sum, sub) => sum + countCategoryProducts(sub), 0);
      }
      return 0;
    }
    
    // Analizar cada categoría principal
    for (let i = 0; i < uniqueCategories.length; i++) {
      const category = uniqueCategories[i];
      
      // Saltar si ya fue procesada
      if (processedCategories.includes(category.name)) {
        console.log(`\n⏭️  SALTANDO categoría ${i + 1}/${uniqueCategories.length}: ${category.name} (ya procesada)`);
        continue;
      }
      
      // Saltar si está marcada para saltar
      if (skipCategoryNames.has(category.name)) {
        const skipInfo = skipCategories.find(c => c.name === category.name);
        console.log(`\n🚫 SALTANDO categoría ${i + 1}/${uniqueCategories.length}: ${category.name}`);
        console.log(`   Razón: ${skipInfo.reason}`);
        continue;
      }
      
      console.log(`\n🎯 === ANALIZANDO CATEGORÍA ${i + 1}/${uniqueCategories.length}: ${category.name} ===`);
      
      const analysis = await analyzeRecursively(page, category, mainCategories, 1, []);
      
      let categoryData;
      if (analysis) {
        console.log(`✅ ${category.name} analizada exitosamente`);
        categoryData = analysis;
      } else {
        console.log(`❌ ${category.name} falló en el análisis`);
        categoryData = {
          name: category.name,
          url: category.url,
          expected_products: null,
          isLeaf: true,
          depth: 1,
          path: [category.name],
          status: 'error',
          error_during_creation: 'Analysis failed',
          created_at: new Date().toISOString()
        };
      }
      
      const categoryProducts = countCategoryProducts(categoryData);
      
      // Verificar si agregar esta categoría excede el límite del lote
      if (currentBatchProducts + categoryProducts > MAX_PRODUCTS_PER_BATCH && currentBatch.length > 0) {
        console.log(`\n📦 Lote ${batchNumber} alcanzó ${currentBatchProducts} productos`);
        const batchData = saveBatch(batchNumber, currentBatch, mainCategories);
        updateProjectsFile(batchNumber, batchData);
        totalBatchesSaved++;
        
        batchNumber++;
        currentBatch = [];
        currentBatchProducts = 0;
      }
      
      // Agregar categoría al lote actual
      currentBatch.push(categoryData);
      currentBatchProducts += categoryProducts;
      
      console.log(`📊 Lote actual: ${currentBatch.length} categoría(s), ${currentBatchProducts} productos`);
    }
    
    // Guardar último lote si tiene contenido
    if (currentBatch.length > 0) {
      console.log(`\n📦 Guardando último lote ${batchNumber}`);
      const batchData = saveBatch(batchNumber, currentBatch, mainCategories);
      updateProjectsFile(batchNumber, batchData);
      totalBatchesSaved++;
    }
    
    // Resumen final
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
  createBatchedPlans().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { createBatchedPlans };
