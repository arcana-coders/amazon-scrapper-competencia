const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = 'A338WHNLA63C6H';
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const MAX_PRODUCTS_PER_CATEGORY = 320; // Amazon muestra máximo 320 resultados por página

// Archivos y directorios
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

// ========= NUEVAS REGLAS DE DETECCIÓN =========
// Categorías principales que NO deben aparecer como subcategorías (evita loops)
const MAIN_CATEGORIES = new Set([
  'Hogar y Cocina',
  'Herramientas y Mejoras del Hogar',
  'Deportes y Aire libre', 
  'Alimentos y Bebidas',
  'Productos para animales',
  'Electrónicos',
  'Ropa y Accesorios',
  'Salud y Cuidado Personal'
]);

// Patrones de filtros que NO son categorías reales
const FILTER_PATTERNS = [
  /^\$[\d,.]+ a \$[\d,.]+$/,           // "$1,400 a $1,700"
  /^\$[\d,.]+ y más$/,                 // "$5,000 y más"
  /^Hasta \$[\d,.]+$/,                 // "Hasta $1,000"
  /^\d+ Stars?\s*o más$/i,            // "4 Stars o más"
  /^Planes de Pago/i,                  // "Planes de Pago Disponibles"
  /^Restablecer/i,                     // "Restablecer rango de precios"
  /^Borrar$/i,                         // "Borrar"
  /^Meses sin/i,                       // "Meses sin intereses"
  /^Amazon (Estados Unidos|Europa|México)$/i, // Vendedores Amazon
  /^[A-Z0-9]{10,}$/,                  // IDs vendedores
  /^\w+ SHOP$/i,                       // "BRT SHOP"
  /^PowerPayless$/i                    // Nombres específicos
];

/**
 * Verifica si un nombre es una categoría válida o debe evitarse
 */
function isValidCategory(name, depth = 0) {
  if (!name || name.trim().length === 0) return false;
  
  const cleanName = name.trim();
  
  // 1. Evitar categorías principales como subcategorías (loops)
  if (MAIN_CATEGORIES.has(cleanName) && depth > 0) {
    console.log(`      🚫 LOOP DETECTADO: "${cleanName}" es categoría principal`);
    return false;
  }
  
  // 2. Evitar filtros conocidos
  for (const pattern of FILTER_PATTERNS) {
    if (pattern.test(cleanName)) {
      console.log(`      🚫 FILTRO DETECTADO: "${cleanName}"`);
      return false;
    }
  }
  
  return true;
}

// Crear directorio si no existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Carga las cookies de autenticación con validación completa
 */
function loadCookies() {
  console.log('🍪 === CARGANDO COOKIES DE AUTENTICACIÓN ===');
  
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
    
    // Verificar cookies importantes
    const sessionCookie = cookieData.cookies.find(c => c.name === 'session-id');
    const ubidCookie = cookieData.cookies.find(c => c.name === 'ubid-acbmx');
    
    console.log(`✅ Total cookies cargadas: ${cookieData.cookies.length}`);
    console.log(`✅ Session cookie: ${sessionCookie ? 'Encontrada' : 'NO encontrada'}`);
    console.log(`✅ UBID cookie: ${ubidCookie ? 'Encontrada' : 'NO encontrada'}`);
    
    if (sessionCookie) {
      console.log(`✅ Session válida hasta: ${new Date(sessionCookie.expires * 1000).toLocaleString()}`);
    }
    
    return cookieData.cookies;
    
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Extrae el número de productos de la página con logging detallado
 */
async function extractProductCount(page, categoryName) {
  console.log(`      📊 Extrayendo conteo de: ${categoryName}`);
  
  try {
    const productInfo = await page.evaluate(() => {
      const texts = [];
      
      // Selectores conocidos que funcionan
      const selectors = [
        '.a-section .a-size-base',
        '.s-result-count',
        '.sg-col-inner .a-size-base',
        '.a-spacing-top-small .a-size-base'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text) texts.push(text);
        });
      });
      
      return texts;
    });

    for (const text of productInfo) {
      console.log(`         ✅ Texto: "${text}"`);
      
      // Patrones conocidos que funcionan
      const patterns = [
        /(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
        /1-\d+\s+de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
        /más de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ''));
          console.log(`         🎯 Productos detectados: ${count}`);
          return count;
        }
      }
    }
    
    console.log(`         ⚠️ No se pudo extraer conteo`);
    return null;
    
  } catch (error) {
    console.log(`         ❌ Error extrayendo conteo: ${error.message}`);
    return null;
  }
}

/**
 * Extrae subcategorías con FILTRADO INTELIGENTE
 */
