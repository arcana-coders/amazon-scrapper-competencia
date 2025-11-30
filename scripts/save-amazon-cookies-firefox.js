const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

async function saveAmazonCookies() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌐 GUARDAR COOKIES AMAZON.COM.MX (Firefox - Playwright)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const authDir = path.join(__dirname, 'auth');
  const outFile = path.join(authDir, 'amazonmx-firefox.json');

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  console.log('🚀 Abriendo Firefox (visible). Inicia sesión en Amazon.com.mx cuando se abra la ventana.');
  console.log('   - URL objetivo: https://www.amazon.com.mx/');
  console.log('   - Cuando hayas iniciado sesión y verifiques que la sesión persiste, vuelve a esta consola y presiona ENTER para guardar las cookies.');
  console.log('');

  const browser = await firefox.launch({ headless: false });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    await page.goto('https://www.amazon.com.mx/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    console.log('⚠️ Advertencia: error inicial al cargar Amazon:', err.message);
  }

  console.log('📝 Navega en la ventana abierta y realiza el login si no estás autenticado.');
  console.log('Presiona ENTER aquí cuando hayas terminado para guardar el storageState en:', outFile);

  await new Promise(resolve => process.stdin.once('data', resolve));

  try {
    await context.storageState({ path: outFile });
    console.log('✅ storageState guardado en:', outFile);
  } catch (err) {
    console.error('❌ Error guardando storageState:', err.message);
  }

  console.log('🔒 Cerrando navegador...');
  await browser.close();
  console.log('🔚 Proceso completado');
}

saveAmazonCookies().catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
});
