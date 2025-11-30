const fs = require('fs');
const path = require('path');

let browserLauncher = null;
let usingPlaywrightExtra = false;

try {
  const playwrightExtra = require('playwright-extra');
  const stealth = require('playwright-extra-plugin-stealth')();
  playwrightExtra.use(stealth);
  browserLauncher = playwrightExtra.firefox;
  usingPlaywrightExtra = true;
  console.log('🔐 playwright-extra y stealth detectados y activados');
} catch (e) {
  const { firefox } = require('playwright');
  browserLauncher = firefox;
  console.log('⚠️ playwright-extra o plugin stealth no instalado — usando playwright/firefox estándar');
}

async function openMyFirefox() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🌐 ABRIENDO Firefox (Playwright)');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Obtener SELLER_ID desde argumentos o usar el vendedor pedido
  const SELLER_ID = process.argv[2] || 'AMTKG3LDPMNNV';
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log('');

  console.log('🚀 Abriendo Firefox (no se usa perfil del sistema)');
  console.log('');

  try {
    // Lanzar Firefox en modo visible (playwright-extra o playwright)
    const browser = await browserLauncher.launch({ headless: false });
    // Si existe un storageState guardado, úsalo para mantener la sesión
    const cookiePath = path.join(__dirname, 'scripts', 'auth', 'amazonmx-firefox.json');
    const contextOptions = { viewport: null };
    if (fs.existsSync(cookiePath)) {
      contextOptions.storageState = cookiePath;
      console.log('🔁 Usando storageState desde:', cookiePath);
    } else {
      console.log('⚠️ No se encontró storageState en:', cookiePath);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    console.log('✅ Firefox abierto');

    // Anti-detección básica (solo cuando no está disponible playwright-extra/stealth)
    if (!usingPlaywrightExtra) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        try { delete navigator.__proto__.webdriver; } catch (e) {}
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-MX', 'es', 'en-US', 'en'] });
        window.chrome = { runtime: {} };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters)
        );
      });
    } else {
      console.log('🔒 stealth plugin activo: se omite script anti-detección manual');
    }

    // PRUEBA: Navegar a Google para verificar navegación
    console.log('🧪 PRUEBA: Navegando a https://www.google.com ...');
    try {
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log('✅ Navegación de prueba exitosa');
      await page.waitForTimeout(1000);
    } catch (err) {
      console.log('⚠️ Error en navegación de prueba:', err.message);
    }

    // URL de la tienda del vendedor (solicitada)
    const SEARCH_URL = `https://www.amazon.com.mx/s?me=${SELLER_ID}&marketplaceID=A1AM78C64UM0Y8`;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 Abriendo la tienda del vendedor:');
    console.log(`   ${SEARCH_URL}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      console.log('✅ Página cargada');
    } catch (err) {
      console.log('⚠️ Error cargando la tienda:', err.message);
    }

    console.log('');
    console.log('👀 REVISA EL NAVEGADOR. Cuando termines, presiona ENTER para cerrar.');
    await new Promise(resolve => { process.stdin.once('data', resolve); });

    console.log('🔒 Cerrando Firefox...');
    await browser.close();

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔚 Proceso finalizado');

  } catch (error) {
    console.error('\n❌ Error:', error.message, '\n');
  }
}

openMyFirefox().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
