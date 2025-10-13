const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  📊 CONSULTA DE ESTADO - Amazon Seller Central');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Dominio correcto unificado
const SELLER_BASE = 'https://sellercentral.amazon.com';

// 🧠 Argumentos: SELLER_ID y opcionalmente FEED_ID
const sellerId = process.argv[2];
const feedId = process.argv[3];

if (!sellerId) {
  console.error('❌ Debes proporcionar el SELLER_ID como argumento');
  console.error('');
  console.error('Uso: node consultar-estado-feed-seller.js SELLER_ID [FEED_ID]');
  console.error('Ejemplo: node consultar-estado-feed-seller.js A3Q5ASRA7J8Y5E');
  console.error('Ejemplo: node consultar-estado-feed-seller.js A3Q5ASRA7J8Y5E 123456789');
  console.error('');
  console.error('Si no se proporciona FEED_ID, se consultará el más reciente.');
  console.error('');
  process.exit(1);
}

console.log(`📦 Vendedor: ${sellerId}`);
if (feedId) {
  console.log(`🆔 Feed ID: ${feedId}`);
} else {
  console.log('🆔 Feed ID: Se buscará el más reciente');
}
console.log('');

// 📁 Rutas
const vendorDir = path.join(__dirname, 'data', 'vendors', sellerId);
const cookiePath = path.join(__dirname, 'scripts', 'auth', 'amazonseller.json');
const registroPath = path.join(vendorDir, 'subidas.json');

if (!fs.existsSync(cookiePath)) {
  console.error(`❌ No se encontró el archivo de cookies: ${cookiePath}`);
  console.error('   Ejecuta el script de login para generar las cookies.');
  console.error('');
  process.exit(1);
}

// Si no se proporcionó Feed ID, buscar el más reciente
let feedIdAConsultar = feedId;

if (!feedIdAConsultar && fs.existsSync(registroPath)) {
  const registros = JSON.parse(fs.readFileSync(registroPath, 'utf8'));
  if (registros.length > 0) {
    const ultimoRegistro = registros[registros.length - 1];
    feedIdAConsultar = ultimoRegistro.feedId;
    
    if (feedIdAConsultar) {
      console.log(`✅ Feed ID más reciente encontrado: ${feedIdAConsultar}`);
      console.log(`   (De subida: ${ultimoRegistro.fecha})`);
      console.log('');
    }
  }
}

