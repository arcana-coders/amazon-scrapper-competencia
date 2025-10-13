const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * EXTRACTOR DE PRODUCTOS - SCRIPT BASE
 * 
 * Extrae ASINs, títulos y precios de productos de un vendedor específico en Amazon MX
 * 
 * USO:
 *   node extract-products.js [SELLER_ID] [MAX_PAGES] [CUSTOM_URL] [CATEGORY_NAME]
 * 
 * EJEMPLOS:
 *   node extract-products.js A3Q5ASRA7J8Y5E                    # Todas las páginas del vendedor
 *   node extract-products.js A3Q5ASRA7J8Y5E 5                  # Solo las primeras 5 páginas
 *   node extract-products.js A3Q5ASRA7J8Y5E null "URL" "Cat"   # URL y categoría específica
 * 
 * CARACTERÍSTICAS:
 * - Scroll aleatorio para simular comportamiento humano
 * - Pausas variables entre páginas (3-8 segundos)
 * - Navegación completa con paginación automática
 * - Salida en formato JSON estructurado
 * 
 * SCRIPT BASE - NO MODIFICAR UNA VEZ FINALIZADO
 */

// ========== CONFIGURACIÓN ==========
const SELLER_ID = process.argv[2] || 'A3Q5ASRA7J8Y5E';
const MAX_PAGES = process.argv[3] ? parseInt(process.argv[3]) : null; // Límite opcional de páginas
const CUSTOM_URL = process.argv[4]; // URL personalizada opcional
const CATEGORY_NAME = process.argv[5]; // Nombre de categoría opcional

