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
      const ageHours = (Date.now() / 1000 - sessionCookie.expires + (24 * 60 * 60)) / 3600;
      console.log(`⏰ Edad de cookies: ${ageHours.toFixed(1)} horas`);
      
      if (ageHours > 8) {
        console.log('⚠️ Cookies pueden estar expiradas. Considera ejecutar: node scripts/a-login.js');
      }
    }
    
    console.log('✅ Cookies listas para usar\n');
    return cookieData.cookies;
    
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Extrae el número de productos de una página con logging detallado
 */
async function extractProductCountWithLogging(page, categoryName) {
  console.log(`\n📊 === EXTRAYENDO CONTEO DE: ${categoryName} ===`);
  
  try {
    // Esperar a que cargue la página
    console.log('⏳ Esperando elementos de conteo...');
    await page.waitForSelector('h2, .s-result-count, [data-component-type="s-result-info-bar"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      'h2[class*="a-size-base"][class*="a-spacing-small"]',
      '.a-section.a-spacing-none.s-breadcrumb-with-all-filters h2',
      'h2',
      '.a-size-base'
    ];

    console.log('🔍 Buscando texto de conteo en elementos...');
    
    for (let selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      const selector = selectors[selectorIndex];
      console.log(`   Probando selector ${selectorIndex + 1}/${selectors.length}: ${selector}`);
      
      const elements = await page.$$(selector);
      console.log(`   → Encontrados ${elements.length} elementos`);
      
      for (let elemIndex = 0; elemIndex < elements.length; elemIndex++) {
        const element = elements[elemIndex];
        const text = await element.textContent();
        const trimmedText = text ? text.trim() : '';
        
        if (trimmedText.length > 0 && trimmedText.length < 200) {
          console.log(`   📝 Elemento ${elemIndex + 1}: "${trimmedText}"`);
          
          // Verificar si contiene información de productos
          if (trimmedText && (
              trimmedText.includes('resultado') || 
              trimmedText.includes('de ') || 
              trimmedText.includes('producto') ||
              /\d+\s*-\s*\d+\s+de/i.test(trimmedText) ||
              trimmedText.includes('más de')
            )) {
            
            console.log(`   ✅ ¡TEXTO DE CONTEO ENCONTRADO!: "${trimmedText}"`);
            
            // Extraer número con regex mejorado
            let match = null;
            let extractedNumber = null;
            
            // Buscar primero "de [número] resultado"
            match = trimmedText.match(/de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
            if (match) {
              console.log(`   🎯 Patrón "de X resultado": "${match[0]}"`);
              extractedNumber = match[1];
            }
            
            if (!match) {
              // Buscar patrón "X-Y de Z"
              match = trimmedText.match(/\d+\s*-\s*\d+\s+de\s+(?:más de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)/i);
              if (match) {
                console.log(`   🎯 Patrón "X-Y de Z": "${match[0]}"`);
                extractedNumber = match[1];
              }
            }
            
            if (!match) {
              // Buscar solo número seguido de "resultado"
              match = trimmedText.match(/^(\d{1,3}(?:[,\.]\d{3})*|\d+)\s+resultado/i);
              if (match) {
                console.log(`   🎯 Patrón "X resultado": "${match[0]}"`);
                extractedNumber = match[1];
              }
            }
            
            if (extractedNumber) {
              let numberStr = extractedNumber.replace(/[,\.]/g, '');
              
              // Si es "más de X", usar X + margen
              if (trimmedText.toLowerCase().includes('más de')) {
                const baseNumber = parseInt(numberStr, 10);
                if (!isNaN(baseNumber)) {
                  const adjustedNumber = Math.floor(baseNumber * 1.1); // +10% para "más de"
                  console.log(`   📈 Ajuste "más de": ${baseNumber} → ${adjustedNumber}`);
                  console.log(`   ✅ NÚMERO FINAL EXTRAÍDO: ${adjustedNumber} productos\n`);
                  return adjustedNumber;
                }
              }
              
              const number = parseInt(numberStr, 10);
              if (!isNaN(number)) {
                console.log(`   ✅ NÚMERO FINAL EXTRAÍDO: ${number} productos\n`);
                return number;
              }
            }
          }
        }
      }
    }
    
    console.log('   ❌ No se encontró texto de conteo válido');
    console.log('   ⚠️ NÚMERO DE PRODUCTOS: No detectado\n');
    return null;
    
  } catch (error) {
    console.error(`   ❌ Error al extraer conteo: ${error.message}`);
    console.log('   ⚠️ NÚMERO DE PRODUCTOS: Error\n');
    return null;
  }
}

/**
 * Procesa una categoría con logging detallado
 */
async function processCategoryWithDetailedLogging(page, category) {
  console.log(`\n🚀 === PROCESANDO CATEGORÍA: ${category.name} ===`);
  console.log(`📂 URL: ${category.url}`);
  console.log(`📊 Productos esperados: ${category.expected_products || 'N/A'}`);
  
  try {
    // Navegar a la categoría
    console.log('🌐 Navegando a la categoría...');
    await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Timing anti-detección
    const delay = Math.floor(Math.random() * 3000) + 2000;
    console.log(`⏳ Esperando ${delay / 1000}s (anti-detección)...`);
    await page.waitForTimeout(delay);
    
    // Simular actividad humana
    try {
      console.log('🖱️ Simulando actividad humana...');
      await page.mouse.move(200, 300);
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('⚠️ Error en simulación (no crítico)');
    }

    // Extraer número de productos con logging detallado
    const actualProducts = await extractProductCountWithLogging(page, category.name);
    
    if (actualProducts === null) {
      console.log('❌ No se pudo determinar el número de productos');
      return null;
    }
    
    // Determinar método de procesamiento
    console.log(`\n🎯 === ANÁLISIS DE PROCESAMIENTO ===`);
    console.log(`📊 Productos detectados: ${actualProducts}`);
    console.log(`🎚️ Límite configurado: ${MAX_PRODUCTS_PER_CATEGORY}`);
    
    if (actualProducts <= MAX_PRODUCTS_PER_CATEGORY) {
      console.log(`✅ PROCESAMIENTO DIRECTO (${actualProducts} ≤ ${MAX_PRODUCTS_PER_CATEGORY})`);
      console.log(`📝 Esta categoría se guarda como HOJA final`);
      
      const result = {
        url: category.url,
        name: category.name,
        full_path: category.name,
        productCount: actualProducts,
        isLeaf: true,
        depth: 0,
        processing_method: 'direct',
        timestamp: new Date().toISOString()
      };
      
      return [result];
    } else {
      console.log(`🌳 NECESITA SUBDIVISIÓN (${actualProducts} > ${MAX_PRODUCTS_PER_CATEGORY})`);
      console.log(`📋 Se requiere crear plan jerárquico para esta categoría`);
      
      // Aquí iría la lógica de plan jerárquico, por ahora lo marcamos
      const result = {
        url: category.url,
        name: category.name,
        full_path: category.name,
        productCount: actualProducts,
        isLeaf: false,
        depth: 0,
        processing_method: 'needs_hierarchical_plan',
        reason: `Excede límite: ${actualProducts} > ${MAX_PRODUCTS_PER_CATEGORY}`,
        timestamp: new Date().toISOString()
      };
      
      return [result];
    }
    
  } catch (error) {
    console.error(`❌ Error procesando ${category.name}:`, error.message);
    return null;
  }
}

/**
 * Guarda los resultados con validación
 */
function saveResultsWithValidation(categoryName, results, expectedProducts) {
  console.log(`\n💾 === GUARDANDO RESULTADOS: ${categoryName} ===`);
  
  try {
    const cleanName = categoryName.toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const fileName = `${dateStr}-${cleanName}-${SELLER_ID}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    
    // Calcular estadísticas
    const totalProducts = results.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    const leafCategories = results.filter(cat => cat.isLeaf);
    const branchCategories = results.filter(cat => !cat.isLeaf);
    
    // Validación
    const validation = {
      is_complete: true,
      expected_products: expectedProducts,
      actual_products: totalProducts,
      difference: expectedProducts ? Math.abs(expectedProducts - totalProducts) : 0,
      difference_percentage: expectedProducts ? Math.abs((expectedProducts - totalProducts) / expectedProducts) * 100 : 0
    };
    
    if (expectedProducts && Math.abs(expectedProducts - totalProducts) > expectedProducts * 0.1) {
      validation.is_complete = false;
      validation.warning = `Diferencia significativa: esperado ${expectedProducts}, encontrado ${totalProducts}`;
    }
    
    console.log(`📊 Estadísticas calculadas:`);
    console.log(`   • Total productos: ${totalProducts}`);
    console.log(`   • Subcategorías hoja: ${leafCategories.length}`);
    console.log(`   • Subcategorías rama: ${branchCategories.length}`);
    console.log(`   • Diferencia con esperado: ${validation.difference} (${validation.difference_percentage.toFixed(1)}%)`);
    
    const fileData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: categoryName,
        date_scraped: new Date().toISOString(),
        total_subcategories: results.length,
        max_products_per_category: MAX_PRODUCTS_PER_CATEGORY,
        status: "completed",
        validation: validation,
        statistics: {
          total_products: totalProducts,
          leaf_categories: leafCategories.length,
          branch_categories: branchCategories.length
        }
      },
      subcategories: results
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    
    console.log(`✅ Archivo guardado: ${fileName}`);
    console.log(`📁 Ruta completa: ${filePath}`);
    
    if (!validation.is_complete) {
      console.log(`⚠️ ${validation.warning}`);
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
 * Función principal con logging detallado
 */
async function detailedTestMain() {
  console.log('🧪 === PRUEBA DETALLADA CON LOGGING COMPLETO ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🎯 Límite por categoría: ${MAX_PRODUCTS_PER_CATEGORY} productos`);
  console.log(`📅 Fecha: ${dateStr}`);
  
  // Cargar cookies con validación completa
  const cookies = loadCookies();
  if (!cookies) {
    console.error('💥 No se pudieron cargar las cookies. Abortando.');
    return;
  }
  
  // Configurar navegador
  console.log('🚀 === CONFIGURANDO NAVEGADOR ===');
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });
  
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.8,en-US;q=0.5,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  };
  
  const context = await browser.newContext(contextOptions);
  await context.addCookies(cookies);
  console.log(`✅ Navegador configurado con ${cookies.length} cookies`);
  
  const page = await context.newPage();

  try {
    // Cargar plan
    console.log('\n📋 === CARGANDO PLAN DE PRUEBA ===');
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    
    console.log(`📊 Plan cargado:`);
    console.log(`   • Total categorías: ${plan.total_categories}`);
    console.log(`   • Modo prueba: ${plan.test_mode ? 'SÍ' : 'NO'}`);
    
    // Mostrar categorías del plan
    console.log('\n📂 Categorías en el plan:');
    plan.categories.forEach((cat, i) => {
      const status = cat.status === 'completed' ? '✅' : 
                    cat.status === 'in_progress' ? '🔄' : '⏳';
      console.log(`   ${i + 1}. ${status} ${cat.name} (${cat.expected_products || 'N/A'} productos)`);
    });
    
    // Encontrar siguiente categoría pendiente
    const nextCategory = plan.categories.find(cat => cat.status === 'pending');
    
    if (!nextCategory) {
      console.log('\n🎉 ¡Todas las categorías ya fueron procesadas!');
      
      // Mostrar resumen final
      const completed = plan.categories.filter(cat => cat.status === 'completed');
      console.log(`\n📊 Resumen: ${completed.length}/${plan.categories.length} completadas`);
      return;
    }
    
    // Procesar la siguiente categoría
    console.log(`\n🎯 === INICIANDO PROCESAMIENTO ===`);
    console.log(`📂 Categoría seleccionada: ${nextCategory.name}`);
    console.log(`📊 Productos esperados: ${nextCategory.expected_products}`);
    
    // Marcar como en progreso
    nextCategory.status = 'in_progress';
    nextCategory.started_at = new Date().toISOString();
    plan.last_updated = new Date().toISOString();
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    console.log('💾 Plan actualizado: categoría marcada como "en progreso"');
    
    // Procesar la categoría con logging detallado
    const results = await processCategoryWithDetailedLogging(page, nextCategory);
    
    if (!results || results.length === 0) {
      console.log('❌ No se obtuvieron resultados válidos');
      return;
    }
    
    // Guardar resultados
    const filePath = saveResultsWithValidation(
      nextCategory.name, 
      results, 
      nextCategory.expected_products
    );
    
    if (!filePath) {
      console.log('❌ Error guardando resultados');
      return;
    }
    
    // Actualizar plan
    const totalProducts = results.reduce((sum, cat) => sum + (cat.productCount || 0), 0);
    
    nextCategory.status = 'completed';
    nextCategory.completed_at = new Date().toISOString();
    nextCategory.file_path = path.basename(filePath);
    nextCategory.subcategories_found = results.length;
    nextCategory.validation_result = {
      expected: nextCategory.expected_products,
      found: totalProducts,
      difference: Math.abs((nextCategory.expected_products || 0) - totalProducts),
      is_valid: Math.abs((nextCategory.expected_products || 0) - totalProducts) <= (nextCategory.expected_products || 0) * 0.2
    };
    
    plan.last_updated = new Date().toISOString();
    fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
    
    console.log(`\n🎉 === PROCESAMIENTO COMPLETADO ===`);
    console.log(`✅ Categoría: ${nextCategory.name}`);
    console.log(`📊 Subcategorías encontradas: ${results.length}`);
    console.log(`📦 Productos totales: ${totalProducts}`);
    console.log(`💾 Archivo: ${nextCategory.file_path}`);
    
    // Mostrar progreso general
    const completed = plan.categories.filter(cat => cat.status === 'completed').length;
    const remaining = plan.categories.filter(cat => cat.status === 'pending').length;
    
    console.log(`\n📊 === PROGRESO GENERAL ===`);
    console.log(`✅ Completadas: ${completed}/${plan.categories.length}`);
    console.log(`⏳ Restantes: ${remaining}`);
    
    if (remaining > 0) {
      const next = plan.categories.find(cat => cat.status === 'pending');
      console.log(`🔄 Siguiente: ${next.name}`);
      console.log(`🚀 Ejecuta 'node category-detailed-test.js' para continuar`);
    } else {
      console.log(`🎉 ¡PRUEBA COMPLETA FINALIZADA!`);
    }

  } catch (error) {
    console.error('❌ Error en función principal:', error.message);
  } finally {
    console.log('\n🔚 Cerrando navegador...');
    await browser.close();
    console.log('✅ Navegador cerrado correctamente');
  }
}

// Ejecutar
if (require.main === module) {
  detailedTestMain().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { detailedTestMain };