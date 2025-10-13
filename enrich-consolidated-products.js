const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * ENRIQUECEDOR DE PRODUCTOS CONSOLIDADOS
 * 
 * Lee el archivo consolidado de productos y enriquece cada ASIN con:
 * - Precio actual en Amazon MX
 * - Vendedor actual
 * - Estado de disponibilidad
 * - Fecha de última actualización
 * 
 * USO:
 *   node enrich-consolidated-products.js [SELLER_ID]
 * 
 * EJEMPLO:
 *   node enrich-consolidated-products.js A3Q5ASRA7J8Y5E
 * 
 * CARACTERÍSTICAS:
 * - Hace backup automático de archivos originales
 * - Sistema de progreso persistente (interrumpir/reanudar)
 * - Delays aleatorios para simular comportamiento humano
 * - Genera archivos JSON y CSV enriquecidos
 * - Actualiza solo productos que no han sido procesados
 * 
 * FLUJO:
 * 1. Crear backups de archivos consolidados
 * 2. Cargar progreso existente (si existe)
 * 3. Para cada ASIN pendiente:
 *    - Navegar a Amazon MX
 *    - Extraer precio y vendedor actual
 *    - Actualizar datos del producto
 *    - Guardar progreso
 *    - Esperar delay aleatorio
 * 4. Regenerar archivos JSON y CSV finales
 */

// ========== CONFIGURACIÓN ==========
const SELLER_ID = process.argv[2];

