const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * EXTRACTOR DE PRECIO Y VENDEDOR DE AMAZON MX
 * 
 * Toma una URL de producto de Amazon MX y extrae:
 * - Precio del producto
 * - Nombre del vendedor
 * - ASIN del producto
 * 
 * USO:
 *   node extract-price-seller.js [URL_PRODUCTO]
 * 
 * EJEMPLO:
 *   node extract-price-seller.js "https://www.amazon.com.mx/dp/B08N5HRD6B"
 * 
 * CARACTERÍSTICAS:
 * - Carga cookies de sesión para evitar bloqueos
 * - Espera a que la página cargue completamente
 * - Hace scroll aleatorio para simular comportamiento humano
 * - Extrae información del vendedor y precio
 */

// ========== CONFIGURACIÓN ==========
const COOKIES_FILE = path.join(__dirname, 'amazonmx.json');

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
    
    // Manejar diferentes formatos de archivo de cookies
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
 * Generar delay aleatorio entre min y max milisegundos
 */
function randomDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Hacer scroll aleatorio en la página
 */
async function randomScroll(page) {
  const scrollTypes = [
    // Scroll suave hacia abajo
    async () => {
      const scrollY = Math.random() * 800 + 200;
      await page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: 'smooth' });
      }, scrollY);
    },
    
    // Scroll por secciones
    async () => {
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollBy({ top: 250, behavior: 'smooth' });
        });
        await page.waitForTimeout(randomDelay(500, 1000));
      }
    },
    
    // Scroll hacia arriba y luego abajo
    async () => {
      await page.evaluate(() => {
        window.scrollTo({ top: 100, behavior: 'smooth' });
      });
      await page.waitForTimeout(randomDelay(800, 1200));
      await page.evaluate(() => {
        window.scrollTo({ top: 500, behavior: 'smooth' });
      });
    },
    
    // Scroll al final y volver al inicio
    async () => {
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
      await page.waitForTimeout(randomDelay(1000, 1500));
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  ];
  
  // Elegir tipo de scroll aleatorio
  const randomScrollType = scrollTypes[Math.floor(Math.random() * scrollTypes.length)];
  
  console.log(`🔄 Ejecutando scroll aleatorio (tipo ${scrollTypes.indexOf(randomScrollType) + 1}/4)`);
  await randomScrollType();
  
  // Esperar después del scroll
  const waitTime = randomDelay(1500, 3000);
  console.log(`⏳ Esperando ${waitTime}ms después del scroll`);
  await page.waitForTimeout(waitTime);
}

/**
 * Extraer ASIN de la URL
 */
function extractAsinFromUrl(url) {
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return asinMatch ? asinMatch[1] : null;
}

/**
 * Extraer precio del producto
 */
