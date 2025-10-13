const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugProductCount() {
  console.log('🔍 === DEBUG: EXTRACCIÓN DE CONTEO DE PRODUCTOS ===');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await browser.newPage();
  
  try {
    // Cargar cookies
    const cookiesPath = path.join(__dirname, 'amazonmx.json');
    if (fs.existsSync(cookiesPath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
      await page.context().addCookies(cookies);
      console.log(`🍪 ${cookies.length} cookies cargadas`);
    }

    const url = 'https://www.amazon.com.mx/s?i=merchant-items&me=A338WHNLA63C6H&rh=n%3A9482670011&dc&marketplaceID=A1AM78C64UM0Y8&qid=1760037839&rnid=15997893011&ref=sr_nr_n_7&ds=v1%3Au%2FzV3SWcpQUdbVpJw6AUst14moNAiou%2Fp89EkVZljq8';
    
    console.log('🌐 Navegando a:', url);
    await page.goto(url, { waitUntil: 'networkidle' });
    
    console.log('⏳ Esperando 3 segundos...');
    await page.waitForTimeout(3000);
    
    // Extraer todo el texto visible
    const allText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('\n📄 === TEXTO COMPLETO DE LA PÁGINA ===');
    console.log(allText.substring(0, 2000) + '...');
    
    // Buscar patrones específicos
    const productInfo = await page.evaluate(() => {
      const texts = [];
      
      // Muchos más selectores
      const selectors = [
        '.a-section .a-size-base',
        '.s-result-count',
        '.sg-col-inner .a-size-base',
        '.a-spacing-top-small .a-size-base',
        '[data-component-type="s-result-info-bar"]',
        '.s-desktop-width-max .a-size-base',
        '.s-desktop-width-max .a-size-small',
        '.s-desktop-width-max span',
        '.a-color-state',
        '.a-size-base-plus',
        'span[dir="auto"]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && (text.includes('resultado') || text.includes('de ') || /\d+/.test(text))) {
            texts.push({ selector, text });
          }
        });
      });
      
      return texts;
    });

    console.log('\n🔍 === TEXTOS ENCONTRADOS CON NÚMEROS ===');
    productInfo.forEach((item, i) => {
      console.log(`${i + 1}. [${item.selector}] "${item.text}"`);
    });
    
    // Probar patrones
    console.log('\n🎯 === APLICANDO PATRONES ===');
    const patterns = [
      { name: 'Patrón 1', regex: /(\d{1,3}(?:,\d{3})*)\s+resultados?/i },
      { name: 'Patrón 2', regex: /1-\d+\s+de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i },
      { name: 'Patrón 3', regex: /más de\s+(\d{1,3}(?:,\d{3})*)\s+resultados?/i },
      { name: 'Patrón 4', regex: /(\d{1,3}(?:,\d{3})*)\s+de\s+(\d{1,3}(?:,\d{3})*)/i },
      { name: 'Patrón 5', regex: /(\d+)\s+resultado/i }
    ];
    
    for (const item of productInfo) {
      for (const pattern of patterns) {
        const match = item.text.match(pattern.regex);
        if (match) {
          console.log(`✅ ${pattern.name} encontró: ${match[1]} en "${item.text}"`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n⏸️ Presiona Enter para cerrar el browser...');
    process.stdin.once('data', async () => {
      await browser.close();
      process.exit(0);
    });
  }
}

debugProductCount();