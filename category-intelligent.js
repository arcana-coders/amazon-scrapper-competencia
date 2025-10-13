// BASADO EN category-detailed-test.js (BASE FUNCIONAL) + detección inteligente
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Obtener SELLER_ID como argumento obligatorio
if (process.argv.length < 4) {
  console.log('❌ Uso: node category-intelligent.js SELLER_ID "Nombre de Categoría"');
  console.log('📋 Ejemplo: node category-intelligent.js A3Q5ASRA7J8Y5E "Hogar y Cocina"');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const categoryName = process.argv[3];
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const MAX_PRODUCTS_PER_CATEGORY = 320; // Amazon muestra máximo 320 resultados por página

// Archivos y directorios - NUEVA ESTRUCTURA POR VENDEDOR
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');

// Función para encontrar el archivo de plan (tradicional o batch)
function findPlanFile() {
  // Primero buscar archivos de batch
  const files = fs.readdirSync(VENDOR_DIR);
  const batchFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}-plan-batch-\d+\.json$/));
  
  if (batchFiles.length > 0) {
    // Sistema de batches: buscar en todos los archivos de batch
    return batchFiles.map(f => path.join(VENDOR_DIR, f));
  }
  
  // Sistema tradicional: un solo archivo plan.json
  const traditionalPlan = path.join(VENDOR_DIR, `${dateStr}-plan.json`);
  if (fs.existsSync(traditionalPlan)) {
    return [traditionalPlan];
  }
  
  return null;
}

const PLAN_FILES = findPlanFile();
if (!PLAN_FILES) {
  console.error(`❌ No se encontró ningún archivo de plan para el vendedor ${SELLER_ID}`);
  console.error(`   Buscado en: ${VENDOR_DIR}`);
  console.error(`   Ejecuta primero: node create-plan.js ${SELLER_ID}`);
  console.error(`   O para batches: node create-plan-batches.js ${SELLER_ID}`);
  process.exit(1);
}

// ===== DETECCIÓN INTELIGENTE DINÁMICA =====
// Las categorías principales se cargan dinámicamente del plan del vendedor
let MAIN_CATEGORIES = new Set();

const FILTER_PATTERNS = [
  /^\$[\d,.]+ a \$[\d,.]+$/,     // "$1,400 a $1,700"
  /^\$[\d,.]+ y más$/,           // "$5,000 y más"  
  /^Hasta \$[\d,.]+$/,           // "Hasta $1,000"
  /^\d+ Stars?\s*o más$/i,       // "4 Stars o más"
  /^Planes de Pago/i,            // "Planes de Pago Disponibles"
  /^Amazon (Estados Unidos|Europa|México)$/i, // Vendedores Amazon
  /^\w+ SHOP$/i,                 // "BRT SHOP"
  /^PowerPayless$/i,             // Vendedores específicos
  /^\d+$/,                       // "2", "3" (paginación)
  /^Siguiente$/i,                // "Siguiente" (paginación)
  /^Anterior$/i,                 // "Anterior" (paginación) 
  /^Incluir no Disponibles$/i,   // "Incluir no Disponibles" (filtro disponibilidad)
  /^[A-Z\s]+ [A-Z]{2,}$/         // "LIE LIN", "FERRETERIA BE" (marcas en caps)
];

function isValidCategory(name, depth = 0) {
  if (!name || name.trim().length === 0) return false;
  
  const cleanName = name.trim();
  
  // Evitar categorías principales como subcategorías (loops)
  if (MAIN_CATEGORIES.has(cleanName) && depth > 0) {
    console.log(`      🚫 LOOP EVITADO: "${cleanName}"`);
    return false;
  }
  
  // Evitar filtros conocidos
  for (const pattern of FILTER_PATTERNS) {
    if (pattern.test(cleanName)) {
      console.log(`      🚫 FILTRO EVITADO: "${cleanName}"`);
      return false;
    }
  }
  
  return true;
}
// ===== FIN DE ÚNICA ADICIÓN =====

// Crear carpeta del vendedor si no existe
if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

// TODAS LAS FUNCIONES DE category-detailed-test.js SIN CAMBIOS:

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
 * Extrae subcategorías CON FILTRADO INTELIGENTE (ÚNICA MODIFICACIÓN)
 */
