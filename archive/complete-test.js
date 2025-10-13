const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = 'A338WHNLA63C6H';
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const MAX_PRODUCTS_PER_CATEGORY = 320; // Amazon muestra máximo 320 resultados
const MAX_DEPTH = 3;
const MAX_SUBCATEGORIES_TO_PROCESS = 15; // Límite por seguridad

// Archivos y directorios
const today = new Date();
const dateStr = today.toISOString().split('T')[0];
const OUTPUT_DIR = path.join(__dirname, 'data', 'categories');
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const PLAN_FILE = path.join(OUTPUT_DIR, `${dateStr}-plan-${SELLER_ID}.json`);

// Variables globales para evitar repeticiones
let visitedUrls = new Set();
let currentResults = [];

/**
 * Carga cookies con validación
 */
function loadCookies() {
  console.log('🍪 === CARGANDO COOKIES ===');
  try {
    const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    console.log(`✅ ${cookieData.cookies.length} cookies cargadas`);
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
 * Extrae número de productos con logging
 */
async function extractProductCount(page, categoryName, indent = '') {
  console.log(`${indent}📊 Extrayendo conteo de: ${categoryName}`);
  
  try {
    await page.waitForSelector('h2, .s-result-count', { timeout: 10000 });
    await page.waitForTimeout(1500);
    
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
            /\d+\s*-\s*\d+\s+de/i.test(trimmedText)
          )) {
          
          console.log(`${indent}   ✅ Texto: "${trimmedText}"`);
          
          // Extraer número
          let match = trimmedText.match(/de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
          
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
              console.log(`${indent}   🎯 Productos detectados: ${number}`);
              return number;
            }
          }
        }
      }
    }
    
    console.log(`${indent}   ⚠️ No se pudo extraer conteo`);
    return null;
  } catch (error) {
    console.error(`${indent}   ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Extrae subcategorías de una página
 */
async function extractSubcategories(page, indent = '') {
  try {
    console.log(`${indent}🔍 Extrayendo subcategorías...`);
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
          // Continuar
        }
      }
      
      if (categories.length > 0) break;
    }
    
    // Eliminar duplicados y limitar
    const uniqueCategories = categories
      .filter((cat, index, self) => 
        index === self.findIndex(c => normalizeUrl(c.url) === normalizeUrl(cat.url))
      )
      .slice(0, MAX_SUBCATEGORIES_TO_PROCESS);
    
    console.log(`${indent}   ✅ ${uniqueCategories.length} subcategorías encontradas`);
    return uniqueCategories;
  } catch (error) {
    console.error(`${indent}   ❌ Error extrayendo subcategorías: ${error.message}`);
    return [];
  }
}

/**
 * Explora una categoría recursivamente con control de profundidad
 */
async function exploreCategory(page, categoryUrl, categoryName, depth = 0, parentPath = '') {
  const indent = '  '.repeat(depth);
  const fullPath = parentPath ? `${parentPath} > ${categoryName}` : categoryName;
  
  // Límites de seguridad
  if (depth > MAX_DEPTH) {
    console.log(`${indent}⏹️ Profundidad máxima alcanzada (${depth})`);
    return;
  }
  
  const normalizedUrl = normalizeUrl(categoryUrl);
  
  if (visitedUrls.has(normalizedUrl)) {
    console.log(`${indent}⏭️ URL ya visitada, saltando...`);
    return;
  }
  
  visitedUrls.add(normalizedUrl);
  console.log(`${indent}🔍 Explorando: ${categoryName}`);
  console.log(`${indent}   📂 Ruta: ${fullPath}`);
  console.log(`${indent}   🌐 URL: ${categoryUrl}`);

  try {
    // Navegar a la categoría
    await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Timing anti-bot
    const delay = Math.floor(Math.random() * 3000) + 2000;
    console.log(`${indent}   ⏳ Esperando ${delay / 1000}s...`);
    await page.waitForTimeout(delay);
    
    // Simular actividad
    try {
      await page.mouse.move(200, 300);
      await page.waitForTimeout(300);
      await page.evaluate(() => window.scrollTo({ top: 50, behavior: 'smooth' }));
    } catch (e) {
      // Ignorar errores de simulación
    }

    // Extraer número de productos
    const productCount = await extractProductCount(page, categoryName, indent);
    
    if (productCount === null) {
      console.log(`${indent}   ⚠️ No se pudo determinar productos, saltando...`);
      return;
    }

    console.log(`${indent}   📊 Productos: ${productCount}`);
    console.log(`${indent}   🎚️ Límite: ${MAX_PRODUCTS_PER_CATEGORY}`);

    // Decisión: ¿Es categoría hoja?
    if (productCount <= MAX_PRODUCTS_PER_CATEGORY) {
      console.log(`${indent}   ✅ CATEGORÍA HOJA (${productCount} ≤ ${MAX_PRODUCTS_PER_CATEGORY})`);
      
      const leafCategory = {
        url: categoryUrl,
        name: categoryName,
        full_path: fullPath,
        productCount: productCount,
        isLeaf: true,
        depth: depth,
        timestamp: new Date().toISOString()
      };
      
      currentResults.push(leafCategory);
      console.log(`${indent}   💾 Guardada como hoja`);
      return;
    }

    // Si tiene muchos productos, buscar subcategorías
    console.log(`${indent}   🌳 NECESITA SUBDIVISIÓN (${productCount} > ${MAX_PRODUCTS_PER_CATEGORY})`);
    const subcategories = await extractSubcategories(page, indent);

    if (subcategories.length === 0) {
      console.log(`${indent}   ⚠️ Sin subcategorías, forzando como hoja`);
      currentResults.push({
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

    console.log(`${indent}   🔄 Explorando ${subcategories.length} subcategorías...`);
    
    // Explorar subcategorías de forma controlada
    for (let i = 0; i < subcategories.length; i++) {
      const subcat = subcategories[i];
      console.log(`${indent}   \n${indent}📂 Subcategoría ${i + 1}/${subcategories.length}: ${subcat.name}`);
      
      // Verificar que no sea la misma URL
      const subcatNormalized = normalizeUrl(subcat.url);
      if (subcatNormalized === normalizedUrl) {
        console.log(`${indent}      ⚠️ URL igual a la actual, saltando...`);
        continue;
      }
      
      try {
        await exploreCategory(page, subcat.url, subcat.name, depth + 1, fullPath);
      } catch (subcatError) {
        console.log(`${indent}      ❌ Error: ${subcatError.message}`);
        
        // Guardar subcategoría con error
        currentResults.push({
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

  } catch (error) {
    console.error(`${indent}❌ Error explorando ${categoryName}: ${error.message}`);
  }
}

/**
 * Procesa una categoría completamente
 */
async function processCompleteCateogry(page, category) {
  console.log(`\n🚀 === PROCESAMIENTO COMPLETO: ${category.name} ===`);
  console.log(`📊 Productos esperados: ${category.expected_products || 'N/A'}`);
  console.log(`🎯 Límite configurado: ${MAX_PRODUCTS_PER_CATEGORY}`);
  
  // Limpiar variables globales
  currentResults = [];
  visitedUrls.clear();
  
  // Explorar la categoría completamente
  await exploreCategory(page, category.url, category.name, 0);
  
  // Calcular estadísticas
  const totalProducts = currentResults.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
  const leafCount = currentResults.filter(cat => cat.isLeaf).length;
  const branchCount = currentResults.filter(cat => !cat.isLeaf).length;
  
  console.log(`\n📊 === RESULTADOS FINALES ===`);
  console.log(`✅ Subcategorías procesadas: ${currentResults.length}`);
  console.log(`🌿 Categorías hoja: ${leafCount}`);
  console.log(`🌳 Categorías rama: ${branchCount}`);
  console.log(`📦 Total productos: ${totalProducts}`);
  console.log(`🎯 Esperado vs Real: ${category.expected_products} vs ${totalProducts}`);
  
  if (category.expected_products) {
    const difference = Math.abs(category.expected_products - totalProducts);
    const percentage = (difference / category.expected_products) * 100;
    console.log(`📈 Diferencia: ${difference} (${percentage.toFixed(1)}%)`);
  }
  
  return [...currentResults]; // Retornar copia
}

/**
 * Guarda resultados con metadata completa
 */
function saveCompleteResults(categoryName, results, expectedProducts) {
  try {
    const cleanName = categoryName.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const fileName = `${dateStr}-complete-${cleanName}-${SELLER_ID}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    
    const totalProducts = results.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        processing_type: 'complete_recursive_exploration',
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        max_depth: MAX_DEPTH,
        max_subcategories_per_level: MAX_SUBCATEGORIES_TO_PROCESS,
        status: "completed",
        validation: {
          expected_products: expectedProducts,
          actual_products: totalProducts,
          difference: expectedProducts ? Math.abs(expectedProducts - totalProducts) : 0,
          is_valid: !expectedProducts || Math.abs(expectedProducts - totalProducts) <= expectedProducts * 0.15
        },
        statistics: {
          total_subcategories: results.length,
          leaf_categories: results.filter(r => r.isLeaf).length,
          branch_categories: results.filter(r => !r.isLeaf).length,
          max_depth_reached: Math.max(...results.map(r => r.depth || 0), 0),
          unique_urls: [...new Set(results.map(r => r.url))].length
        }
      },
      subcategories: results
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    
    console.log(`💾 Archivo completo guardado: ${fileName}`);
    console.log(`📊 ${results.length} subcategorías, ${totalProducts} productos`);
    
    return filePath;
  } catch (error) {
    console.error('❌ Error guardando:', error.message);
    return null;
  }
}