// 🚀 MAIN
(async () => {
  let browser;
  try {
    console.log('⏳ Conectando con Amazon Seller Central...');
    
    browser = await chromium.launch({
      headless: false,
      slowMo: 100
    });

    const context = await browser.newContext({
      storageState: cookiePath,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    // Navegar a página de estado de feeds
    console.log('🌐 Navegando a historial de feeds...');
    await page.goto(`${SELLER_BASE}/product-search/bulk/status`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Verificar si necesita login
    const currentUrl = page.url();
    console.log(`📍 URL actual: ${currentUrl}`);
    
    if (currentUrl.includes('signin') || currentUrl.includes('login') || currentUrl.includes('ap/signin')) {
      console.error('');
      console.error('⚠️  Las cookies han expirado o necesitas iniciar sesión');
      console.error('   El navegador permanecerá abierto para que inicies sesión manualmente');
      console.error('');
      console.error('   Presiona ENTER cuando hayas iniciado sesión...');
      
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      // Navegar nuevamente después del login
      await page.goto(`${SELLER_BASE}/product-search/bulk/status`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      await page.waitForTimeout(3000);
    }

    console.log('📋 Buscando feeds en el historial...');
    
    // Buscar tabla de feeds
    const tablaSelector = 'table, [role="table"], .data-table';
    
    try {
      await page.waitForSelector(tablaSelector, { timeout: 10000 });
      console.log('✅ Tabla de feeds encontrada');
    } catch (err) {
      console.error('⚠️  No se pudo encontrar la tabla de feeds automáticamente');
      console.error('   El navegador permanecerá abierto para revisión manual');
      console.error('');
      console.error('   Presiona ENTER cuando termines de revisar...');
      
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      await browser.close();
      process.exit(0);
    }

    // Extraer información de la tabla
    console.log('');
    console.log('📊 Extrayendo información de feeds...');
    console.log('');

    // Buscar todas las filas
    const filas = await page.$$('tr');
    
    let feedsEncontrados = [];
    let feedEspecificoEncontrado = false;

    for (const fila of filas) {
      const texto = await fila.textContent();
      
      // Buscar información relevante en la fila
      const contieneFecha = /\d{1,2}\/\d{1,2}\/\d{4}/.test(texto);
      const contieneEstado = /(procesando|completado|error|en proceso|done|processing|cancelled)/i.test(texto);
      
      if (contieneFecha && contieneEstado) {
        // Extraer celdas
        const celdas = await fila.$$('td');
        if (celdas.length > 0) {
          const infoCeldas = [];
          for (const celda of celdas) {
            const textoCelda = (await celda.textContent()).trim();
            if (textoCelda) {
              infoCeldas.push(textoCelda);
            }
          }
          
          if (infoCeldas.length > 0) {
            feedsEncontrados.push(infoCeldas);
            
            // Si estamos buscando un Feed ID específico
            if (feedIdAConsultar && texto.includes(feedIdAConsultar)) {
              feedEspecificoEncontrado = true;
              console.log('═══════════════════════════════════════════════════════════');
              console.log(`✅ FEED ${feedIdAConsultar} ENCONTRADO`);
              console.log('═══════════════════════════════════════════════════════════');
              console.log('');
              infoCeldas.forEach((info, idx) => {
                console.log(`   ${idx + 1}. ${info}`);
              });
              console.log('');
            }
          }
        }
      }
    }

    // Mostrar resumen de feeds encontrados
    if (feedsEncontrados.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📊 RESUMEN: ${feedsEncontrados.length} feed(s) encontrado(s)`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      
      // Mostrar los primeros 5 feeds
      const feedsAMostrar = feedsEncontrados.slice(0, 5);
      feedsAMostrar.forEach((feed, idx) => {
        console.log(`Feed #${idx + 1}:`);
        feed.forEach(info => {
          console.log(`   ${info}`);
        });
        console.log('');
      });
      
      if (feedsEncontrados.length > 5) {
        console.log(`   ... y ${feedsEncontrados.length - 5} más`);
        console.log('');
      }
    } else {
      console.log('⚠️  No se encontraron feeds en el historial');
      console.log('');
    }

    if (feedIdAConsultar && !feedEspecificoEncontrado) {
      console.log('⚠️  ADVERTENCIA: No se encontró el Feed ID específico en el historial');
      console.log(`   Feed ID buscado: ${feedIdAConsultar}`);
      console.log('');
      console.log('   Posibles razones:');
      console.log('   - El feed aún no aparece en el historial');
      console.log('   - El Feed ID es incorrecto');
      console.log('   - Hay un problema con la visualización de la página');
      console.log('');
    }

    console.log('💡 El navegador permanecerá abierto para que puedas revisar detalles');
    console.log('   Presiona ENTER para cerrar...');
    console.log('');

    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    // Guardar estado consultado
    if (feedIdAConsultar && feedsEncontrados.length > 0) {
      const projectsPath = path.join(__dirname, 'data', 'projects.json');
      if (fs.existsSync(projectsPath)) {
        const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
        
        if (projectsData.projects?.[sellerId]) {
          if (!projectsData.projects[sellerId].feed_checks) {
            projectsData.projects[sellerId].feed_checks = [];
          }
          
          projectsData.projects[sellerId].feed_checks.push({
            checked_at: new Date().toISOString(),
            feedId: feedIdAConsultar,
            feeds_found: feedsEncontrados.length
          });
          
          projectsData.last_updated = new Date().toISOString();
          fs.writeFileSync(projectsPath, JSON.stringify(projectsData, null, 2));
        }
      }
    }

    await browser.close();
    
    console.log('✅ Consulta finalizada');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('❌ Error durante la consulta:', err.message);
    console.error('');
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
})();