async function extractSubcategories(page, depth = 0) {
  try {
    const subcategories = await page.evaluate(() => {
      const results = [];
      const selectors = [
        'div[data-cy="nav-subnav"] a',
        '.s-navigation-indent-1 a',
        '.s-navigation-indent-2 a',
        'div.a-section a[href*="rh="]',
        '.s-refinements a[href*="rh="]'
      ];
      
      const foundLinks = new Set();
      
      selectors.forEach(selector => {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
          const href = link.href;
          const text = link.textContent?.trim();
          
          if (href && text && href.includes('me=A338WHNLA63C6H') && !foundLinks.has(href)) {
            foundLinks.add(href);
            results.push({
              name: text,
              url: href
            });
          }
        });
      });
      
      return results;
    });

    // FILTRAR con las nuevas reglas
    const validSubcategories = [];
    let loopsDetected = 0;
    let filtersDetected = 0;
    
    for (const subcat of subcategories) {
      if (isValidCategory(subcat.name, depth)) {
        validSubcategories.push(subcat);
      } else {
        // Contar tipo de filtro
        const cleanName = subcat.name.trim();
        if (MAIN_CATEGORIES.has(cleanName)) {
          loopsDetected++;
        } else {
          filtersDetected++;
        }
      }
    }
    
    console.log(`      🔍 Subcategorías encontradas: ${subcategories.length} total`);
    console.log(`      ✅ Válidas: ${validSubcategories.length}`);
    console.log(`      🚫 Loops evitados: ${loopsDetected}`);
    console.log(`      🚫 Filtros detectados: ${filtersDetected}`);
    
    return {
      valid: validSubcategories.slice(0, 15), // Máximo 15
      stats: { total: subcategories.length, loops: loopsDetected, filters: filtersDetected }
    };
    
  } catch (error) {
    console.log(`      ❌ Error extrayendo subcategorías: ${error.message}`);
    return { valid: [], stats: { total: 0, loops: 0, filters: 0 } };
  }
}

/**
 * Explora una categoría recursivamente con las NUEVAS REGLAS
 */
async function exploreCategory(page, url, name, fullPath, results, depth = 1, visitedUrls = new Set()) {
  if (depth > 3 || visitedUrls.has(url)) {
    if (depth > 3) console.log(`  ${'  '.repeat(depth-1)}⏹️ Profundidad máxima alcanzada (${depth})`);
    if (visitedUrls.has(url)) console.log(`  ${'  '.repeat(depth-1)}⏭️ URL ya visitada, saltando...`);
    return;
  }

  console.log(`\n${'📂 '.repeat(depth)}Subcategoría: ${name}`);
  console.log(`  ${'  '.repeat(depth-1)}🔍 Explorando: ${name}`);
  console.log(`  ${'  '.repeat(depth-1)}   📂 Ruta: ${fullPath}`);
  console.log(`  ${'  '.repeat(depth-1)}   🌐 URL: ${url.substring(0, 100)}...`);

  visitedUrls.add(url);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    
    // Espera aleatoria como siempre
    const waitTime = Math.random() * 3000 + 2000;
    console.log(`  ${'  '.repeat(depth-1)}   ⏳ Esperando ${(waitTime/1000).toFixed(2)}s...`);
    await page.waitForTimeout(waitTime);

    const productCount = await extractProductCount(page, name);
    
    if (productCount === null) {
      console.log(`  ${'  '.repeat(depth-1)}   ⚠️ No se pudo determinar productos, saltando...`);
      return;
    }

    console.log(`  ${'  '.repeat(depth-1)}   📊 Productos: ${productCount}`);
    console.log(`  ${'  '.repeat(depth-1)}   🎚️ Límite: ${MAX_PRODUCTS_PER_CATEGORY}`);

    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
      console.log(`  ${'  '.repeat(depth-1)}   ✅ CATEGORÍA HOJA (${productCount} ≤ ${MAX_PRODUCTS_PER_CATEGORY})`);
      console.log(`  ${'  '.repeat(depth-1)}   💾 Guardada como hoja`);
      
      results.subcategories.push({
        url,
        name,
        full_path: fullPath,
        productCount,
        isLeaf: true,
        depth,
        timestamp: new Date().toISOString()
      });
      
    } else {
      console.log(`  ${'  '.repeat(depth-1)}   🌳 NECESITA SUBDIVISIÓN (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY})`);
      
      const subcatResult = await extractSubcategories(page, depth);
      
      // Actualizar estadísticas
      results.validation_stats.total_loops_avoided += subcatResult.stats.loops;
      results.validation_stats.total_filters_detected += subcatResult.stats.filters;
      
      console.log(`  ${'  '.repeat(depth-1)}   🔄 Explorando ${subcatResult.valid.length} subcategorías válidas...`);

      for (let i = 0; i < subcatResult.valid.length; i++) {
        const subcat = subcatResult.valid[i];
        console.log(`\n  ${'  '.repeat(depth)}📂 Subcategoría ${i+1}/${subcatResult.valid.length}: ${subcat.name}`);
        
        await exploreCategory(
          page, 
          subcat.url, 
          subcat.name, 
          `${fullPath} > ${subcat.name}`,
          results,
          depth + 1,
          visitedUrls
        );
      }
    }

  } catch (error) {
    console.log(`  ${'  '.repeat(depth-1)}   ❌ Error: ${error.message}`);
  }
}

