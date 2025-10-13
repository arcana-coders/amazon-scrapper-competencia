const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const cookiePath = path.join(__dirname, 'auth', 'amazonmx.json');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('🔐 Abriendo Amazon México para generar cookie...');
  console.log('🎯 URL: https://www.amazon.com.mx');
  await page.goto('https://www.amazon.com.mx');

  console.log('🧑‍💻 Por favor:');
  console.log('   1. Inicia sesión en Amazon México si es necesario');
  console.log('   2. Navega a cualquier página para confirmar que funciona');
  console.log('   3. Cuando veas que todo funciona correctamente...');
  console.log('✅ Presiona ENTER en esta terminal para guardar la cookie.');

  // Esperar hasta que el usuario presione ENTER en la terminal
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async () => {
    console.log('💾 Guardando cookie...');
    await context.storageState({ path: cookiePath });
    console.log(`✅ Cookie guardada en: ${cookiePath}`);
    await browser.close();
    process.exit(0);
  });
})();