async function extractPrice(page) {
  console.log('💰 Extrayendo precio...');
  
  // Selectores comunes para precios en Amazon MX
  const priceSelectors = [
    '.a-price-whole',
    '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
    '.a-price.apexPriceToPay .a-offscreen',
    '#priceblock_dealprice',
    '#priceblock_ourprice',
    '.a-price-range',
    '.a-price .a-offscreen',
    '.a-price-symbol + .a-price-whole'
  ];
  
  for (const selector of priceSelectors) {
    try {
      const priceElement = await page.$(selector);
      if (priceElement) {
        const priceText = await priceElement.textContent();
        if (priceText && priceText.trim()) {
          console.log(`✅ Precio encontrado con selector: ${selector}`);
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
 * Extraer información del vendedor
 */
async function extractSeller(page) {
  console.log('🏪 Extrayendo información del vendedor...');
  
  // Selectores específicos basados en la imagen proporcionada
  const sellerSelectors = [
    // Selectores específicos para "Vendido por"
    'span[class*="a-declarative"] span:contains("Vendido por") + span',
    'span:contains("Vendido por") + span',
    '[data-action*="popover"] span:contains("Vendido por") + span',
    
    // Selectores para enlaces de vendedor
    'a[href*="/sp?seller="]',
    'a[href*="marketplaceID=A1AM78C64UM0Y8&me="]',
    'a[href*="/gp/help/seller/"]',
    
    // Selectores de marca/vendedor cerca del título
    'span.a-size-base.po-brand span.a-size-base',
    '.po-brand span.a-size-base',
    'tr[class*="po-brand"] span.a-size-base',
    
    // Selectores tradicionales
    '#merchant-info a',
    '[data-feature-name="merchantInfo"] a',
    '.tabular-buybox-text[tabular-attribute-name="Sold by"] span',
    '#merchant-info span',
    '.tabular-buybox-text span a',
    '.a-size-small.mbbc-merchant-name',
    '[id*="seller"] a'
  ];
  
  for (const selector of sellerSelectors) {
    try {
      const sellerElement = await page.$(selector);
      if (sellerElement) {
        const sellerText = await sellerElement.textContent();
        if (sellerText && sellerText.trim() && 
            !sellerText.includes('Amazon') && 
            !sellerText.includes('Vendido por') &&
            sellerText.length > 1 && sellerText.length < 50) {
          console.log(`✅ Vendedor encontrado con selector: ${selector}`);
          return sellerText.trim();
        }
      }
    } catch (error) {
      // Continuar con el siguiente selector
    }
  }
  
  // Buscar usando JavaScript más específico basado en la imagen
  try {
    const sellerInfo = await page.evaluate(() => {
      // Buscar elementos que contengan "Vendido por"
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Método 1: Buscar "Vendido por" y obtener el siguiente elemento
      for (const element of allElements) {
        const text = element.textContent;
        if (text && text.includes('Vendido por') && !text.includes('Amazon')) {
          // Buscar el siguiente span o elemento que contenga el nombre
          let nextElement = element.nextElementSibling;
          if (nextElement) {
            const sellerName = nextElement.textContent?.trim();
            if (sellerName && sellerName.length > 1 && sellerName.length < 50) {
              return sellerName;
            }
          }
          
          // Buscar dentro del mismo elemento
          const spans = element.querySelectorAll('span');
          for (const span of spans) {
            const spanText = span.textContent?.trim();
            if (spanText && !spanText.includes('Vendido por') && 
                spanText.length > 1 && spanText.length < 50) {
              return spanText;
            }
          }
        }
      }
      
      // Método 2: Buscar enlaces con href que contengan seller
      const sellerLinks = document.querySelectorAll('a[href*="seller="], a[href*="/sp?"]');
      for (const link of sellerLinks) {
        const linkText = link.textContent?.trim();
        if (linkText && !linkText.includes('Amazon') && 
            linkText.length > 1 && linkText.length < 50) {
          return linkText;
        }
      }
      
      // Método 3: Buscar en la marca del producto
      const brandElement = document.querySelector('tr[class*="po-brand"] span.a-size-base, .po-brand span.a-size-base');
      if (brandElement) {
        const brandText = brandElement.textContent?.trim();
        if (brandText && brandText.length > 1 && brandText.length < 50) {
          return brandText;
        }
      }
      
      return null;
    });
    
    if (sellerInfo) {
      console.log('✅ Vendedor encontrado con JavaScript personalizado');
      return sellerInfo;
    }
  } catch (error) {
    console.log('⚠️ Error buscando vendedor con JavaScript:', error.message);
  }
  
  // Último intento: buscar patrones de texto
  try {
    const sellerText = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('*')).map(el => el.textContent);
      const sellerLine = texts.find(text => 
        text && (text.includes('Vendido por') || text.includes('Sold by'))
      );
      
      if (sellerLine) {
        const match = sellerLine.match(/(?:Vendido por|Sold by)\s*(.+?)(?:\.|$)/i);
        return match ? match[1].trim() : null;
      }
      return null;
    });
    
    if (sellerText) {
      console.log('✅ Vendedor encontrado en texto de página');
      return sellerText;
    }
  } catch (error) {
    console.log('⚠️ Error buscando vendedor en texto:', error.message);
  }
  
  return null;
}

/**
 * Función principal
 */
async function extractPriceAndSeller() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('❌ Error: Debes proporcionar una URL del producto');
    console.log('📋 Uso: node extract-price-seller.js URL_PRODUCTO');
    console.log('📋 Ejemplo: node extract-price-seller.js "https://www.amazon.com.mx/dp/B08N5HRD6B"');
    process.exit(1);
  }
  
  if (!url.includes('amazon.com.mx')) {
    console.error('❌ Error: La URL debe ser de Amazon MX (amazon.com.mx)');
    process.exit(1);
  }
  
  console.log('🔍 === EXTRACTOR DE PRECIO Y VENDEDOR ===');
  console.log(`🔗 URL: ${url}`);
  
  // Extraer ASIN de la URL
  const asin = extractAsinFromUrl(url);
  if (asin) {
    console.log(`🏷️ ASIN detectado: ${asin}`);
  }
  
  // Cargar cookies
  const cookies = await loadCookies();
  if (!cookies) {
    console.error('❌ No se pudieron cargar las cookies. Saliendo...');
    process.exit(1);
  }
  
  const browser = await chromium.launch({
    headless: false, // Mostrar navegador para debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'es-MX'
    });
    
    // Cargar cookies en el contexto
    await context.addCookies(cookies);
    
    const page = await context.newPage();
    
    console.log('🚀 Navegando a la página del producto...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Esperar a que la página cargue completamente
    console.log('⏳ Esperando carga completa de la página...');
    await page.waitForTimeout(randomDelay(3000, 5000));
    
    // Hacer scroll aleatorio
    await randomScroll(page);
    
    // Extraer información
    console.log('\n📊 === EXTRAYENDO INFORMACIÓN ===');
    
    const price = await extractPrice(page);
    const seller = await extractSeller(page);
    
    // Mostrar resultados
    console.log('\n🎯 === RESULTADOS ===');
    console.log(`🏷️ ASIN: ${asin || 'No detectado'}`);
    console.log(`💰 Precio: ${price || 'No encontrado'}`);
    console.log(`🏪 Vendedor: ${seller || 'No encontrado'}`);
    console.log(`🔗 URL: ${url}`);
    console.log(`📅 Extraído: ${new Date().toISOString()}`);
    
    // Verificar si se encontró información
    if (!price && !seller) {
      console.log('\n⚠️ No se pudo extraer información. Posibles causas:');
      console.log('   - Página no cargada completamente');
      console.log('   - Selectores cambiados');
      console.log('   - Producto no disponible');
      console.log('   - Bloqueo por parte de Amazon');
    } else if (!price) {
      console.log('\n⚠️ Precio no encontrado. El producto podría no estar disponible.');
    } else if (!seller) {
      console.log('\n⚠️ Vendedor no encontrado. Podría ser vendido por Amazon directamente.');
    } else {
      console.log('\n✅ Información extraída exitosamente!');
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la extracción:', error.message);
  } finally {
    await browser.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  extractPriceAndSeller().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { extractPriceAndSeller };