/**
 * Función principal para prueba completa
 */
async function completeTest() {
  console.log('🎯 === PRUEBA COMPLETA CON EXTRACCIÓN RECURSIVA ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  console.log(`🎯 Profundidad máxima: ${MAX_DEPTH} niveles`);
  console.log(`🎯 Subcategorías máx por nivel: ${MAX_SUBCATEGORIES_TO_PROCESS}`);
  
  const cookies = loadCookies();
  if (!cookies) return;
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });
  
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    // Cargar plan
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    console.log(`\n📋 Plan cargado: ${plan.total_categories} categorías`);
    
    // Mostrar estado del plan
    const completed = plan.categories.filter(cat => cat.status === 'completed').length;
    const pending = plan.categories.filter(cat => cat.status === 'pending').length;
    
    console.log(`✅ Completadas: ${completed}`);
    console.log(`⏳ Pendientes: ${pending}`);
    
    // Procesar todas las categorías pendientes
    for (const category of plan.categories) {
      if (category.status === 'pending') {
        console.log(`\n🎯 === INICIANDO: ${category.name} ===`);
        
        // Marcar como en progreso
        category.status = 'in_progress';
        category.started_at = new Date().toISOString();
        fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
        
        try {
          // Procesar completamente
          const results = await processCompleteCateogry(page, category);
          
          if (results && results.length > 0) {
            // Guardar resultados
            const filePath = saveCompleteResults(category.name, results, category.expected_products);
            
            // Actualizar plan
            const totalProducts = results.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
            
            category.status = 'completed';
            category.completed_at = new Date().toISOString();
            category.file_path = filePath ? path.basename(filePath) : null;
            category.subcategories_found = results.length;
            category.validation_result = {
              expected: category.expected_products,
              found: totalProducts,
              difference: Math.abs((category.expected_products || 0) - totalProducts),
              is_valid: !category.expected_products || Math.abs((category.expected_products || 0) - totalProducts) <= (category.expected_products || 0) * 0.15
            };
            
            fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
            
            console.log(`✅ ${category.name} completada exitosamente`);
          } else {
            console.log(`⚠️ ${category.name} sin resultados válidos`);
            category.status = 'completed';
            category.completed_at = new Date().toISOString();
            category.subcategories_found = 0;
          }
          
        } catch (categoryError) {
          console.error(`❌ Error procesando ${category.name}:`, categoryError.message);
          category.status = 'error';
          category.error = categoryError.message;
          fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
        }
      }
    }
    
    // Resumen final
    const finalCompleted = plan.categories.filter(cat => cat.status === 'completed').length;
    const totalProducts = plan.categories
      .filter(cat => cat.validation_result)
      .reduce((sum, cat) => sum + (cat.validation_result.found || 0), 0);
    
    console.log(`\n🎉 === PRUEBA COMPLETA FINALIZADA ===`);
    console.log(`✅ Categorías completadas: ${finalCompleted}/${plan.total_categories}`);
    console.log(`📦 Total productos procesados: ${totalProducts}`);
    console.log(`📁 Archivos generados en: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Error principal:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar
if (require.main === module) {
  completeTest().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { completeTest };