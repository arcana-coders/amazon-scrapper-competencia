const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = 'A338WHNLA63C6H';
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const MAX_PRODUCTS_PER_CATEGORY = 320; // Amazon muestra máximo 320 resultados por página
const MAX_DEPTH = 3; // Profundidad adecuada para este tamaño

// Archivos y directorios
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

// Crear directorio si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Variables globales para la sesión actual
let visitedUrls = new Set();
let currentCategoryResults = [];

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
    
    // Verificar edad aproximada
    const sessionCookie = cookieData.cookies.find(c => c.name === 'session-id');
    if (sessionCookie) {
      const ageHours = (Date.now() / 1000 - sessionCookie.expires + (24 * 60 * 60)) / 3600;
      if (ageHours > 6) {
        console.log(`⚠️ Cookies pueden estar expiradas (${ageHours.toFixed(1)} horas)`);
        console.log('🔄 Considera ejecutar: node scripts/a-login.js');
      } else {
        console.log(`✅ Cookies válidas (${ageHours.toFixed(1)} horas de antigüedad)`);
      }
    }
    
    return cookieData.cookies;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Carga o crea el plan de exploración
 */
function loadOrCreatePlan() {
  try {
    if (fs.existsSync(PLAN_FILE)) {
      const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
      console.log(`📋 Plan cargado: ${plan.categories.length} categorías`);
      
      const completed = plan.categories.filter(cat => cat.status === 'completed').length;
      const pending = plan.categories.filter(cat => cat.status === 'pending').length;
      const inProgress = plan.categories.filter(cat => cat.status === 'in_progress').length;
      
      console.log(`   ✅ Completadas: ${completed}`);
      console.log(`   🔄 En progreso: ${inProgress}`);
      console.log(`   ⏳ Pendientes: ${pending}`);
      
      return plan;
    }
  } catch (error) {
    console.log(`⚠️ Error cargando plan: ${error.message}`);
  }
  
  // Crear plan vacío si no existe
  return {
    seller_id: SELLER_ID,
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    total_categories: 0,
    categories: []
  };
}

/**
 * Guarda el plan de exploración
 */
function savePlan(plan) {
  try {
    plan.last_updated = new Date().toISOString();
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    
    const completed = plan.categories.filter(cat => cat.status === 'completed').length;
    console.log(`💾 Plan actualizado: ${completed}/${plan.categories.length} completadas`);
  } catch (error) {
    console.error('❌ Error guardando plan:', error.message);
  }
}

/**
 * Normaliza URL para evitar duplicados
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    const essentialParams = ['me', 'rh', 'marketplaceID', 'i'];
    const newParams = new URLSearchParams();
    
    essentialParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        newParams.set(param, urlObj.searchParams.get(param));
      }
    });
    
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}?${newParams.toString()}`;
  } catch (e) {
    return url;
  }
}

/**
 * Extrae el número de productos de una página
 */
