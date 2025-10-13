const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = 'A338WHNLA63C6H';
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const MAX_PRODUCTS_PER_CATEGORY = 320; // Amazon muestra máximo 320 resultados por página
const MAX_DEPTH = 3;
const MAX_SUBCATEGORIES_TO_PROCESS = 20; // Límite de subcategorías por nivel

// Archivos y directorios
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

// Archivos para planes jerárquicos
const PLANS_DIR = path.join(OUTPUT_DIR, 'plans');
if (!fs.existsSync(PLANS_DIR)) {
  fs.mkdirSync(PLANS_DIR, { recursive: true });
}

// Variables globales
let visitedUrls = new Set();
let currentCategoryResults = [];

/**
 * Carga las cookies de autenticación
 */
function loadCookies() {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.error('❌ Archivo de cookies no encontrado:', COOKIES_FILE);
      return null;
    }
    
    const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    console.log(`✅ Cookies cargadas: ${cookieData.cookies.length}`);
    return cookieData.cookies;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
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
    await page.waitForSelector('h2, .s-result-count, [data-component-type="s-result-info-bar"]', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      'h2[class*="a-size-base"][class*="a-spacing-small"]',
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
            /\d+\s*-\s*\d+\s+de/i.test(trimmedText)
          )) {
          
          console.log(`✅ Texto: "${trimmedText}"`);
          
          // Extraer número mejorado
          let match = null;
          match = trimmedText.match(/de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
          
          if (!match) {
            match = trimmedText.match(/\d+\s*-\s*\d+\s+de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)/i);
          }
          
          if (!match) {
            match = trimmedText.match(/^(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
          }
          
          if (match) {
            let numberStr = match[1].replace(/[,\.]/g, '');
            const number = parseInt(numberStr, 10);
            if (!isNaN(number)) {
              console.log(`🎯 Productos: ${number}`);
              return number;
            }
          }
        }
      }
    }
    
    console.log('⚠️ No se pudo extraer número de productos');
    return null;
  } catch (error) {
    console.error('❌ Error al extraer conteo:', error.message);
    return null;
  }
}

/**
 * Extrae subcategorías de una página
 */
async function extractSubcategories(page) {
  try {
    console.log('🔍 Extrayendo subcategorías...');
    const categories = [];
    
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]', 
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]'
    ];

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
              url: fullUrl,
              name: trimmedText
            });
          }
        } catch (e) {
          // Continúar
        }
      }
      
      if (categories.length > 0) break;
    }
    
    // Eliminar duplicados y limitar cantidad
    const uniqueCategories = categories
      .filter((cat, index, self) => 
        index === self.findIndex(c => normalizeUrl(c.url) === normalizeUrl(cat.url))
      )
      .slice(0, MAX_SUBCATEGORIES_TO_PROCESS);
    
    console.log(`✅ ${uniqueCategories.length} subcategorías encontradas`);
    return uniqueCategories;
  } catch (error) {
    console.error('❌ Error extrayendo subcategorías:', error.message);
    return [];
  }
}

/**
 * Crea un plan jerárquico para una categoría con muchos productos
 */