/**
 * Función principal que usa TODO LO QUE YA FUNCIONA + nuevas reglas
 */
async function smartScrapeCategory(categoryName) {
  console.log(`\n🎯 === INICIANDO: ${categoryName} ===`);
  
  // Cargar cookies (código que YA FUNCIONA)
  const cookies = loadCookies();
  if (!cookies) return;
  
  // Leer plan (código que YA FUNCIONA)
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  const category = plan.categories.find(cat => cat.name === categoryName);
  
  if (!category) {
    console.log(`❌ Categoría "${categoryName}" no encontrada en el plan`);
    return;
  }

  if (category.status === 'completed') {
    console.log(`✅ ${categoryName} ya completada, saltando...`);
    return;
  }

  // Marcar como procesando
  category.status = 'processing';
  category.started_at = new Date().toISOString();
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));

  // Crear browser (código que YA FUNCIONA)
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  
  // Configurar browser (código que YA FUNCIONA)
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  await page.context().addCookies(cookies);

  try {
    console.log(`\n🚀 === PROCESAMIENTO INTELIGENTE: ${categoryName} ===`);
    console.log(`📊 Productos esperados: ${category.expected_products || 'N/A'}`);
    console.log(`🎯 Límite configurado: ${MAX_PRODUCTS_PER_CATEGORY}`);

    const results = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        processing_type: 'smart_with_loop_detection',
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        max_depth: 3,
        max_subcategories_per_level: 15,
        expected_products: category.expected_products
      },
      validation_stats: {
        total_loops_avoided: 0,
        total_filters_detected: 0
      },
      subcategories: []
    };

    // Explorar con las NUEVAS REGLAS
    await exploreCategory(page, category.url, categoryName, categoryName, results);

    // Guardar resultados (código que YA FUNCIONA)
    const filename = `${dateStr}-smart-${categoryName.toLowerCase().replace(/\s+/g, '-')}-${SELLER_ID}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

    // Actualizar plan (código que YA FUNCIONA) + nuevas estadísticas
    category.status = 'completed';
    category.completed_at = new Date().toISOString();
    category.file_path = filename;
    category.validation_result = {
      total_subcategories: results.subcategories.length,
      total_products: results.subcategories.reduce((sum, sub) => sum + sub.productCount, 0),
      loops_avoided: results.validation_stats.total_loops_avoided,
      filters_detected: results.validation_stats.total_filters_detected,
      expected_vs_found: {
        expected: category.expected_products,
        found: results.subcategories.reduce((sum, sub) => sum + sub.productCount, 0)
      }
    };

    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));

    console.log(`\n📊 === RESULTADOS FINALES ===`);
    console.log(`✅ Subcategorías procesadas: ${results.subcategories.length}`);
    console.log(`🌿 Categorías hoja: ${results.subcategories.length}`);
    console.log(`📦 Total productos: ${category.validation_result.total_products}`);
    console.log(`🚫 Loops evitados: ${results.validation_stats.total_loops_avoided}`);
    console.log(`🚫 Filtros detectados: ${results.validation_stats.total_filters_detected}`);
    console.log(`🎯 Esperado vs Real: ${category.expected_products} vs ${category.validation_result.total_products}`);
    console.log(`💾 Archivo guardado: ${filename}`);
    console.log(`✅ ${categoryName} completada exitosamente`);

  } catch (error) {
    console.error(`❌ Error procesando ${categoryName}:`, error.message);
    category.status = 'error';
    category.error = error.message;
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
  } finally {
    await browser.close();
  }
}

// Ejecutar con Herramientas (la problemática) - SISTEMA PROBADO
if (require.main === module) {
  smartScrapeCategory('Herramientas y Mejoras del Hogar');
}

module.exports = { smartScrapeCategory };