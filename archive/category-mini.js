const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = 'A1VKD22N1RQ0B';
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const MAX_PRODUCTS_PER_CATEGORY = 320;

// Generar nombre de archivo con fecha
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');

// Crear directorio si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const visitedUrls = new Set();
let currentCategoryResults = [];
const PROGRESS_FILE = path.join(OUTPUT_DIR, `${dateStr}-progress-mini-${SELLER_ID}.json`);

// VERSIÓN MINI: Solo procesar 1 categoría por ejecución
const CATEGORIES_PER_RUN = 1;

/**
 * Normaliza una URL para evitar duplicados
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
    
    // Verificar edad de las cookies
    const now = Date.now() / 1000;
    const oldestCookie = Math.min(...cookieData.cookies.map(c => c.expires || now));
    const ageHours = (now - (oldestCookie - (24 * 60 * 60))) / 3600; // Aproximación
    
    if (ageHours > 6) {
      console.log(`⚠️ Cookies pueden estar expiradas (${ageHours.toFixed(1)} horas de antigüedad)`);
      console.log('🔄 Considera ejecutar: node scripts/a-login.js');
    } else {
      console.log(`✅ Cookie válida (${ageHours.toFixed(1)} horas de antigüedad)`);
    }
    
    return cookieData.cookies;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Carga el progreso previo
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📂 Progreso cargado: ${progress.completed_categories || 0} categorías completadas`);
      return progress;
    }
  } catch (error) {
    console.log(`⚠️ Error cargando progreso: ${error.message}`);
  }
  return { completed_categories: 0, processed_categories: [], current_index: 0 };
}

/**
 * Guarda el progreso actual
 */
function saveProgress(processedCategories, currentIndex, totalCategories) {
  try {
    const progress = {
      last_updated: new Date().toISOString(),
      completed_categories: processedCategories.length,
      current_index: currentIndex,
      total_categories: totalCategories,
      processed_categories: processedCategories
    };
    
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`💾 Progreso guardado: ${processedCategories.length}/${totalCategories} categorías`);
  } catch (error) {
    console.error('❌ Error guardando progreso:', error.message);
  }
}

/**
 * Extrae las categorías principales
 */