async function createHierarchicalPlan(page, categoryName, categoryUrl, expectedProducts) {
  console.log(`\n📋 === CREANDO PLAN JERÁRQUICO PARA: ${categoryName} ===`);
  console.log(`📊 Productos esperados: ${expectedProducts}`);
  
  try {
    // Navegar a la categoría
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Verificar productos actuales
    const currentProducts = await extractProductCount(page);
    console.log(`📊 Productos actuales: ${currentProducts}`);
    
    if (!currentProducts || currentProducts <= MAX_PRODUCTS_PER_CATEGORY) {
      console.log(`✅ No necesita plan jerárquico (≤${MAX_PRODUCTS_PER_CATEGORY})`);
      return null;
    }
    
    // Extraer subcategorías
    const subcategories = await extractSubcategories(page);
    
    if (subcategories.length === 0) {
      console.log(`⚠️ No se encontraron subcategorías para dividir`);
      return null;
    }
    
    console.log(`🔄 Analizando ${subcategories.length} subcategorías...`);
    
    // Crear plan jerárquico
    const hierarchicalPlan = {
      parent_category: categoryName,
      parent_url: categoryUrl,
      expected_products: expectedProducts,
      current_products: currentProducts,
      created_at: new Date().toISOString(),
      status: 'created',
      subcategories: []
    };
    
    // Analizar cada subcategoría
    for (let i = 0; i < Math.min(subcategories.length, 10); i++) {
      const subcat = subcategories[i];
      console.log(`\n📂 ${i + 1}/${subcategories.length}: ${subcat.name}`);
      
      try {
        await page.goto(subcat.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const subcatProducts = await extractProductCount(page);
        
        const subcategoryPlan = {
          index: i,
          name: subcat.name,
          url: subcat.url,
          expected_products: subcatProducts,
          status: 'pending',
          needs_subdivision: subcatProducts ? subcatProducts > MAX_PRODUCTS_PER_CATEGORY : false
        };
        
        hierarchicalPlan.subcategories.push(subcategoryPlan);
        console.log(`   📊 ${subcatProducts || 'N/A'} productos${subcatProducts > MAX_PRODUCTS_PER_CATEGORY ? ' (necesita subdivisión)' : ''}`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        hierarchicalPlan.subcategories.push({
          index: i,
          name: subcat.name,
          url: subcat.url,
          expected_products: null,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Guardar plan jerárquico
    const cleanName = categoryName.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const planFileName = `${dateStr}-plan-${cleanName}-${SELLER_ID}.json`;
    const planFilePath = path.join(PLANS_DIR, planFileName);
    
    fs.writeFileSync(planFilePath, JSON.stringify(hierarchicalPlan, null, 2));
    
    console.log(`\n✅ === PLAN JERÁRQUICO CREADO ===`);
    console.log(`📊 ${hierarchicalPlan.subcategories.length} subcategorías planificadas`);
    console.log(`💾 Guardado en: plans/${planFileName}`);
    
    const needsSubdivision = hierarchicalPlan.subcategories.filter(sub => sub.needs_subdivision).length;
    if (needsSubdivision > 0) {
      console.log(`⚠️ ${needsSubdivision} subcategorías necesitarán subdivisión adicional`);
    }
    
    return planFilePath;
    
  } catch (error) {
    console.error('❌ Error creando plan jerárquico:', error.message);
    return null;
  }
}

/**
 * Procesa una categoría usando plan jerárquico
 */
async function processCategoryWithHierarchicalPlan(page, categoryName, categoryUrl, expectedProducts) {
  console.log(`\n🎯 === PROCESANDO CON PLAN JERÁRQUICO: ${categoryName} ===`);
  
  // Crear plan jerárquico primero
  const planPath = await createHierarchicalPlan(page, categoryName, categoryUrl, expectedProducts);
  
  if (!planPath) {
    console.log('📝 No se necesita plan jerárquico, procesando directamente...');
    return await processSimpleCategory(page, categoryName, categoryUrl, expectedProducts);
  }
  
  // Cargar y procesar plan jerárquico
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const results = [];
  
  console.log(`\n🔄 Procesando ${plan.subcategories.length} subcategorías del plan...`);
  
  for (const subcat of plan.subcategories) {
    if (subcat.status === 'error' || !subcat.expected_products) {
      console.log(`⏭️ Saltando ${subcat.name} (error o sin productos)`);
      continue;
    }
    
    console.log(`\n📂 Procesando: ${subcat.name} (${subcat.expected_products} productos)`);
    
    try {
      await page.goto(subcat.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const actualProducts = await extractProductCount(page);
      
      if (actualProducts && actualProducts <= MAX_PRODUCTS_PER_CATEGORY) {
        // Es una categoría hoja
        results.push({
          url: subcat.url,
          name: subcat.name,
          full_path: `${categoryName} > ${subcat.name}`,
          productCount: actualProducts,
          isLeaf: true,
          depth: 1,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ HOJA: ${actualProducts} productos`);
      } else if (actualProducts > MAX_PRODUCTS_PER_CATEGORY) {
        console.log(`⚠️ ${subcat.name} aún tiene muchos productos (${actualProducts}), necesita más subdivisión`);
        // Aquí podrías crear otro plan jerárquico recursivamente si es necesario
        results.push({
          url: subcat.url,
          name: subcat.name,
          full_path: `${categoryName} > ${subcat.name}`,
          productCount: actualProducts,
          isLeaf: false,
          depth: 1,
          reason: 'needs_further_subdivision',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.log(`❌ Error procesando ${subcat.name}: ${error.message}`);
    }
  }
  
  // Marcar plan como completado
  plan.status = 'completed';
  plan.completed_at = new Date().toISOString();
  plan.results_count = results.length;
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  
  console.log(`\n✅ Plan jerárquico completado: ${results.length} resultados`);
  return results;
}

/**
 * Procesa una categoría simple (≤MAX_PRODUCTS_PER_CATEGORY)
 */
async function processSimpleCategory(page, categoryName, categoryUrl, expectedProducts) {
  console.log(`📝 Procesando categoría simple: ${categoryName}`);
  
  await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const actualProducts = await extractProductCount(page);
  
  return [{
    url: categoryUrl,
    name: categoryName,
    full_path: categoryName,
    productCount: actualProducts,
    isLeaf: true,
    depth: 0,
    timestamp: new Date().toISOString()
  }];
}

/**
 * Función principal mejorada
 */
async function smartMain() {
  console.log('🧠 === EXPLORADOR INTELIGENTE CON PLANES JERÁRQUICOS ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  console.log(`🎯 Máx subcategorías por nivel: ${MAX_SUBCATEGORIES_TO_PROCESS}`);
  
  const cookies = loadCookies();
  if (!cookies) return;
  
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
    // Cargar plan principal
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    const nextCategory = plan.categories.find(cat => cat.status === 'pending');
    
    if (!nextCategory) {
      console.log('🎉 ¡Todas las categorías completadas!');
      return;
    }
    
    console.log(`\n🚀 === PROCESANDO: ${nextCategory.name} ===`);
    console.log(`📊 Productos esperados: ${nextCategory.expected_products}`);
    
    // Marcar como en progreso
    nextCategory.status = 'in_progress';
    nextCategory.started_at = new Date().toISOString();
    plan.last_updated = new Date().toISOString();
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    
    let results = [];
    
    if (nextCategory.expected_products > MAX_PRODUCTS_PER_CATEGORY) {
      // Usar plan jerárquico
      results = await processCategoryWithHierarchicalPlan(
        page, 
        nextCategory.name, 
        nextCategory.url, 
        nextCategory.expected_products
      );
    } else {
      // Procesamiento simple
      results = await processSimpleCategory(
        page, 
        nextCategory.name, 
        nextCategory.url, 
        nextCategory.expected_products
      );
    }
    
    // Guardar resultados
    const totalProducts = results.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    
    const cleanName = nextCategory.name.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const fileName = `${dateStr}-${cleanName}-${SELLER_ID}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: nextCategory.name,
        date_scraped: new Date().toISOString(),
        total_subcategories: results.length,
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        status: "completed",
        processing_method: nextCategory.expected_products > MAX_PRODUCTS_PER_CATEGORY ? 'hierarchical_plan' : 'simple',
        validation: {
          is_complete: true,
          expected_products: nextCategory.expected_products,
          actual_products: totalProducts,
          difference: Math.abs((nextCategory.expected_products || 0) - totalProducts)
        },
        statistics: {
          total_products: totalProducts,
          leaf_categories: results.filter(r => r.isLeaf).length,
          branch_categories: results.filter(r => !r.isLeaf).length
        }
      },
      subcategories: results
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    
    // Actualizar plan principal
    nextCategory.status = 'completed';
    nextCategory.completed_at = new Date().toISOString();
    nextCategory.file_path = fileName;
    nextCategory.subcategories_found = results.length;
    nextCategory.validation_result = {
      expected: nextCategory.expected_products,
      found: totalProducts,
      difference: Math.abs((nextCategory.expected_products || 0) - totalProducts),
      is_valid: Math.abs((nextCategory.expected_products || 0) - totalProducts) <= (nextCategory.expected_products || 0) * 0.2
    };
    
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    
    console.log(`\n✅ === CATEGORÍA COMPLETADA ===`);
    console.log(`📊 ${results.length} subcategorías, ${totalProducts} productos`);
    console.log(`💾 Archivo: ${fileName}`);
    
    const remaining = plan.categories.filter(cat => cat.status === 'pending').length;
    console.log(`\n📊 Progreso: ${plan.categories.length - remaining}/${plan.categories.length}`);
    
    if (remaining > 0) {
      console.log(`🚀 Ejecuta 'node category-smart.js' para continuar`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar
if (require.main === module) {
  smartMain().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { smartMain };