async function extractSubcategories(page, depth = 0) {
  try {
    const subcategories = await page.evaluate((sellerId) => {
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
          
          if (href && text && href.includes(`me=${sellerId}`) && !foundLinks.has(href)) {
            foundLinks.add(href);
            results.push({
              name: text,
              url: href
            });
          }
        });
      });
      
      return results;
    }, SELLER_ID);

    // APLICAR FILTRADO INTELIGENTE
    const validSubcategories = [];
    let loopsDetected = 0;
    let filtersDetected = 0;
    
    for (const subcat of subcategories) {
      if (isValidCategory(subcat.name, depth)) {
        validSubcategories.push(subcat);
      } else {
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
    if (loopsDetected > 0) console.log(`      🚫 Loops evitados: ${loopsDetected}`);
    if (filtersDetected > 0) console.log(`      🚫 Filtros evitados: ${filtersDetected}`);
    
    return {
      valid: validSubcategories.slice(0, 15), // Máximo 15
      stats: { total: subcategories.length, loops: loopsDetected, filters: filtersDetected }
    };
    
  } catch (error) {
    console.log(`      ❌ Error extrayendo subcategorías: ${error.message}`);
    return { valid: [], stats: { total: 0, loops: 0, filters: 0 } };
  }
}

// RESTO DE FUNCIONES EXACTAS de category-detailed-test.js:

/**
 * Procesa una sola categoría con logging detallado
 */