async function extractMainCategories(page) {
  console.log('🔍 Extrayendo categorías principales...');
  
  const categorySelectors = [
    '#s-refinements a[href*="rh=n"]',
    '.s-navigation-item a[href*="rh=n"]',
    '#leftNav a[href*="rh=n"]'
  ];

  const categories = [];
  
  for (const selector of categorySelectors) {
    const elements = await page.$$(selector);
    
    for (const element of elements) {
      try {
        const href = await element.getAttribute('href');
        const text = await element.textContent();
        const trimmedText = text ? text.trim() : '';
        
        if (href && trimmedText && href.includes('rh=n') && href.includes(SELLER_ID)) {
          const fullUrl = href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`;
          categories.push({ url: fullUrl, name: trimmedText });
        }
      } catch (e) {
        // Continuar
      }
    }
    
    if (categories.length > 0) break;
  }
  
  // Eliminar duplicados
  return categories.filter((cat, index, self) => 
    index === self.findIndex(c => c.url === cat.url)
  );
}

/**
 * Extrae el número de productos de una página
 */
async function extractProductCount(page) {
  try {
    await page.waitForSelector('h2, .s-result-count', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      'h2[class*="a-size-base"]',
      'h2'
    ];

    for (const selector of selectors) {
      const elements = await page.$$(selector);
      
      for (const element of elements) {
        const text = await element.textContent();
        const trimmedText = text ? text.trim() : '';
        
        if (trimmedText && (
            trimmedText.includes('resultado') || 
            trimmedText.includes('de ') || 
            /\d+\s*-\s*\d+\s+de/i.test(trimmedText) ||
            trimmedText.includes('más de')
          )) {
          
          console.log(`✅ Texto encontrado: "${trimmedText}"`);
          
          // Extraer número
          const match = trimmedText.match(/(?:de\s+)?(?:más de\s+)?(\d{1,3}(?:,\d{3})*|\d+)/i);
          if (match) {
            const numberStr = match[1].replace(/,/g, '');
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
 * Explora una categoría - versión simplificada
 */
async function exploreCategory(page, categoryUrl, categoryName) {
  console.log(`🔍 Explorando: ${categoryName}`);
  
  const normalizedUrl = normalizeUrl(categoryUrl);
  
  if (visitedUrls.has(normalizedUrl)) {
    console.log(`⏭️ URL ya visitada, saltando...`);
    return;
  }
  
  visitedUrls.add(normalizedUrl);

  try {
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Timing aleatorio
    const delay = Math.floor(Math.random() * 5000) + 3000;
    console.log(`⏳ Esperando ${delay / 1000}s...`);
    await page.waitForTimeout(delay);
    
    // Simular actividad
    try {
      await page.mouse.move(200, 300);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
    } catch (e) {
      // Ignorar errores de simulación
    }

    // Extraer número de productos
    const productCount = await extractProductCount(page);
    
    if (productCount === null) {
      console.log(`⚠️ No se pudo determinar productos, saltando...`);
      return;
    }

    console.log(`📊 Productos encontrados: ${productCount}`);

    // Guardar como categoría hoja (simplificado por ahora)
    const leafCategory = {
      url: categoryUrl,
      name: categoryName,
      productCount: productCount,
      isLeaf: productCount <= MAX_PRODUCTS_PER_CATEGORY,
      timestamp: new Date().toISOString()
    };
    
    currentCategoryResults.push(leafCategory);
    console.log(`✅ Categoría guardada: ${productCount} productos`);

  } catch (error) {
    console.error(`❌ Error explorando ${categoryName}:`, error.message);
  }
}

/**
 * Guarda los resultados de una categoría
 */
function saveCategoryResults(categoryName, categoryData) {
  try {
    const cleanName = categoryName.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const fileName = `${dateStr}-${cleanName}-${SELLER_ID}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        total_subcategories: categoryData.length,
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        status: "completed"
      },
      subcategories: categoryData
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    console.log(`💾 Archivo guardado: ${fileName}`);
    console.log(`📊 ${categoryData.length} subcategorías guardadas`);
    
    return filePath;
  } catch (error) {
    console.error('❌ Error guardando archivo:', error.message);
    return null;
  }
}

/**
 * Función principal - versión mini
 */
async function miniMain() {
  console.log('🔧 === EXPLORADOR MINI (1 CATEGORÍA POR EJECUCIÓN) ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  
  // Cargar cookies antes de continuar
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
  
  // Cargar cookies en el contexto
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
    // Ir a la tienda
    console.log('🔗 Accediendo a la tienda principal...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Extraer categorías principales
    const mainCategories = await extractMainCategories(page);
    
    if (mainCategories.length === 0) {
      console.error('❌ No se encontraron categorías principales');
      return;
    }
    
    console.log(`✅ Encontradas ${mainCategories.length} categorías principales`);
    
    // Cargar progreso
    const previousProgress = loadProgress();
    let processedCategories = previousProgress.processed_categories || [];
    let currentIndex = previousProgress.current_index || 0;
    
    if (currentIndex >= mainCategories.length) {
      console.log('🎉 ¡Todas las categorías ya fueron procesadas!');
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('🧹 Archivo de progreso limpiado');
      }
      return;
    }
    
    // Procesar SOLO la siguiente categoría
    const category = mainCategories[currentIndex];
    console.log(`\n🚀 === PROCESANDO CATEGORÍA ${currentIndex + 1}/${mainCategories.length}: ${category.name} ===`);
    
    // Limpiar resultados
    currentCategoryResults = [];
    visitedUrls.clear();
    
    // Explorar esta categoría
    await exploreCategory(page, category.url, category.name);
    
    // Guardar resultados
    const filePath = saveCategoryResults(category.name, currentCategoryResults);
    
    // Actualizar progreso
    const completedCategory = {
      name: category.name,
      url: category.url,
      subcategories_count: currentCategoryResults.length,
      file_path: filePath ? path.basename(filePath) : null,
      processed_at: new Date().toISOString(),
      status: 'completed'
    };
    
    const existingIndex = processedCategories.findIndex(cat => cat.name === category.name);
    if (existingIndex >= 0) {
      processedCategories[existingIndex] = completedCategory;
    } else {
      processedCategories.push(completedCategory);
    }
    
    console.log(`✅ Categoría completada: ${currentCategoryResults.length} subcategorías`);
    
    // Guardar progreso
    saveProgress(processedCategories, currentIndex + 1, mainCategories.length);
    
    // Mostrar siguiente paso
    if (currentIndex + 1 < mainCategories.length) {
      const nextCategory = mainCategories[currentIndex + 1];
      console.log(`\n🔄 === PRÓXIMA EJECUCIÓN ===`);
      console.log(`📋 Siguiente categoría: ${nextCategory.name}`);
      console.log(`📊 Progreso: ${currentIndex + 1}/${mainCategories.length} completadas`);
      console.log(`🚀 Ejecuta 'node category-mini.js' para continuar`);
    } else {
      console.log(`\n🎉 === ¡TODAS LAS CATEGORÍAS COMPLETADAS! ===`);
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('🧹 Archivo de progreso limpiado');
      }
    }

  } catch (error) {
    console.error('❌ Error en función principal:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar
if (require.main === module) {
  miniMain().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { miniMain };