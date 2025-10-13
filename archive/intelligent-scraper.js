const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SELLER_ID = 'A338WHNLA63C6H';
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

// Configuración mejorada
const CONFIG = {
  MAX_PRODUCTS_PER_CATEGORY: 320,
  MAX_DEPTH: 3,
  MAX_SUBCATEGORIES_PER_LEVEL: 15,
  MIN_WAIT: 2000,
  MAX_WAIT: 5000,
  PRODUCT_VALIDATION_THRESHOLD: 0.8, // 80% de productos deben ser válidos
};

// Categorías principales que NO deben aparecer como subcategorías
const MAIN_CATEGORIES = new Set([
  'Hogar y Cocina',
  'Herramientas y Mejoras del Hogar',
  'Deportes y Aire libre',
  'Alimentos y Bebidas',
  'Productos para animales',
  'Electrónicos',
  'Ropa y Accesorios',
  'Salud y Cuidado Personal',
  'Bebé',
  'Juegos y Juguetes',
  'Libros',
  'Automóvil y Motocicleta',
  'Industria y Ciencia',
  'Oficina y Papelería',
  'Jardín'
]);

// Patrones de filtros que NO son categorías reales
const FILTER_PATTERNS = [
  /^\$[\d,.]+ a \$[\d,.]+$/,           // Rangos de precios: "$1,000 a $5,000"
  /^\$[\d,.]+ y más$/,                 // Precios altos: "$5,000 y más"
  /^Hasta \$[\d,.]+$/,                 // Precios bajos: "Hasta $1,000"
  /^\d+ Stars?\s*o más$/i,            // Calificaciones: "4 Stars o más"
  /^Planes de Pago/i,                  // Planes de pago
  /^Restablecer/i,                     // Botones de reset
  /^Borrar$/i,                         // Botones de borrar
  /^Meses sin/i,                       // Meses sin intereses
  /^Amazon (Estados Unidos|Europa|México)$/i, // Vendedores Amazon
  /^[A-Z0-9]{10,}$/,                  // IDs de vendedores: "A1G99GVHAT2WD8"
  /^\w+ SHOP$/i,                       // Nombres de tiendas: "BRT SHOP"
  /^PowerPayless$/i,                   // Nombres específicos de vendedores
];

/**
 * Verifica si un nombre es una categoría válida o un filtro
 */
function isValidCategory(name, currentCategoryName, depth) {
  if (!name || name.trim().length === 0) {
    return { valid: false, reason: 'Nombre vacío' };
  }

  const cleanName = name.trim();

  // 1. Verificar si es una categoría principal dentro de otra
  if (MAIN_CATEGORIES.has(cleanName) && depth > 0) {
    return { 
      valid: false, 
      reason: `Categoría principal "${cleanName}" apareció como subcategoría (loop detectado)` 
    };
  }

  // 2. Verificar si es un filtro conocido
  for (const pattern of FILTER_PATTERNS) {
    if (pattern.test(cleanName)) {
      return { 
        valid: false, 
        reason: `Filtro detectado: "${cleanName}" (patrón: ${pattern.source})` 
      };
    }
  }

  // 3. Verificar nombres muy cortos o sospechosos
  if (cleanName.length < 3) {
    return { valid: false, reason: 'Nombre demasiado corto' };
  }

  // 4. Verificar si contiene solo números y símbolos
  if (/^[\d\s\$,.-]+$/.test(cleanName)) {
    return { valid: false, reason: 'Solo contiene números y símbolos' };
  }

  return { valid: true, reason: 'Categoría válida' };
}

/**
 * Extrae ASINs únicos de una página de productos
 */
async function extractUniqueASINs(page) {
  try {
    const asins = await page.evaluate(() => {
      const asinSet = new Set();
      
      // Buscar ASINs en atributos data-asin
      const asinElements = document.querySelectorAll('[data-asin]');
      asinElements.forEach(el => {
        const asin = el.getAttribute('data-asin');
        if (asin && asin.length === 10) {
          asinSet.add(asin);
        }
      });
      
      // Buscar ASINs en URLs de productos
      const links = document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]');
      links.forEach(link => {
        const href = link.href;
        const match = href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
        if (match) {
          asinSet.add(match[1]);
        }
      });
      
      return Array.from(asinSet);
    });
    
    return asins;
  } catch (error) {
    console.log('       ⚠️ Error extrayendo ASINs:', error.message);
    return [];
  }
}

/**
 * Valida si los productos encontrados son únicos y válidos
 */