async function processCategory(categoryName) {
  console.log(`\n🎯 === INICIANDO: ${categoryName} ===`);
  
  // Cargar cookies (EXACTO como category-detailed-test.js)
  const cookies = loadCookies();
  if (!cookies) return;
  
  // Leer el plan y inicializar categorías principales dinámicamente
  let category = null;
  let plan = null;
  let currentPlanFile = null;
  
  // Buscar la categoría en todos los archivos de plan
  for (const planFile of PLAN_FILES) {
    try {
      const currentPlan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
      const foundCategory = currentPlan.categories.find(cat => cat.name === categoryName);
      
      if (foundCategory) {
        category = foundCategory;
        plan = currentPlan;
        currentPlanFile = planFile;
        console.log(`📄 Categoría encontrada en: ${path.basename(planFile)}`);
        break;
      }
    } catch (error) {
      console.log(`⚠️ Error leyendo ${path.basename(planFile)}: ${error.message}`);
    }
  }
  
  if (!category || !plan) {
    console.log(`❌ Categoría "${categoryName}" no encontrada en ningún plan`);
    console.log(`   Archivos revisados: ${PLAN_FILES.length}`);
    return;
  }
  
  // NUEVA FUNCIONALIDAD: Inicializar categorías principales del vendedor
  if (plan.main_categories && Array.isArray(plan.main_categories)) {
    MAIN_CATEGORIES = new Set(plan.main_categories);
    console.log(`🧠 Categorías principales cargadas: ${MAIN_CATEGORIES.size}`);
    console.log(`   📋 Lista: ${Array.from(MAIN_CATEGORIES).join(', ')}`);
  } else {
    console.log(`⚠️ Sin categorías principales en el plan, usando detección estática`);
  }

  if (category.status === 'completed') {
    console.log(`✅ ${categoryName} ya completada, saltando...`);
    return;
  }

  // Marcar como procesando
  category.status = 'processing';
  category.started_at = new Date().toISOString();
  fs.writeFileSync(currentPlanFile, JSON.stringify(plan, null, 2));

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  
  try {
    // Configurar página (EXACTO como category-detailed-test.js)
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    await page.context().addCookies(cookies);

    console.log(`\n🚀 === PROCESAMIENTO CON DETECCIÓN INTELIGENTE: ${categoryName} ===`);
    console.log(`📊 Productos esperados: ${category.expected_products || 'N/A'}`);
    console.log(`🎯 Límite configurado: ${MAX_PRODUCTS_PER_CATEGORY}`);

    const results = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        processing_type: 'intelligent_detection_v1',
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        max_depth: 3,
        expected_products: category.expected_products
      },
      intelligence_stats: {
        loops_avoided: 0,
        filters_detected: 0
      },
      subcategories: []
    };

    // Navegar a la categoría principal
    console.log(`\n🔍 Explorando: ${categoryName}`);
    console.log(`   📂 Ruta: ${categoryName}`);
    console.log(`   🌐 URL: ${category.url.substring(0, 100)}...`);

    await page.goto(category.url, { waitUntil: 'load', timeout: 15000 });
    
    const waitTime = Math.random() * 3000 + 2000;
    console.log(`   ⏳ Esperando ${(waitTime/1000).toFixed(2)}s...`);
    await page.waitForTimeout(waitTime);

    const productCount = await extractProductCount(page, categoryName);
    
    if (productCount === null) {
      console.log(`   ⚠️ No se pudo determinar productos, saltando...`);
      return;
    }

    console.log(`   📊 Productos: ${productCount}`);
    console.log(`   🎚️ Límite: ${MAX_PRODUCTS_PER_CATEGORY}`);

    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
      console.log(`   ✅ CATEGORÍA HOJA (${productCount} ≤ ${MAX_PRODUCTS_PER_CATEGORY})`);
      console.log(`   💾 Guardada como hoja`);
      
      results.subcategories.push({
        url: category.url,
        name: categoryName,
        full_path: categoryName,
        productCount,
        isLeaf: true,
        depth: 1,
        timestamp: new Date().toISOString()
      });
      
    } else {
      console.log(`   🌳 NECESITA SUBDIVISIÓN (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY})`);
      
      const subcatResult = await extractSubcategories(page, 1);
      
      // Actualizar estadísticas de inteligencia
      results.intelligence_stats.loops_avoided += subcatResult.stats.loops;
      results.intelligence_stats.filters_detected += subcatResult.stats.filters;
      
      console.log(`   🔄 Procesando ${subcatResult.valid.length} subcategorías válidas...`);

      // Procesar cada subcategoría válida
      for (let i = 0; i < subcatResult.valid.length; i++) {
        const subcat = subcatResult.valid[i];
        console.log(`\n  📂 Subcategoría ${i+1}/${subcatResult.valid.length}: ${subcat.name}`);
        
        try {
          await page.goto(subcat.url, { waitUntil: 'load', timeout: 15000 });
          
          const subWaitTime = Math.random() * 3000 + 2000;
          console.log(`     ⏳ Esperando ${(subWaitTime/1000).toFixed(2)}s...`);
          await page.waitForTimeout(subWaitTime);

          const subProductCount = await extractProductCount(page, subcat.name);
          
          if (subProductCount !== null) {
            console.log(`     📊 Productos: ${subProductCount}`);
            console.log(`     💾 Guardada como hoja`);
            
            results.subcategories.push({
              url: subcat.url,
              name: subcat.name,
              full_path: `${categoryName} > ${subcat.name}`,
              productCount: subProductCount,
              isLeaf: true,
              depth: 2,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.log(`     ❌ Error procesando ${subcat.name}: ${error.message}`);
        }
      }
    }

    // Guardar resultados en carpeta del vendedor
    const filename = `${dateStr}-intelligent-${categoryName.toLowerCase().replace(/\s+/g, '-')}.json`;
    const filepath = path.join(VENDOR_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

    // Actualizar plan (EXACTO como category-detailed-test.js) + estadísticas de inteligencia
    category.status = 'completed';
    category.completed_at = new Date().toISOString();
    category.file_path = filename;
    category.validation_result = {
      total_subcategories: results.subcategories.length,
      total_products: results.subcategories.reduce((sum, sub) => sum + sub.productCount, 0),
      loops_avoided: results.intelligence_stats.loops_avoided,
      filters_detected: results.intelligence_stats.filters_detected,
      expected_vs_found: {
        expected: category.expected_products,
        found: results.subcategories.reduce((sum, sub) => sum + sub.productCount, 0)
      }
    };

    fs.writeFileSync(currentPlanFile, JSON.stringify(plan, null, 2));

    console.log(`\n📊 === RESULTADOS FINALES ===`);
    console.log(`✅ Subcategorías procesadas: ${results.subcategories.length}`);
    console.log(`📦 Total productos: ${category.validation_result.total_products}`);
    console.log(`🚫 Loops evitados: ${results.intelligence_stats.loops_avoided}`);
    console.log(`🚫 Filtros evitados: ${results.intelligence_stats.filters_detected}`);
    console.log(`🎯 Esperado vs Real: ${category.expected_products} vs ${category.validation_result.total_products}`);
    console.log(`💾 Archivo guardado: ${filename}`);
    console.log(`✅ ${categoryName} completada exitosamente`);

  } catch (error) {
    console.error(`❌ Error procesando ${categoryName}:`, error.message);
    category.status = 'error';
    category.error = error.message;
    fs.writeFileSync(currentPlanFile, JSON.stringify(plan, null, 2));
  } finally {
    await browser.close();
  }
}

// Ejecutar procesamiento
if (require.main === module) {
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`� Categoría: ${categoryName}`);
  processCategory(categoryName);
}