if (!SELLER_ID) {
  console.error('❌ Error: Debes proporcionar un SELLER_ID');
  console.log('📋 Uso: node enrich-consolidated-products.js SELLER_ID');
  console.log('📋 Ejemplo: node enrich-consolidated-products.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const VENDOR_DIR = path.join(DATA_DIR, 'vendors', SELLER_ID);
const COOKIES_FILE = path.join(__dirname, 'amazonmx.json');

// Archivos principales
const CONSOLIDATED_JSON = path.join(VENDOR_DIR, 'all-products-consolidated.json');
const CONSOLIDATED_CSV = path.join(VENDOR_DIR, 'all-products-consolidated.csv');

// Archivos de backup
const BACKUP_JSON = path.join(VENDOR_DIR, `all-products-consolidated-backup-${new Date().toISOString().split('T')[0]}.json`);
const BACKUP_CSV = path.join(VENDOR_DIR, `all-products-consolidated-backup-${new Date().toISOString().split('T')[0]}.csv`);

// Archivos enriquecidos
const ENRICHED_JSON = path.join(VENDOR_DIR, 'all-products-enriched.json');
const ENRICHED_CSV = path.join(VENDOR_DIR, 'all-products-enriched.csv');
const PROGRESS_FILE = path.join(VENDOR_DIR, 'enrichment-progress.json');

// ========== FUNCIONES DE UTILIDAD ==========

/**
 * Crear backups de los archivos originales
 */
function createBackups() {
  console.log('\n💾 === CREANDO BACKUPS ===');
  
  if (fs.existsSync(CONSOLIDATED_JSON)) {
    fs.copyFileSync(CONSOLIDATED_JSON, BACKUP_JSON);
    console.log(`✅ Backup JSON: ${path.basename(BACKUP_JSON)}`);
  }
  
  if (fs.existsSync(CONSOLIDATED_CSV)) {
    fs.copyFileSync(CONSOLIDATED_CSV, BACKUP_CSV);
    console.log(`✅ Backup CSV: ${path.basename(BACKUP_CSV)}`);
  }
}

/**
 * Cargar progreso existente
 */
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📊 Progreso cargado: ${progress.completed_products}/${progress.total_products} productos procesados`);
      return progress;
    } catch (error) {
      console.log('⚠️ Error cargando progreso, iniciando desde cero');
    }
  }
  
  return {
    started_at: new Date().toISOString(),
    total_products: 0,
    completed_products: 0,
    failed_products: 0,
    processed_asins: [],
    failed_asins: [],
    enriched_products: []
  };
}

/**
 * Guardar progreso actual
 */
function saveProgress(progress) {
  progress.last_updated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Generar delay aleatorio
 */
function randomDelay(min = 3000, max = 8000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Cargar cookies de sesión
 */
async function loadCookies() {
  if (!fs.existsSync(COOKIES_FILE)) {
    console.log('⚠️ Archivo de cookies no encontrado:', COOKIES_FILE);
    console.log('💡 Ejecuta primero: node scripts/a-login.js');
    return null;
  }
  
  try {
    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    
    let cookies;
    if (Array.isArray(cookiesData)) {
      cookies = cookiesData;
    } else if (cookiesData.cookies && Array.isArray(cookiesData.cookies)) {
      cookies = cookiesData.cookies;
    } else {
      console.error('❌ Formato de cookies no reconocido');
      return null;
    }
    
    console.log(`✅ Cookies cargadas: ${cookies.length} cookies`);
    return cookies;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Hacer scroll aleatorio (copiado de extract-price-seller.js)
 */
async function randomScroll(page) {
  const scrollTypes = [
    // Scroll suave hacia abajo
    async () => {
      const scrollY = Math.random() * 500 + 200;
      await page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: 'smooth' });
      }, scrollY);
    },
    
    // Scroll por secciones pequeñas
    async () => {
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => {
          window.scrollBy({ top: 200, behavior: 'smooth' });
        });
        await page.waitForTimeout(randomDelay(300, 600));
      }
    },
    
    // Scroll mínimo
    async () => {
      await page.evaluate(() => {
        window.scrollTo({ top: 100, behavior: 'smooth' });
      });
      await page.waitForTimeout(randomDelay(500, 800));
    }
  ];
  
  const randomScrollType = scrollTypes[Math.floor(Math.random() * scrollTypes.length)];
  await randomScrollType();
}

/**
 * Extraer precio de la página (simplificado)
 */
async function extractPrice(page) {
  const priceSelectors = [
    '.a-price-whole',
    '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
    '.a-price.apexPriceToPay .a-offscreen',
    '#priceblock_dealprice',
    '#priceblock_ourprice',
    '.a-price .a-offscreen'
  ];
  
  for (const selector of priceSelectors) {
    try {
      const priceElement = await page.$(selector);
      if (priceElement) {
        const priceText = await priceElement.textContent();
        if (priceText && priceText.trim()) {
          return priceText.trim();
        }
      }
    } catch (error) {
      // Continuar con el siguiente selector
    }
  }
  
  return null;
}

/**
 * Extraer vendedor de la página (simplificado)
 */
async function extractSeller(page) {
  const sellerSelectors = [
    'a[href*="/gp/help/seller/"]',
    'a[href*="/sp?seller="]',
    '#merchant-info a',
    '.tabular-buybox-text span a'
  ];
  
  for (const selector of sellerSelectors) {
    try {
      const sellerElement = await page.$(selector);
      if (sellerElement) {
        const sellerText = await sellerElement.textContent();
        if (sellerText && sellerText.trim() && 
            !sellerText.includes('Amazon') && 
            sellerText.length > 1 && sellerText.length < 50) {
          return sellerText.trim();
        }
      }
    } catch (error) {
      // Continuar con el siguiente selector
    }
  }
  
  return null;
}

/**
 * Enriquecer un producto individual
 */
async function enrichProduct(page, product, index, total) {
  const asin = product.asin;
  const url = `https://www.amazon.com.mx/dp/${asin}`;
  
  console.log(`\n📦 [${index + 1}/${total}] Procesando ASIN: ${asin}`);
  console.log(`🔗 URL: ${url}`);
  
  try {
    // Navegar a la página del producto
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Esperar carga
    await page.waitForTimeout(randomDelay(2000, 4000));
    
    // Hacer scroll aleatorio
    await randomScroll(page);
    
    // Extraer información actual
    const currentPrice = await extractPrice(page);
    const currentSeller = await extractSeller(page);
    
    // Crear producto enriquecido
    const enrichedProduct = {
      ...product,
      enrichment: {
        current_price: currentPrice,
        current_seller: currentSeller,
        original_price: product.price,
        original_category: product.category,
        price_changed: currentPrice && currentPrice !== product.price,
        seller_changed: currentSeller && currentSeller !== (product.seller || null),
        last_checked: new Date().toISOString(),
        status: currentPrice ? 'available' : 'unavailable'
      }
    };
    
    console.log(`💰 Precio original: ${product.price} → Actual: ${currentPrice || 'No encontrado'}`);
    console.log(`🏪 Vendedor actual: ${currentSeller || 'No encontrado'}`);
    
    return enrichedProduct;
    
  } catch (error) {
    console.error(`❌ Error procesando ${asin}: ${error.message}`);
    
    // Producto con error
    return {
      ...product,
      enrichment: {
        current_price: null,
        current_seller: null,
        original_price: product.price,
        original_category: product.category,
        error: error.message,
        last_checked: new Date().toISOString(),
        status: 'error'
      }
    };
  }
}

/**
 * Generar archivo CSV enriquecido
 */
function generateEnrichedCsv(enrichedProducts) {
  const csvHeaders = [
    'asin',
    'title',
    'original_price',
    'current_price',
    'price_changed',
    'category',
    'current_seller',
    'seller_changed',
    'also_appears_in',
    'status',
    'last_checked',
    'extracted_at'
  ];
  
  const escapeCsv = (val) => {
    if (val == null) return '';
    const s = String(val).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  
  const csvRows = [csvHeaders.join(',')];
  
  enrichedProducts.forEach(prod => {
    const enrichment = prod.enrichment || {};
    csvRows.push([
      escapeCsv(prod.asin),
      escapeCsv(prod.title),
      escapeCsv(enrichment.original_price || prod.price),
      escapeCsv(enrichment.current_price),
      escapeCsv(enrichment.price_changed || false),
      escapeCsv(prod.category),
      escapeCsv(enrichment.current_seller),
      escapeCsv(enrichment.seller_changed || false),
      escapeCsv((prod.also_appears_in || []).join('|')),
      escapeCsv(enrichment.status || 'unknown'),
      escapeCsv(enrichment.last_checked),
      escapeCsv(prod.extracted_at)
    ].join(','));
  });
  
  fs.writeFileSync(ENRICHED_CSV, csvRows.join('\n'), 'utf8');
}

/**
 * Función principal
 */
async function enrichConsolidatedProducts() {
  console.log('🔍 === ENRIQUECEDOR DE PRODUCTOS CONSOLIDADOS ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`📁 Directorio: ${VENDOR_DIR}`);
  
  // Verificar que existe el archivo consolidado
  if (!fs.existsSync(CONSOLIDATED_JSON)) {
    console.error('❌ Archivo consolidado no encontrado:', CONSOLIDATED_JSON);
    console.log('💡 Ejecuta primero: node cerebro.js ' + SELLER_ID);
    process.exit(1);
  }
  
  // Crear backups
  createBackups();
  
  // Cargar datos consolidados
  console.log('\n📖 Cargando productos consolidados...');
  const consolidatedData = JSON.parse(fs.readFileSync(CONSOLIDATED_JSON, 'utf8'));
  const products = consolidatedData.all_products || [];
  
  console.log(`📦 Total productos a procesar: ${products.length}`);
  
  // Cargar progreso
  let progress = loadProgress();
  progress.total_products = products.length;
  
  // Determinar productos pendientes
  const pendingProducts = products.filter(product => 
    !progress.processed_asins.includes(product.asin)
  );
  
  console.log(`⏳ Productos pendientes: ${pendingProducts.length}`);
  console.log(`✅ Productos ya procesados: ${progress.completed_products}`);
  
  if (pendingProducts.length === 0) {
    console.log('🎉 Todos los productos ya han sido procesados!');
    
    // Regenerar archivos finales si no existen
    if (!fs.existsSync(ENRICHED_JSON)) {
      console.log('📄 Regenerando archivo JSON enriquecido...');
      const enrichedData = {
        ...consolidatedData,
        enrichment_metadata: {
          enriched_at: new Date().toISOString(),
          total_products: progress.total_products,
          completed_products: progress.completed_products,
          failed_products: progress.failed_products
        },
        all_products: progress.enriched_products
      };
      
      fs.writeFileSync(ENRICHED_JSON, JSON.stringify(enrichedData, null, 2));
      generateEnrichedCsv(progress.enriched_products);
      
      console.log(`💾 Archivos regenerados:`);
      console.log(`   JSON: ${ENRICHED_JSON}`);
      console.log(`   CSV: ${ENRICHED_CSV}`);
    }
    return;
  }
  
  // Cargar cookies
  const cookies = await loadCookies();
  if (!cookies) {
    console.error('❌ No se pudieron cargar las cookies');
    process.exit(1);
  }
  
  // Inicializar navegador
  const browser = await chromium.launch({
    headless: false, // Visible para debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'es-MX'
    });
    
    await context.addCookies(cookies);
    const page = await context.newPage();
    
    console.log('\n🚀 === INICIANDO ENRIQUECIMIENTO ===');
    
    // Procesar productos pendientes
    for (let i = 0; i < pendingProducts.length; i++) {
      const product = pendingProducts[i];
      
      try {
        const enrichedProduct = await enrichProduct(page, product, i, pendingProducts.length);
        
        // Actualizar progreso
        progress.enriched_products.push(enrichedProduct);
        progress.processed_asins.push(product.asin);
        progress.completed_products++;
        
        if (enrichedProduct.enrichment.status === 'error') {
          progress.failed_products++;
          progress.failed_asins.push(product.asin);
        }
        
        // Guardar progreso cada 5 productos
        if ((i + 1) % 5 === 0 || i === pendingProducts.length - 1) {
          saveProgress(progress);
          console.log(`💾 Progreso guardado: ${progress.completed_products}/${progress.total_products}`);
        }
        
        // Delay aleatorio entre productos
        if (i < pendingProducts.length - 1) {
          const waitTime = randomDelay(4000, 10000);
          console.log(`⏸️ Esperando ${Math.round(waitTime/1000)}s antes del siguiente producto...`);
          await page.waitForTimeout(waitTime);
        }
        
      } catch (error) {
        console.error(`❌ Error crítico procesando ${product.asin}: ${error.message}`);
        progress.failed_products++;
        progress.failed_asins.push(product.asin);
        saveProgress(progress);
        
        // Continuar con el siguiente producto
        continue;
      }
    }
    
    console.log('\n🎉 === ENRIQUECIMIENTO COMPLETADO ===');
    console.log(`✅ Productos procesados: ${progress.completed_products}/${progress.total_products}`);
    console.log(`❌ Productos con error: ${progress.failed_products}`);
    
    // Generar archivos finales enriquecidos
    console.log('\n📄 Generando archivos enriquecidos...');
    
    const enrichedData = {
      ...consolidatedData,
      enrichment_metadata: {
        enriched_at: new Date().toISOString(),
        total_products: progress.total_products,
        completed_products: progress.completed_products,
        failed_products: progress.failed_products,
        success_rate: `${((progress.completed_products - progress.failed_products) / progress.total_products * 100).toFixed(1)}%`
      },
      all_products: progress.enriched_products
    };
    
    fs.writeFileSync(ENRICHED_JSON, JSON.stringify(enrichedData, null, 2));
    generateEnrichedCsv(progress.enriched_products);
    
    console.log(`✅ Archivos generados:`);
    console.log(`   📋 JSON enriquecido: ${ENRICHED_JSON}`);
    console.log(`   📊 CSV enriquecido: ${ENRICHED_CSV}`);
    console.log(`   💾 Backups en: ${path.dirname(BACKUP_JSON)}`);
    
  } catch (error) {
    console.error('\n❌ Error durante el enriquecimiento:', error.message);
    saveProgress(progress);
    console.log('💾 Progreso guardado. Puedes reanudar ejecutando el mismo comando.');
  } finally {
    await browser.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  enrichConsolidatedProducts().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { enrichConsolidatedProducts };