function validateProducts(asins, expectedCount, categoryName) {
  const validation = {
    total_asins: asins.length,
    unique_asins: new Set(asins).size,
    expected_count: expectedCount,
    duplicates: asins.length - new Set(asins).size,
    is_valid: false,
    confidence: 0,
    issues: []
  };

  // Verificar duplicados
  if (validation.duplicates > 0) {
    validation.issues.push(`${validation.duplicates} ASINs duplicados`);
  }

  // Verificar si el conteo es razonable
  const countDiff = Math.abs(validation.unique_asins - expectedCount);
  const countRatio = expectedCount > 0 ? countDiff / expectedCount : 0;
  
  if (countRatio > 0.5) { // Más del 50% de diferencia
    validation.issues.push(`Diferencia significativa: esperado ~${expectedCount}, encontrado ${validation.unique_asins}`);
  }

  // Calcular confianza
  if (validation.unique_asins > 0 && validation.duplicates < validation.unique_asins * 0.2) {
    validation.confidence = Math.max(0, 1 - countRatio);
    validation.is_valid = validation.confidence >= CONFIG.PRODUCT_VALIDATION_THRESHOLD;
  }

  return validation;
}

/**
 * Scraping inteligente con validación avanzada
 */
async function intelligentScrapeCategory(browser, categoryName, expectedProducts = null) {
  console.log(`\n🎯 === INICIANDO: ${categoryName} ===`);
  
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

  // Marcar como iniciada
  category.status = 'processing';
  category.started_at = new Date().toISOString();
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));

  const page = await browser.newPage();
  
  try {
    // Cargar cookies
    const cookiesPath = path.join(__dirname, 'amazonmx.json');
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.context().addCookies(cookies);
      console.log(`🍪 ${cookies.length} cookies cargadas`);
    }

    const results = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        processing_type: 'intelligent_validation',
        expected_products: expectedProducts,
        config: CONFIG
      },
      validation: {
        category_filters_detected: 0,
        main_category_loops_avoided: 0,
        product_validation_results: []
      },
      subcategories: []
    };

    // Explorar recursivamente con validación
    await exploreWithValidation(page, category.url, categoryName, categoryName, results, 1, new Set());

    // Guardar resultados
    const filename = `${dateStr}-intelligent-${categoryName.toLowerCase().replace(/\s+/g, '-')}-${SELLER_ID}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

    // Actualizar plan
    category.status = 'completed';
    category.completed_at = new Date().toISOString();
    category.file_path = filepath;
    category.validation_result = {
      total_subcategories: results.subcategories.length,
      filters_detected: results.validation.category_filters_detected,
      loops_avoided: results.validation.main_category_loops_avoided,
      total_products: results.subcategories.reduce((sum, sub) => sum + sub.productCount, 0)
    };

    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));

    console.log(`\n📊 === RESULTADOS FINALES ===`);
    console.log(`✅ Subcategorías válidas: ${results.subcategories.length}`);
    console.log(`🚫 Filtros detectados: ${results.validation.category_filters_detected}`);
    console.log(`🔄 Loops evitados: ${results.validation.main_category_loops_avoided}`);
    console.log(`📦 Total productos: ${category.validation_result.total_products}`);
    console.log(`💾 Archivo guardado: ${filename}`);
    console.log(`✅ ${categoryName} completada exitosamente`);

  } catch (error) {
    console.error(`❌ Error procesando ${categoryName}:`, error.message);
    category.status = 'error';
    category.error = error.message;
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
  } finally {
    await page.close();
  }
}

/**
 * Exploración recursiva con validación inteligente
 */
async function exploreWithValidation(page, url, name, fullPath, results, depth, visitedUrls) {
  if (depth > CONFIG.MAX_DEPTH || visitedUrls.has(url)) {
    return;
  }

  console.log(`\n${'  '.repeat(depth-1)}🔍 Explorando: ${name}`);
  console.log(`${'  '.repeat(depth-1)}   📂 Ruta: ${fullPath}`);
  console.log(`${'  '.repeat(depth-1)}   🌐 URL: ${url}`);

  visitedUrls.add(url);

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Esperar aleatoria
    const waitTime = Math.random() * (CONFIG.MAX_WAIT - CONFIG.MIN_WAIT) + CONFIG.MIN_WAIT;
    console.log(`${'  '.repeat(depth-1)}   ⏳ Esperando ${(waitTime/1000).toFixed(2)}s...`);
    await page.waitForTimeout(waitTime);

    // Extraer conteo de productos
    const productCount = await extractProductCount(page, name, depth);
    
    if (productCount === null) {
      console.log(`${'  '.repeat(depth-1)}   ⚠️ No se pudo determinar productos, saltando...`);
      return;
    }

    console.log(`${'  '.repeat(depth-1)}   📊 Productos: ${productCount}`);
    console.log(`${'  '.repeat(depth-1)}   🎚️ Límite: ${CONFIG.MAX_PRODUCTS_PER_CATEGORY}`);

    if (productCount <= CONFIG.MAX_PRODUCTS_PER_CATEGORY) {
      // Es una categoría hoja - validar productos
      console.log(`${'  '.repeat(depth-1)}   ✅ CATEGORÍA HOJA (${productCount} ≤ ${CONFIG.MAX_PRODUCTS_PER_CATEGORY})`);
      
      // Extraer ASINs para validación
      const asins = await extractUniqueASINs(page);
      const validation = validateProducts(asins, productCount, name);
      
      console.log(`${'  '.repeat(depth-1)}   🔍 Validación: ${validation.unique_asins} ASINs únicos, confianza ${(validation.confidence * 100).toFixed(1)}%`);
      
      if (validation.issues.length > 0) {
        console.log(`${'  '.repeat(depth-1)}   ⚠️ Problemas: ${validation.issues.join(', ')}`);
      }

      results.subcategories.push({
        url,
        name,
        full_path: fullPath,
        productCount,
        asins: asins.slice(0, 10), // Solo guardar primeros 10 ASINs como muestra
        validation,
        isLeaf: true,
        depth,
        timestamp: new Date().toISOString()
      });

      results.validation.product_validation_results.push(validation);
      console.log(`${'  '.repeat(depth-1)}   💾 Guardada como hoja`);
      
    } else {
      // Necesita subdivisión
      console.log(`${'  '.repeat(depth-1)}   🌳 NECESITA SUBDIVISIÓN (${productCount} > ${CONFIG.MAX_PRODUCTS_PER_CATEGORY})`);
      
      // Extraer subcategorías con validación
      const subcategories = await extractSubcategoriesWithValidation(page, name, depth);
      
      console.log(`${'  '.repeat(depth-1)}   🔍 ${subcategories.valid.length} subcategorías válidas, ${subcategories.invalid.length} filtros detectados`);
      
      results.validation.category_filters_detected += subcategories.invalid.length;
      results.validation.main_category_loops_avoided += subcategories.loops_avoided;

      // Explorar subcategorías válidas
      for (let i = 0; i < Math.min(subcategories.valid.length, CONFIG.MAX_SUBCATEGORIES_PER_LEVEL); i++) {
        const subcat = subcategories.valid[i];
        console.log(`${'  '.repeat(depth)}📂 Subcategoría ${i+1}/${subcategories.valid.length}: ${subcat.name}`);
        
        await exploreWithValidation(
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
    console.log(`${'  '.repeat(depth-1)}   ❌ Error: ${error.message}`);
  }
}

/**
 * Extrae subcategorías con validación inteligente
 */
async function extractSubcategoriesWithValidation(page, currentCategoryName, depth) {
  const subcategories = await page.evaluate(() => {
    const results = [];
    
    // Buscar enlaces de subcategorías en varios selectores
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

  const validationResults = {
    valid: [],
    invalid: [],
    loops_avoided: 0
  };

  for (const subcat of subcategories) {
    const validation = isValidCategory(subcat.name, currentCategoryName, depth);
    
    if (validation.valid) {
      validationResults.valid.push(subcat);
    } else {
      validationResults.invalid.push({
        name: subcat.name,
        reason: validation.reason
      });
      
      if (validation.reason.includes('loop detectado')) {
        validationResults.loops_avoided++;
      }
      
      console.log(`      🚫 Filtro/Loop: ${subcat.name} (${validation.reason})`);
    }
  }

  return validationResults;
}

/**
 * Extrae el conteo de productos de la página
 */
async function extractProductCount(page, categoryName, depth) {
  try {
    const productInfo = await page.evaluate(() => {
      const texts = [];
      
      // Selectores para encontrar el conteo
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

    console.log(`${'  '.repeat(depth-1)}📊 Extrayendo conteo de: ${categoryName}`);
    
    for (const text of productInfo) {
      console.log(`${'  '.repeat(depth-1)}   ✅ Texto: "${text}"`);
      
      // Patrones para extraer números
      const patterns = [
        /(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
        /1-\d+\s+de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i,
        /más de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ''));
          console.log(`${'  '.repeat(depth-1)}   🎯 Productos detectados: ${count}`);
          return count;
        }
      }
    }
    
    console.log(`${'  '.repeat(depth-1)}   ⚠️ No se pudo extraer conteo`);
    return null;
    
  } catch (error) {
    console.log(`${'  '.repeat(depth-1)}   ❌ Error extrayendo conteo: ${error.message}`);
    return null;
  }
}

/**
 * Ejecutar prueba inteligente completa
 */
async function runIntelligentTest() {
  console.log('🚀 === INICIANDO PRUEBA INTELIGENTE CON VALIDACIÓN ===');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    const pendingCategories = plan.categories.filter(cat => cat.status === 'pending');
    
    console.log(`📋 ${pendingCategories.length} categorías pendientes`);
    
    for (const category of pendingCategories) {
      await intelligentScrapeCategory(browser, category.name, category.expected_products);
    }
    
    console.log('\n🎉 === PRUEBA INTELIGENTE COMPLETADA ===');
    
  } catch (error) {
    console.error('❌ Error en prueba inteligente:', error);
  } finally {
    await browser.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runIntelligentTest();
}

module.exports = { 
  runIntelligentTest, 
  intelligentScrapeCategory,
  isValidCategory, 
  validateProducts, 
  CONFIG,
  MAIN_CATEGORIES,
  FILTER_PATTERNS 
};