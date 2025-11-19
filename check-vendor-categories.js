const { chromium } = require('playwright');
const path = require('path');

async function checkCategories() {
  const cookiePath = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: cookiePath });
  const page = await context.newPage();

  await page.goto('https://www.amazon.com.mx/s?me=A1HGYOYPGEKVQ5&marketplaceID=A1AM78C64UM0Y8');
  await page.waitForTimeout(5000);

  // Buscar TODOS los tipos de links
  console.log('\n=== Análisis de Links ===\n');

  console.log('1. Links con rh=n:');
  const rhLinks = await page.$$eval('a[href*="rh=n"]', links =>
    links.slice(0, 5).map(a => ({ text: a.textContent.trim(), href: a.href }))
  );
  if (rhLinks.length > 0) {
    rhLinks.forEach((link, i) => console.log(`   ${i+1}. ${link.text} -> ${link.href}`));
  } else {
    console.log('   Ninguno encontrado');
  }

  console.log('\n2. Links en sidebar (#s-refinements, #leftNav):');
  const leftNavLinks = await page.$$eval('#leftNav a, #s-refinements a', links =>
    links.slice(0, 5).map(a => ({ text: a.textContent.trim(), href: a.href }))
  );
  if (leftNavLinks.length > 0) {
    leftNavLinks.forEach((link, i) => console.log(`   ${i+1}. ${link.text} -> ${link.href}`));
  } else {
    console.log('   Ninguno encontrado');
  }

  console.log('\n3. Links con me= (seller):');
  const sellerLinks = await page.$$eval('a[href*="me="]', links =>
    links.slice(0, 5).map(a => ({ text: a.textContent.trim(), href: a.href }))
  );
  if (sellerLinks.length > 0) {
    sellerLinks.forEach((link, i) => console.log(`   ${i+1}. ${link.text} -> ${link.href}`));
  } else {
    console.log('   Ninguno encontrado');
  }

  console.log('\n4. Todos los links del sidebar:');
  const allLeftLinks = await page.$$eval('.s-left-nav-list-item a, .a-spacing-none a', links =>
    links.slice(0, 10).map(a => ({ text: a.textContent.trim(), href: a.href }))
  );
  if (allLeftLinks.length > 0) {
    allLeftLinks.forEach((link, i) => console.log(`   ${i+1}. ${link.text} -> ${link.href}`));
  } else {
    console.log('   Ninguno encontrado');
  }

  console.log('\n=== Esperando 15 segundos para inspección manual ===');
  await page.waitForTimeout(15000);
  await browser.close();
}

checkCategories().catch(console.error);
