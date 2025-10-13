const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dayjs = require('dayjs');

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  📤 SUBIDA DE PLANTILLA - Amazon Seller Central');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Dominio correcto (antes se usó .com.mx por error)
const SELLER_BASE = 'https://sellercentral.amazon.com';

// 🧠 Argumento: SELLER_ID
const sellerId = process.argv[2];
if (!sellerId) {
  console.error('❌ Debes proporcionar el SELLER_ID como argumento');
  console.error('');
  console.error('Uso: node subir-plantilla-seller.js SELLER_ID');
  console.error('Ejemplo: node subir-plantilla-seller.js A3Q5ASRA7J8Y5E');
  console.error('');
  process.exit(1);
}

console.log(`📦 Vendedor: ${sellerId}`);
console.log('');

// 📁 Rutas
const vendorDir = path.join(__dirname, 'data', 'vendors', sellerId);
const plantillasDir = path.join(vendorDir, 'plantillas');
const cookiePath = path.join(__dirname, 'scripts', 'auth', 'amazonseller.json');

if (!fs.existsSync(vendorDir)) {
  console.error(`❌ No existe el directorio del vendedor: ${vendorDir}`);
  process.exit(1);
}

if (!fs.existsSync(plantillasDir)) {
  console.error(`❌ No existe el directorio de plantillas: ${plantillasDir}`);
  console.error('   Asegúrate de haber llenado la plantilla primero.');
  console.error('');
  process.exit(1);
}

if (!fs.existsSync(cookiePath)) {
  console.error(`❌ No se encontró el archivo de cookies: ${cookiePath}`);
  console.error('   Ejecuta el script de login para generar las cookies.');
  console.error('');
  process.exit(1);
}

