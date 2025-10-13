
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const sellerUrl = 'https://www.amazon.com.mx/s?i=merchant-items&me=A1VKD22N1RQ0B&rh=n%3A17608484011%2Cn%3A17724549011&s=exact-aware-popularity-rank&dc&ds=v1%3A%2Bog8V4tEh4DNqrFx1b41TqDe3tbd8DSoXiA%2BSf%2BioU4&marketplaceID=A1AM78C64UM0Y8&qid=1759983050&rnid=17608484011&xpid=FRERvByWV6bsI&ref=sr_nr_n_1';
const dataDir = path.join(__dirname, '..', 'data');
const outputFile = path.join(dataDir, 'vendedor_asins.json');

(async () => {
  console.log('🚀 Iniciando scraper de vendedor...');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: path.join(__dirname, '..', 'scripts/auth', 'pedirplantilla.json'),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  const results = [];

  try {
    console.log(`Navigating to ${sellerUrl}`);
    await page.goto(sellerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);

    const items = await page.$$('div[data-asin]');
    console.log(`🔍 Encontrados ${items.length} productos en la primera página.`);

    for (const item of items) {
      const asin = await item.getAttribute('data-asin');
      if (!asin) continue;

      const priceElement = await item.$('.a-price .a-offscreen');
      const priceText = priceElement ? await priceElement.textContent() : null;
      const price = priceText ? parseFloat(priceText.replace(/[^0-9.-]+/g, '')) : null;

      if (price) {
        results.push({ asin, precio_mx: price });
      }
    }
  } catch (error) {
    console.error('Error during scraping:', error);
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`✅ Resultados guardados en ${outputFile}`);

  await browser.close();
})();