async function extractProductCount(page) {
  try {
    console.log('🔍 Extrayendo conteo de productos...');
    
    // Esperar a que carguen los elementos
    await page.waitForSelector('h2, .s-result-count, [data-component-type="s-result-info-bar"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      'h2[class*="a-size-base"][class*="a-spacing-small"]',
      '.a-section.a-spacing-none.s-breadcrumb-with-all-filters h2',
      'h2',
      '.a-size-base'
    ];

    for (const selector of selectors) {
      const elements = await page.$$(selector);
      
      for (const element of elements) {
        const text = await element.textContent();
        const trimmedText = text ? text.trim() : '';
        
        if (trimmedText && (
            trimmedText.includes('resultado') || 
            trimmedText.includes('de ') || 
            trimmedText.includes('producto') ||
            /\d+\s*-\s*\d+\s+de/i.test(trimmedText) ||
            trimmedText.includes('más de')
          )) {
          
          console.log(`✅ Texto encontrado: "${trimmedText}"`);
          
          // Extraer número con regex mejorado para capturas como "1-16 de 431 resultados"
          let match = null;
          
          // Buscar primero "de [número] resultado"
          match = trimmedText.match(/de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
          
          if (!match) {
            // Buscar patrón "X-Y de Z"
            match = trimmedText.match(/\d+\s*-\s*\d+\s+de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)/i);
          }
          
          if (!match) {
            // Buscar solo número seguido de "resultado"
            match = trimmedText.match(/^(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
          }
          
          if (match) {
            let numberStr = match[1].replace(/[,\.]/g, '');
            
            // Si es "más de X", usar X + margen
            if (trimmedText.toLowerCase().includes('más de')) {
              const baseNumber = parseInt(numberStr, 10);
              if (!isNaN(baseNumber)) {
                const adjustedNumber = Math.floor(baseNumber * 1.1); // +10% para "más de"
                console.log(`🎯 "Más de ${baseNumber}" → Estimado: ${adjustedNumber}`);
                return adjustedNumber;
              }
            }
            
            const number = parseInt(numberStr, 10);
            if (!isNaN(number)) {
              console.log(`🎯 Número extraído: ${number}`);
              return number;
            }
          }
        }
      }
    }
    
    console.log('⚠️ No se pudo extraer el número de productos');
    return null;
  } catch (error) {
    console.error('❌ Error al extraer conteo:', error.message);
    return null;
  }
}

/**
 * Extrae las categorías/subcategorías del sidebar
 */
async function extractCategories(page) {
  try {
    console.log('🔍 Extrayendo categorías...');
    const categories = [];
    
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]', 
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]',
      '#departments a[href*="rh=n"]',
      '.s-navigation-container a[href*="rh=n"]',
      'a[href*="rh=n%3A"]'
    ];

    for (const selector of categorySelectors) {
      const elements = await page.$$(selector);
      
      for (const element of elements) {
        try {
          const href = await element.getAttribute('href');
          const text = await element.textContent();
          const trimmedText = text ? text.trim() : '';
          
          if (href && trimmedText && href.includes('rh=n') && !href.includes('javascript:')) {
            const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
            
            // Verificar que contenga nuestro seller ID
            if (fullUrl.includes(SELLER_ID)) {
              categories.push({
                url: fullUrl,
                name: trimmedText
              });
            }
          }
        } catch (elementError) {
          // Continuar con el siguiente elemento
        }
      }
      
      if (categories.length > 0) break; // Si encontramos categorías, parar
    }
    
    // Eliminar duplicados por URL
    const uniqueCategories = categories.filter((cat, index, self) => 
      index === self.findIndex(c => normalizeUrl(c.url) === normalizeUrl(cat.url))
    );
    
    console.log(`✅ Encontradas ${uniqueCategories.length} categorías únicas`);
    return uniqueCategories;
  } catch (error) {
    console.error('❌ Error al extraer categorías:', error.message);
    return [];
  }
}

/**
 * Explora una categoría de manera recursiva y precisa
 */
