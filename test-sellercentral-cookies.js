const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🔐 PRUEBA DE COOKIES - Amazon Seller Central');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Ruta de cookies
const cookiePath = path.join(__dirname, 'scripts', 'auth', 'amazonseller.json');

if (!fs.existsSync(cookiePath)) {
  console.error('❌ No existe el archivo de cookies amazonseller.json');
  console.error(`   Ruta esperada: ${cookiePath}`);
  process.exit(1);
}

// Leer cookies para validar contenido básico
try {
  const raw = fs.readFileSync(cookiePath, 'utf8');
  const data = JSON.parse(raw);
  if (!data.cookies || !Array.isArray(data.cookies)) {
    console.error('❌ El archivo no contiene un array "cookies" válido');
    process.exit(1);
  }
  console.log(`✅ Archivo de cookies cargado. Total cookies: ${data.cookies.length}`);
  const sellerCookie = data.cookies.find(c => c.domain && c.domain.includes('sellercentral'));
  if (sellerCookie) {
    console.log(`🔎 Cookie sellercentral detectada: ${sellerCookie.name}`);
  } else {
    console.log('⚠️ No se detectó ninguna cookie específica de sellercentral (puede necesitar login).');
  }
} catch (err) {
  console.error('❌ No se pudo parsear el archivo de cookies:', err.message);
  process.exit(1);
}

(async () => {
  let browser;
  try {
    console.log('🌐 Abriendo navegador con estado de sesión...');
    browser = await chromium.launch({ headless: false, slowMo: 80 });

    const context = await browser.newContext({
      storageState: cookiePath,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    console.log('➡️  Navegando a Seller Central (home)...');
    await page.goto('https://sellercentral.amazon.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    console.log(`📍 URL actual: ${currentUrl}`);

    // Detectar si fue redirigido a login
    if (/signin|login|ap\/signin/i.test(currentUrl)) {
      console.log('❌ Sesión NO válida. Se requiere login manual.');
      console.log('   Inicia sesión en la ventana abierta.');
      console.log('   Luego presiona ENTER aquí para capturar nuevo estado...');

      await new Promise(resolve => process.stdin.once('data', resolve));

      // Guardar nuevo estado
      const newStatePath = path.join(__dirname, 'scripts', 'auth', 'amazonseller.updated.json');
      await context.storageState({ path: newStatePath });
      console.log('✅ Nuevo estado guardado en:', newStatePath);
    } else {
      console.log('✅ Sesión válida. ¡Cookies funcionando!');

      // Opcional: buscar algún elemento típico del dashboard
      try {
        const dashboardSelector = 'text=Dashboard, Seller, Rendimiento';
        await page.waitForTimeout(1000);
      } catch {}

      // Guardar copia refrescada del estado
      const refreshedPath = path.join(__dirname, 'scripts', 'auth', 'amazonseller.refreshed.json');
      await context.storageState({ path: refreshedPath });
      console.log('💾 Estado refrescado guardado en:', refreshedPath);
    }

    console.log('');
    console.log('ℹ️  Cierra el navegador manualmente cuando termines.');
  } catch (err) {
    console.error('❌ Error durante la prueba:', err.message);
    process.exit(1);
  }
})();
