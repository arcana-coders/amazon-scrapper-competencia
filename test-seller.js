const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Obtener SELLER_ID como argumento obligatorio
if (process.argv.length < 3) {
  console.log('❌ Uso: node test-seller.js SELLER_ID');
  console.log('📋 Ejemplo: node test-seller.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const MARKETPLACE_ID = 'A1AM78C64UM0Y8';
const BASE_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=${MARKETPLACE_ID}`;
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');

// Crear carpeta del vendedor si no existe
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

/**
 * Test rápido del nuevo vendedor
 */
async function testNewSeller() {
  console.log('🧪 === TEST RÁPIDO NUEVO VENDEDOR ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`🔗 URL: ${BASE_URL}`);
  
  // Verificar cookies
  if (!fs.existsSync(COOKIES_FILE)) {
    console.error('❌ No se encontraron cookies');
    console.log('🔑 Ejecuta: node scripts/a-login.js');
    return;
  }
  
  const cookieData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  console.log(`🍪 Cookies cargadas: ${cookieData.cookies.length}`);
  
  // Configurar navegador
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });
  
  await context.addCookies(cookieData.cookies);
  const page = await context.newPage();
  
  try {
    // Ir a la página del vendedor
    console.log('🔍 Navegando al vendedor...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Extraer información básica
    console.log('📊 Extrayendo información básica...');
    
    // Buscar nombre de la tienda
    let storeName = null;
    const storeNameSelectors = [
      '#p13n-asin-index-page #p13n-mobile-asin-index-page span.a-size-base.a-color-base',
      'h1#merchant-name',
      '.s-merchant-info',
      'span[data-component-type="s-merchant-info"]',
      '.a-row.a-spacing-small span.a-size-base.a-color-base'
    ];
    
    for (const selector of storeNameSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          const trimmedText = text ? text.trim() : '';
          if (trimmedText && trimmedText.length > 0 && trimmedText.length < 100) {
            storeName = trimmedText;
            console.log(`🏪 Nombre de la tienda: "${storeName}"`);
            break;
          }
        }
      } catch (e) {
        // Continuar con siguiente selector
      }
    }
    
    // Si no encontramos el nombre con selectores específicos, intentar extraerlo del título de la página
    if (!storeName) {
      try {
        const pageTitle = await page.title();
        // Buscar patrón "Amazon.com.mx: [Nombre de la tienda]"
        const titleMatch = pageTitle.match(/Amazon\.com\.mx:\s*(.+?)(?:\s*-|$)/);
        if (titleMatch && titleMatch[1]) {
          storeName = titleMatch[1].trim();
          console.log(`🏪 Nombre de la tienda (desde título): "${storeName}"`);
        }
      } catch (e) {
        console.log('⚠️  No se pudo extraer nombre de la tienda del título');
      }
    }
    
    if (!storeName) {
      console.log('⚠️  No se pudo detectar el nombre de la tienda (se usará SELLER_ID)');
      storeName = SELLER_ID;
    }
    
    // Buscar conteo total de productos
    const selectors = [
      'h2.a-size-base.a-spacing-small.a-spacing-top-small.a-text-normal',
      'h2[class*="a-size-base"][class*="a-spacing-small"]',
      '.a-section.a-spacing-none.s-breadcrumb-with-all-filters h2',
      'h2',
      '.a-size-base'
    ];

    let totalProducts = null;
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
          
          console.log(`✅ Texto encontrado: "${trimmedText}"`);
          
          let match = trimmedText.match(/(?:de\s+)?(\d{1,3}(?:[,\.]\d{3})*|\d+)/i);
          if (match) {
            let numberStr = match[1].replace(/[,\.]/g, '');
            const number = parseInt(numberStr, 10);
            if (!isNaN(number)) {
              totalProducts = number;
              console.log(`🎯 Total productos del vendedor: ${number}`);
              break;
            }
          }
        }
      }
      if (totalProducts) break;
    }
    
    // Buscar categorías principales
    console.log('🔍 Buscando categorías principales...');
    const categorySelectors = [
      '#s-refinements a[href*="rh=n"]',
      '.s-navigation-item a[href*="rh=n"]', 
      '#leftNav a[href*="rh=n"]',
      '.a-link-normal[href*="rh=n"]'
    ];

    let categories = [];
    for (const selector of categorySelectors) {
      const elements = await page.$$(selector);
      
      for (const element of elements) {
        try {
          const href = await element.getAttribute('href');
          const text = await element.textContent();
          const trimmedText = text ? text.trim() : '';
          
          if (href && trimmedText && href.includes('rh=n') && href.includes(SELLER_ID)) {
            categories.push({
              name: trimmedText,
              url: href.startsWith('http') ? href : `https://www.amazon.com.mx${href}`
            });
          }
        } catch (e) {
          // Continuar
        }
      }
      
      if (categories.length > 0) break;
    }
    
    // Eliminar duplicados
    const uniqueCategories = categories.filter((cat, index, self) => 
      index === self.findIndex(c => c.name === cat.name)
    );
    
    console.log(`✅ Categorías encontradas: ${uniqueCategories.length}`);
    uniqueCategories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat.name}`);
    });
    
    // Resumen
    console.log('\n📊 === RESUMEN DEL VENDEDOR ===');
    console.log(`� Tienda: ${storeName}`);
    console.log(`�🎯 ID: ${SELLER_ID}`);
    console.log(`📦 Total productos: ${totalProducts || 'No detectado'}`);
    console.log(`📂 Categorías principales: ${uniqueCategories.length}`);
    
    // Guardar en projects.json
    console.log('\n� === GUARDANDO REGISTRO ===');
    const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');
    
    let projectsData = { projects: {}, last_updated: new Date().toISOString() };
    if (fs.existsSync(PROJECTS_FILE)) {
      try {
        projectsData = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
      } catch (error) {
        console.log('⚠️  Error leyendo projects.json, se creará nuevo');
      }
    }
    
    if (!projectsData.projects) {
      projectsData.projects = {};
    }
    
    // Registrar o actualizar vendedor
    const existingData = projectsData.projects[SELLER_ID] || {};
    
    projectsData.projects[SELLER_ID] = {
      ...existingData,
      seller_id: SELLER_ID,
      store_name: storeName,
      total_products: totalProducts,
      main_categories: uniqueCategories.map(c => c.name),
      main_categories_urls: uniqueCategories.map(c => ({ name: c.name, url: c.url })),
      discovered_at: existingData.discovered_at || new Date().toISOString(),
      last_analyzed: new Date().toISOString(),
      status: existingData.status || 'discovered',
      analysis_completed: true,
      analysis_date: new Date().toISOString()
    };
    
    projectsData.last_updated = new Date().toISOString();
    
    // Crear directorio data si no existe
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
    console.log(`✅ Vendedor registrado en: ${path.relative(__dirname, PROJECTS_FILE)}`);
    
    // Recomendaciones para el scraping
    console.log('\n💡 === RECOMENDACIONES ===');
    if (totalProducts) {
      if (totalProducts < 500) {
        console.log('✅ Vendedor pequeño - perfecto para pruebas rápidas');
        console.log('🔧 Plan único suficiente');
      } else if (totalProducts < 2000) {
        console.log('✅ Vendedor mediano - bueno para trabajar completo');
        console.log('🔧 Plan único o 2 lotes máximo');
      } else {
        console.log('⚠️ Vendedor grande - se dividirá en lotes de ~1000 productos');
        console.log('🔧 Múltiples planes (batches) recomendados');
      }
    }
    
    console.log('\n🚀 Siguiente paso:');
    console.log(`   node create-plan.js ${SELLER_ID}`);
    console.log('   (Creará plan(es) jerárquico(s) para el scraping)');
    
  } catch (error) {
    console.error('❌ Error durante el test:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar test
if (require.main === module) {
  testNewSeller().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { testNewSeller };