async function exploreCategory(page, categoryUrl, categoryName, depth = 0, parentPath = '') {
  const indent = '  '.repeat(depth);
  const fullPath = parentPath ? `${parentPath} > ${categoryName}` : categoryName;
  
  // Límites de seguridad
  if (depth > MAX_DEPTH) {
    console.log(`${indent}⏹️ Profundidad máxima alcanzada (${depth}), saltando...`);
    return;
  }
  
  const normalizedUrl = normalizeUrl(categoryUrl);
  
  if (visitedUrls.has(normalizedUrl)) {
    console.log(`${indent}⏭️ URL ya visitada, saltando...`);
    return;
  }
  
  visitedUrls.add(normalizedUrl);
  console.log(`${indent}🔍 Explorando: ${categoryName}`);

  try {
    // Navegar a la categoría
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Timing anti-bot aleatorio (más rápido para vendedor pequeño)
    const delay = Math.floor(Math.random() * 3000) + 2000;
    console.log(`${indent}⏳ Esperando ${delay / 1000}s...`);
    await page.waitForTimeout(delay);
    
    // Simular actividad humana
    try {
      await page.mouse.move(200, 300);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    } catch (e) {
      // Ignorar errores de simulación
    }

    // Extraer número de productos
    const productCount = await extractProductCount(page);
    
    if (productCount === null) {
      console.log(`${indent}⚠️ No se pudo determinar productos, saltando...`);
      return;
    }

    console.log(`${indent}📊 Productos encontrados: ${productCount}`);

    // Si es una categoría hoja (pocos productos), guardarla
    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
      const leafCategory = {
        url: categoryUrl,
        name: categoryName,
        full_path: fullPath,
        productCount: productCount,
        isLeaf: true,
        depth: depth,
        timestamp: new Date().toISOString()
      };
      
      currentCategoryResults.push(leafCategory);
      console.log(`${indent}✅ CATEGORÍA HOJA: ${productCount} productos (≤${MAX_PRODUCTS_PER_CATEGORY})`);
      return;
    }

    // Si tiene muchos productos, buscar subcategorías
    console.log(`${indent}🌳 Muchos productos (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY}), buscando subcategorías...`);
    const subcategories = await extractCategories(page);

    if (subcategories.length === 0) {
      console.log(`${indent}⚠️ No se encontraron subcategorías, guardando como hoja forzada`);
      currentCategoryResults.push({
        url: categoryUrl,
        name: categoryName,
        full_path: fullPath,
        productCount: productCount,
        isLeaf: false,
        depth: depth,
        reason: 'no_subcategories_found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log(`${indent}🔄 Explorando ${subcategories.length} subcategorías...`);
    
    // Explorar subcategorías con límite de seguridad
    const maxSubcategories = Math.min(subcategories.length, 50);
    
    for (let i = 0; i < maxSubcategories; i++) {
      const subcat = subcategories[i];
      
      // Verificar que no sea la misma URL (evitar bucles)
      const subcatNormalized = normalizeUrl(subcat.url);
      if (subcatNormalized === normalizedUrl) {
        console.log(`${indent}⚠️ Subcategoría igual a categoría actual, saltando...`);
        continue;
      }
      
      try {
        await exploreCategory(page, subcat.url, subcat.name, depth + 1, fullPath);
      } catch (subcatError) {
        console.log(`${indent}❌ Error al explorar subcategoría: ${subcatError.message}`);
        
        // Guardar subcategoría con error
        currentCategoryResults.push({
          url: subcat.url,
          name: subcat.name,
          full_path: `${fullPath} > ${subcat.name}`,
          productCount: 0,
          isLeaf: false,
          depth: depth + 1,
          error: subcatError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (subcategories.length > maxSubcategories) {
      console.log(`${indent}⚠️ Procesadas ${maxSubcategories} de ${subcategories.length} subcategorías (límite alcanzado)`);
    }

  } catch (error) {
    console.error(`${indent}❌ Error explorando ${categoryName}:`, error.message);
  }
}

/**
 * Guarda los resultados de una categoría con validación
 */
function saveCategoryResults(categoryName, categoryData, expectedProducts = null) {
  try {
    const cleanName = categoryName.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const fileName = `${dateStr}-${cleanName}-${SELLER_ID}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    
    // Calcular estadísticas
    const totalProducts = categoryData.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    const leafCategories = categoryData.filter(cat => cat.isLeaf);
    const branchCategories = categoryData.filter(cat => !cat.isLeaf);
    const maxDepth = Math.max(...categoryData.map(cat => cat.depth || 0), 0);
    
    // Validación de completitud
    let validationResult = {
      is_complete: true,
      expected_products: expectedProducts,
      actual_products: totalProducts,
      difference: expectedProducts ? Math.abs(expectedProducts - totalProducts) : 0,
      difference_percentage: expectedProducts ? Math.abs((expectedProducts - totalProducts) / expectedProducts) * 100 : 0
    };
    
    if (expectedProducts && Math.abs(expectedProducts - totalProducts) > expectedProducts * 0.1) {
      validationResult.is_complete = false;
      validationResult.warning = `Diferencia significativa: esperado ${expectedProducts}, encontrado ${totalProducts}`;
    }
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        total_subcategories: categoryData.length,
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        status: "completed",
        validation: validationResult,
        statistics: {
          total_products: totalProducts,
          leaf_categories: leafCategories.length,
          branch_categories: branchCategories.length,
          max_exploration_depth: maxDepth,
          unique_urls: [...new Set(categoryData.map(cat => cat.url))].length
        }
      },
      subcategories: categoryData
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    
    console.log(`💾 Archivo guardado: ${fileName}`);
    console.log(`📊 ${categoryData.length} subcategorías, ${totalProducts} productos totales`);
    
    if (!validationResult.is_complete) {
      console.log(`⚠️ ${validationResult.warning}`);
    } else if (expectedProducts) {
      console.log(`✅ Validación exitosa: ${totalProducts}/${expectedProducts} productos`);
    }
    
    return filePath;
  } catch (error) {
    console.error('❌ Error guardando archivo:', error.message);
    return null;
  }
}

/**
 * Extrae las categorías principales y crea el plan inicial
 */
async function extractMainCategoriesAndCreatePlan(page) {
  console.log('📋 Creando plan de exploración...');
  
  // Ir a la página principal del vendedor
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Extraer categorías principales
  const mainCategories = await extractCategories(page);
  
  if (mainCategories.length === 0) {
    throw new Error('No se encontraron categorías principales');
  }
  
  console.log(`✅ Encontradas ${mainCategories.length} categorías principales`);
  
  // Crear plan detallado
  const plan = {
    seller_id: SELLER_ID,
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    total_categories: mainCategories.length,
    categories: []
  };
  
  // Para cada categoría, obtener su conteo inicial
  for (let i = 0; i < mainCategories.length; i++) {
    const category = mainCategories[i];
    console.log(`\n📊 Analizando categoría ${i + 1}/${mainCategories.length}: ${category.name}`);
    
    try {
      await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const productCount = await extractProductCount(page);
      
      const categoryPlan = {
        index: i,
        name: category.name,
        url: category.url,
        expected_products: productCount,
        status: 'pending', // pending, in_progress, completed, error
        file_path: null,
        started_at: null,
        completed_at: null,
        subcategories_found: 0,
        validation_result: null
      };
      
      plan.categories.push(categoryPlan);
      console.log(`   📊 ${productCount || 'N/A'} productos esperados`);
      
    } catch (error) {
      console.log(`   ❌ Error analizando: ${error.message}`);
      plan.categories.push({
        index: i,
        name: category.name,
        url: category.url,
        expected_products: null,
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Guardar plan
  savePlan(plan);
  
  console.log('\n📋 === PLAN DE EXPLORACIÓN CREADO ===');
  plan.categories.forEach((cat, i) => {
    const status = cat.status === 'pending' ? '⏳' : 
                  cat.status === 'completed' ? '✅' : 
                  cat.status === 'error' ? '❌' : '🔄';
    console.log(`  ${i + 1}. ${status} ${cat.name} (${cat.expected_products || 'N/A'} productos)`);
  });
  
  return plan;
}

/**
 * Función principal
 */
async function preciseMain() {
  console.log('🎯 === EXPLORADOR PRECISO DE CATEGORÍAS ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  console.log(`🎯 Profundidad máxima: ${MAX_DEPTH} niveles`);
  
  // Cargar cookies
  const cookies = loadCookies();
  if (!cookies) {
    console.error('💥 No se pudieron cargar las cookies. Abortando.');
    return;
  }
  
  // Configurar navegador
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });
  
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.8,en-US;q=0.5,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  };
  
  const context = await browser.newContext(contextOptions);
  await context.addCookies(cookies);
  console.log(`🍪 ${cookies.length} cookies cargadas`);
  
  const page = await context.newPage();

  // Manejar interrupción
  process.on('SIGINT', async () => {
    console.log('\n⚠️ Interrupción detectada, cerrando navegador...');
    await browser.close();
    process.exit(0);
  });

  try {
    // Cargar o crear plan
    let plan = loadOrCreatePlan();
    
    // Si no hay categorías en el plan, crearlo
    if (plan.categories.length === 0) {
      plan = await extractMainCategoriesAndCreatePlan(page);
    }
    
    // Encontrar siguiente categoría a procesar
    const nextCategory = plan.categories.find(cat => cat.status === 'pending' || cat.status === 'error');
    
    if (!nextCategory) {
      console.log('🎉 ¡Todas las categorías ya fueron procesadas!');
      
      // Mostrar resumen final
      console.log('\n📊 === RESUMEN FINAL ===');
      const completed = plan.categories.filter(cat => cat.status === 'completed');
      const totalProducts = completed.reduce((sum, cat) => sum + (cat.expected_products || 0), 0);
      
      console.log(`✅ Categorías completadas: ${completed.length}/${plan.categories.length}`);
      console.log(`📊 Total de productos: ${totalProducts}`);
      
      completed.forEach((cat, i) => {
        console.log(`  ${i + 1}. ✅ ${cat.name}: ${cat.subcategories_found} subcategorías`);
      });
      
      return;
    }
    
    // Procesar la siguiente categoría
    console.log(`\n🚀 === PROCESANDO CATEGORÍA ${nextCategory.index + 1}/${plan.categories.length} ===`);
    console.log(`📂 Categoría: ${nextCategory.name}`);
    console.log(`📊 Productos esperados: ${nextCategory.expected_products || 'N/A'}`);
    
    // Marcar como en progreso
    nextCategory.status = 'in_progress';
    nextCategory.started_at = new Date().toISOString();
    savePlan(plan);
    
    // Limpiar variables globales
    currentCategoryResults = [];
    visitedUrls.clear();
    
    // Explorar la categoría
    await exploreCategory(page, nextCategory.url, nextCategory.name, 0);
    
    // Guardar resultados
    const filePath = saveCategoryResults(
      nextCategory.name, 
      currentCategoryResults, 
      nextCategory.expected_products
    );
    
    // Actualizar plan
    nextCategory.status = 'completed';
    nextCategory.completed_at = new Date().toISOString();
    nextCategory.file_path = filePath ? path.basename(filePath) : null;
    nextCategory.subcategories_found = currentCategoryResults.length;
    
    // Calcular productos encontrados vs esperados
    const foundProducts = currentCategoryResults.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    nextCategory.validation_result = {
      expected: nextCategory.expected_products,
      found: foundProducts,
      difference: nextCategory.expected_products ? Math.abs(nextCategory.expected_products - foundProducts) : 0,
      is_valid: !nextCategory.expected_products || Math.abs(nextCategory.expected_products - foundProducts) <= nextCategory.expected_products * 0.1
    };
    
    savePlan(plan);
    
    console.log(`\n✅ Categoría completada: ${currentCategoryResults.length} subcategorías encontradas`);
    
    // Mostrar progreso y siguiente paso
    const completed = plan.categories.filter(cat => cat.status === 'completed').length;
    const remaining = plan.categories.filter(cat => cat.status === 'pending' || cat.status === 'error').length;
    
    console.log(`\n📊 === PROGRESO ===`);
    console.log(`✅ Completadas: ${completed}/${plan.categories.length}`);
    console.log(`⏳ Restantes: ${remaining}`);
    
    if (remaining > 0) {
      const next = plan.categories.find(cat => cat.status === 'pending' || cat.status === 'error');
      console.log(`🔄 Siguiente: ${next.name}`);
      console.log(`🚀 Ejecuta 'node category-precise.js' para continuar`);
    } else {
      console.log(`🎉 ¡EXPLORACIÓN COMPLETA!`);
    }

  } catch (error) {
    console.error('❌ Error en función principal:', error.message);
    
    // Marcar categoría actual como error si estaba en progreso
    const inProgressCategory = plan.categories.find(cat => cat.status === 'in_progress');
    if (inProgressCategory) {
      inProgressCategory.status = 'error';
      inProgressCategory.error = error.message;
      savePlan(plan);
    }
  } finally {
    await browser.close();
  }
}

// Ejecutar
if (require.main === module) {
  preciseMain().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { preciseMain };