// Determinar URL a usar
let SELLER_URL;
if (CUSTOM_URL) {
  SELLER_URL = CUSTOM_URL;
  console.log('🔗 Usando URL personalizada para categoría específica');
} else {
  SELLER_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=A1AM78C64UM0Y8`;
}

const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const OUTPUT_DIR = path.join(__dirname, 'data');

// Determinar archivo de salida
let OUTPUT_FILE;
if (CATEGORY_NAME) {
  const vendorDir = path.join(OUTPUT_DIR, 'vendors', SELLER_ID);
  if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir, { recursive: true });
  const categoryFileName = CATEGORY_NAME.toLowerCase().replace(/[^a-z0-9]/g, '-');
  OUTPUT_FILE = path.join(vendorDir, `${categoryFileName}-products.json`);
} else {
  OUTPUT_FILE = path.join(OUTPUT_DIR, `products-${SELLER_ID}-${new Date().toISOString().split('T')[0]}.json`);
}

// ========== FUNCIONES DE UTILIDAD ==========

/**
 * Realizar scroll aleatorio para simular comportamiento humano
 */
async function performRandomScroll(page) {
  const scrollActions = ['none', 'down', 'down_up', 'small_down'];
  const action = scrollActions[Math.floor(Math.random() * scrollActions.length)];
  
  // Tiempo aleatorio antes del scroll (0-2 segundos)
  const preScrollWait = Math.random() * 2000;
  await page.waitForTimeout(preScrollWait);
  
  switch (action) {
    case 'none':
      console.log('🎯 Sin scroll (comportamiento natural)');
      break;
      
    case 'down':
      console.log('📜 Scroll hacia abajo');
      await page.evaluate(() => {
        window.scrollBy(0, 300 + Math.random() * 400);
      });
      await page.waitForTimeout(500 + Math.random() * 1000);
      break;
      
    case 'down_up':
      console.log('📜 Scroll abajo y arriba');
      await page.evaluate(() => {
        window.scrollBy(0, 400 + Math.random() * 300);
      });
      await page.waitForTimeout(800 + Math.random() * 800);
      await page.evaluate(() => {
        window.scrollBy(0, -200 - Math.random() * 200);
      });
      await page.waitForTimeout(500 + Math.random() * 700);
      break;
      
    case 'small_down':
      console.log('📜 Scroll pequeño');
      await page.evaluate(() => {
        window.scrollBy(0, 150 + Math.random() * 200);
      });
      await page.waitForTimeout(400 + Math.random() * 600);
      break;
  }
  
  // Volver al top para asegurar que los elementos estén visibles
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300 + Math.random() * 500);
}

/**
 * Cargar cookies de autenticación
 */
function loadCookies() {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.error(`❌ Archivo de cookies no encontrado: ${COOKIES_FILE}`);
      process.exit(1);
    }
    
    const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    const cookies = cookieData.cookies || cookieData; // Soportar ambos formatos
    
    if (!Array.isArray(cookies)) {
      console.error('❌ Formato de cookies inválido, debe ser un array');
      process.exit(1);
    }
    
    console.log(`✅ Cookies cargadas: ${cookies.length} cookies`);
    return cookies;
  } catch (error) {
    console.error(`❌ Error cargando cookies: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Extraer productos de una página
 */
async function extractProductsFromPage(page) {
  console.log('🔍 Extrayendo productos de la página actual...');
  
  // Esperar a que los productos se carguen
  await page.waitForSelector('[data-asin]', { timeout: 10000 });
  
  const products = await page.$$eval('[data-asin]', (elements) => {
    const debugInfo = [];
    
    return elements.map((el, index) => {
      const asin = el.getAttribute('data-asin');
      
      // Solo procesar elementos con ASIN válido (no vacío)
      if (!asin || asin.trim() === '') return null;
      
      // DEBUG: Inspeccionar estructura del elemento
      const debug = {
        asin: asin,
        innerHTML_preview: el.innerHTML.substring(0, 200),
        classes: el.className
      };
      
      // Extraer título - Selectores más amplios
      let title = '';
      const titleSelectors = [
        'h2 a span',
        'h2 span',
        '.s-size-mini .s-link-normal',
        'h2 .a-link-normal span',
        '[data-cy="title-recipe-title"]',
        '.a-size-base-plus',
        '.a-size-base',
        '.a-text-normal',
        'a .a-text-normal'
      ];
      
      for (const selector of titleSelectors) {
        const titleEl = el.querySelector(selector);
        if (titleEl && titleEl.textContent.trim()) {
          title = titleEl.textContent.trim();
          debug.title_selector = selector;
          break;
        }
      }
      
      // Extraer precio - Selectores más amplios
      let price = '';
      const priceSelectors = [
        '.a-price .a-offscreen',
        '.a-price-whole',
        '.a-price .a-price-symbol + span',
        '[data-a-color="base"] .a-offscreen',
        '.a-price-range .a-offscreen',
        '.a-text-price',
        '.a-price'
      ];
      
      for (const selector of priceSelectors) {
        const priceEl = el.querySelector(selector);
        if (priceEl && priceEl.textContent.trim()) {
          price = priceEl.textContent.trim();
          debug.price_selector = selector;
          break;
        }
      }
      
      // Agregar info de debug para los primeros 3 elementos
      if (index < 3) {
        debug.found_title = !!title;
        debug.found_price = !!price;
        debugInfo.push(debug);
      }
      
      // Solo retornar si tenemos al menos ASIN y título
      if (asin && title) {
        return {
          asin: asin.trim(),
          title: title,
          price: price || 'No disponible',
          extracted_at: new Date().toISOString()
        };
      }
      
      return null;
    }).filter(product => product !== null);
  });
  
  console.log(`✅ Productos extraídos: ${products.length}`);
  
  // Si no extrajo productos, mostrar debug info
  if (products.length === 0) {
    console.log('🔍 DEBUG: Analizando por qué no se extrajeron productos...');
    
    // Obtener información de debug del primer elemento
    const firstElementDebug = await page.$$eval('[data-asin]', (elements) => {
      if (elements.length > 0) {
        const el = elements[0];
        const asin = el.getAttribute('data-asin');
        
        return {
          asin: asin,
          innerHTML_sample: el.innerHTML.substring(0, 500),
          outerHTML_sample: el.outerHTML.substring(0, 500),
          all_text: el.textContent.substring(0, 300)
        };
      }
      return null;
    });
    
    if (firstElementDebug) {
      console.log('📋 DEBUG - Primer elemento:');
      console.log(`   ASIN: ${firstElementDebug.asin}`);
      console.log(`   Texto completo: ${firstElementDebug.all_text}`);
      console.log(`   HTML muestra: ${firstElementDebug.innerHTML_sample}`);
    }
  }
  
  return products;
}

/**
 * Función principal
 */
async function extractProducts() {
  console.log('🚀 === EXTRACTOR DE PRODUCTOS DEL VENDEDOR ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🔗 URL: ${SELLER_URL}`);
  
  // Crear directorio de salida si no existe
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Cargar cookies
  const cookies = loadCookies();
  
  let browser;
  try {
    // Inicializar navegador
    console.log('🚀 Iniciando navegador...');
    browser = await chromium.launch({ 
      headless: true, // Cambiar a false para debug
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 }
    });
    
    const page = await context.newPage();
    
    // Cargar cookies
    await context.addCookies(cookies);
    console.log('🍪 Cookies aplicadas');
    
    const allProducts = [];
    let currentPage = 1;
    let hasNextPage = true;
    
    while (hasNextPage) {
      // Verificar límite de páginas si está configurado
      if (MAX_PAGES && currentPage > MAX_PAGES) {
        console.log(`⏹️ Límite de páginas alcanzado: ${MAX_PAGES}`);
        break;
      }
      console.log(`\n📄 === PÁGINA ${currentPage} ===`);
      
      // Navegar a la página
      const pageUrl = currentPage === 1 ? SELLER_URL : `${SELLER_URL}&page=${currentPage}`;
      console.log(`🌐 Navegando: ${pageUrl}`);
      
      await page.goto(pageUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // Esperar carga inicial con tiempo aleatorio
      const initialWait = 2000 + Math.random() * 3000; // 2-5 segundos
      console.log(`⏳ Esperando carga inicial: ${Math.round(initialWait)}ms`);
      await page.waitForTimeout(initialWait);
      
      // Scroll aleatorio para simular comportamiento humano
      await performRandomScroll(page);
      
      // Verificar si hay productos en la página
      const dataAsinElements = await page.$$('[data-asin]');
      console.log(`📋 Productos encontrados: ${dataAsinElements.length}`);
      
      if (dataAsinElements.length === 0) {
        console.log('❌ No se encontraron productos en esta página');
        break;
      }
      
      // Extraer productos de la página actual
      const pageProducts = await extractProductsFromPage(page);
      allProducts.push(...pageProducts);
      
      console.log(`📦 Total productos hasta ahora: ${allProducts.length}`);
      
      // Verificar si hay siguiente página con múltiples selectores
      const nextSelectors = [
        'a[aria-label="Ir a la siguiente página"]',
        'a[aria-label="Go to next page"]',
        '.s-pagination-next',
        'a:has-text("Siguiente")',
        'a:has-text("Next")'
      ];
      
      let nextButton = null;
      for (const selector of nextSelectors) {
        try {
          nextButton = await page.$(selector);
          if (nextButton) {
            console.log(`🔍 Botón siguiente encontrado con selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continuar con el siguiente selector
        }
      }
      
      // También verificar información de paginación
      const paginationInfo = await page.$eval('.s-pagination-strip', el => el.textContent).catch(() => '');
      console.log(`📄 Info paginación: ${paginationInfo}`);
      
      const isNextDisabled = nextButton ? await nextButton.getAttribute('aria-disabled') === 'true' : true;
      
      if (!nextButton || isNextDisabled) {
        console.log('✅ No hay más páginas o botón siguiente deshabilitado');
        hasNextPage = false;
      } else {
        console.log(`➡️ Hay más páginas, continuando a página ${currentPage + 1}`);
        currentPage++;
        // Pausa entre páginas más realista
        const pageWait = 3000 + Math.random() * 5000; // 3-8 segundos
        console.log(`⏸️ Pausa entre páginas: ${Math.round(pageWait)}ms`);
        await page.waitForTimeout(pageWait);
      }
    }
    
    // Guardar resultados
    const output = {
      metadata: {
        seller_id: SELLER_ID,
        seller_url: SELLER_URL,
        category_name: CATEGORY_NAME || 'All Products',
        total_products: allProducts.length,
        pages_processed: currentPage,
        extraction_date: new Date().toISOString(),
        script_version: '1.0'
      },
      products: allProducts
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    console.log('\n🎉 === EXTRACCIÓN COMPLETADA ===');
    console.log(`📦 Total productos extraídos: ${allProducts.length}`);
    console.log(`📄 Páginas procesadas: ${currentPage}`);
    console.log(`💾 Archivo guardado: ${OUTPUT_FILE}`);
    
    // Mostrar muestra de productos
    if (allProducts.length > 0) {
      console.log('\n📋 === MUESTRA DE PRODUCTOS ===');
      allProducts.slice(0, 3).forEach((product, index) => {
        console.log(`${index + 1}. ${product.asin} - ${product.title} - ${product.price}`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Error durante la extracción: ${error.message}`);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  extractProducts().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { extractProducts };