// 🔍 Buscar archivo "listo_para_subir" más reciente
const archivosFinales = fs.readdirSync(plantillasDir)
  .filter(f => f.startsWith('listo_para_subir_') && f.endsWith('.xlsx'))
  .map(f => ({
    archivo: f,
    fecha: fs.statSync(path.join(plantillasDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.fecha - a.fecha);

if (archivosFinales.length === 0) {
  console.error('❌ No se encontró archivo listo para subir');
  console.error('   Asegúrate de haber ejecutado llenar-plantilla-seller.js primero.');
  console.error('');
  process.exit(1);
}

const archivoASubir = path.join(plantillasDir, archivosFinales[0].archivo);
console.log(`📄 Archivo a subir: ${archivosFinales[0].archivo}`);
console.log('');

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
      acceptDownloads: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    // Navegar a página de carga masiva
    console.log('🌐 Navegando a página de carga masiva...');
    await page.goto(`${SELLER_BASE}/product-search/bulk`, {
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
      await page.goto(`${SELLER_BASE}/product-search/bulk`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      await page.waitForTimeout(3000);
    }

    // Buscar campo de archivo
    console.log('🔍 Buscando campo de carga...');
    const inputFileSelector = 'input[type="file"]';
    
    try {
      await page.waitForSelector(inputFileSelector, { timeout: 20000 });
    } catch (err) {
      console.error('❌ No se encontró el campo de carga de archivos');
      console.error('   Verifica que estás en la página correcta de Seller Central');
      console.error('');
      console.error('   El navegador permanecerá abierto para revisión...');
      console.error('   Presiona ENTER para cerrar...');
      
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      await browser.close();
      process.exit(1);
    }

    // Subir archivo
    console.log('📤 Subiendo archivo...');
    const inputFile = await page.$(inputFileSelector);
    await inputFile.setInputFiles(archivoASubir);

    console.log('⏳ Esperando procesamiento del archivo...');
    await page.waitForTimeout(5000);

    // Buscar botón "Enviar productos" o similar
    console.log('🔍 Buscando botón de envío...');
    
    // Intentar varios selectores posibles
    const posiblesSelectores = [
      'button:has-text("Enviar productos")',
      'button:has-text("Enviar")',
      'button:has-text("Submit")',
      'button[type="submit"]',
      'input[type="submit"]'
    ];

    let botonEnviar = null;
    for (const selector of posiblesSelectores) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        botonEnviar = await page.$(selector);
        if (botonEnviar) {
          console.log(`   Botón encontrado: ${selector}`);
          break;
        }
      } catch (err) {
        // Continuar con el siguiente selector
      }
    }

    if (!botonEnviar) {
      console.error('⚠️  No se encontró el botón de envío automáticamente');
      console.error('   El navegador permanecerá abierto para que completes manualmente');
      console.error('');
      console.error('   Presiona ENTER después de enviar manualmente...');
      
      // Esperar input del usuario
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      
      console.log('✅ Confirmado manualmente');
    } else {
      // Verificar si está habilitado
      const isDisabled = await botonEnviar.getAttribute('disabled');
      
      if (isDisabled === null) {
        console.log('✅ Haciendo clic en botón de envío...');
        await botonEnviar.click();
        await page.waitForTimeout(5000);
        
        console.log('📦 Archivo enviado correctamente');
      } else {
        console.error('⚠️  El botón está deshabilitado');
        console.error('   Puede haber un error en el archivo o faltan campos');
        console.error('   Revisa la página para ver mensajes de error');
        
        // Mantener navegador abierto
        console.error('');
        console.error('   Presiona ENTER para cerrar...');
        await new Promise(resolve => {
          process.stdin.once('data', () => resolve());
        });
      }
    }

    // Intentar capturar Feed ID si está visible
    console.log('');
    console.log('🔍 Buscando Feed ID...');
    await page.waitForTimeout(3000);
    
    let feedId = null;
    try {
      // Buscar en la página algún elemento que contenga el Feed ID
      const feedIdElement = await page.$('text=/Feed.*ID/i');
      if (feedIdElement) {
        const text = await feedIdElement.textContent();
        const match = text.match(/([0-9]+)/);
        if (match) {
          feedId = match[1];
          console.log(`✅ Feed ID capturado: ${feedId}`);
        }
      }
    } catch (err) {
      console.log('   No se pudo capturar el Feed ID automáticamente');
      console.log('   Revisa el historial en Seller Central para obtenerlo');
    }

    // Guardar registro de subida
    const fecha = dayjs().format('YYYY-MM-DD_HH-mm-ss');
    const registroPath = path.join(vendorDir, 'subidas.json');
    
    let registros = [];
    if (fs.existsSync(registroPath)) {
      registros = JSON.parse(fs.readFileSync(registroPath, 'utf8'));
    }
    
    registros.push({
      fecha: fecha,
      archivo: archivosFinales[0].archivo,
      feedId: feedId,
      sellerId: sellerId
    });
    
    fs.writeFileSync(registroPath, JSON.stringify(registros, null, 2));
    console.log(`📝 Registro guardado en: ${registroPath}`);

    // Actualizar projects.json
    const projectsPath = path.join(__dirname, 'data', 'projects.json');
    if (fs.existsSync(projectsPath)) {
      const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      if (!projectsData.projects) projectsData.projects = {};
      if (!projectsData.projects[sellerId]) projectsData.projects[sellerId] = {};
      
      if (!projectsData.projects[sellerId].uploads) {
        projectsData.projects[sellerId].uploads = [];
      }
      
      projectsData.projects[sellerId].uploads.push({
        uploaded_at: new Date().toISOString(),
        archivo: archivosFinales[0].archivo,
        feedId: feedId
      });
      
      projectsData.last_updated = new Date().toISOString();
      fs.writeFileSync(projectsPath, JSON.stringify(projectsData, null, 2));
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ PLANTILLA SUBIDA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📦 Vendedor: ${sellerId}`);
    console.log(`📄 Archivo: ${archivosFinales[0].archivo}`);
    if (feedId) {
      console.log(`🆔 Feed ID: ${feedId}`);
    }
    console.log('');
    console.log('⏭️  Siguiente paso: Consultar estado del feed (en unos minutos)');
    if (feedId) {
      console.log(`   node consultar-estado-feed-seller.js ${sellerId} ${feedId}`);
    } else {
      console.log(`   node consultar-estado-feed-seller.js ${sellerId}`);
      console.log('   (El script buscará el Feed ID más reciente)');
    }
    console.log('');
    console.log('💡 También puedes revisar el estado en Seller Central:');
  console.log(`   ${SELLER_BASE}/product-search/bulk/status`);
    console.log('');

    await browser.close();
  } catch (err) {
    console.error('');
    console.error('❌ Error durante la subida:', err.message);
    console.error('');
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
})();
