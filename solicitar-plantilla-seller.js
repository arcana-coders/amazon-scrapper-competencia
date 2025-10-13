const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const csv = require('csv-parser');

/**
 * SOLICITUD DE PLANTILLA PARA AMAZON SELLER CENTRAL
 * 
 * Sube una lista de ASINs con precios a Amazon Seller Central para solicitar
 * una plantilla de carga masiva.
 * 
 * USO:
 *   node solicitar-plantilla-seller.js SELLER_ID OPCION
 * 
 * PARÁMETROS:
 *   SELLER_ID: ID del vendedor (obligatorio)
 *   OPCION: Número de archivo a usar (obligatorio)
 *     1 = oportunidades.csv
 *     2 = oportunidades_menos_50.csv
 *     3 = oportunidades_menos_100.csv
 * 
 * EJEMPLO:
 *   node solicitar-plantilla-seller.js A3Q5ASRA7J8Y5E 1
 * 
 * SALIDA:
 *   Solicita plantilla en Seller Central con los ASINs del archivo elegido
 */

// ========== VALIDACIÓN DE ARGUMENTOS ==========
const SELLER_ID = process.argv[2];
const OPCION = process.argv[3];

if (!SELLER_ID) {
  console.error('❌ Error: Debes proporcionar un SELLER_ID');
  console.error('📋 Uso: node solicitar-plantilla-seller.js SELLER_ID OPCION');
  console.error('📋 Ejemplo: node solicitar-plantilla-seller.js A3Q5ASRA7J8Y5E 1');
  process.exit(1);
}

if (!OPCION || !['1', '2', '3'].includes(OPCION)) {
  console.error('❌ Error: La opción debe ser 1, 2 o 3');
  console.error('   1 = oportunidades.csv');
  console.error('   2 = oportunidades_menos_50.csv');
  console.error('   3 = oportunidades_menos_100.csv');
  process.exit(1);
}

// ========== CONFIGURACIÓN DE RUTAS ==========
const COOKIE_PATH = path.join(__dirname, 'scripts', 'auth', 'amazonseller.json');
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);

// Mapeo de opciones a nombres de archivo
const ARCHIVO_MAP = {
  '1': 'oportunidades.csv',
  '2': 'oportunidades_menos_50.csv',
  '3': 'oportunidades_menos_100.csv'
};

const ARCHIVO_NOMBRE = ARCHIVO_MAP[OPCION];
const CSV_PATH = path.join(VENDOR_DIR, ARCHIVO_NOMBRE);

console.log('🔧 Configuración:');
console.log(`   📂 Vendedor: ${SELLER_ID}`);
console.log(`   📄 Archivo: ${ARCHIVO_NOMBRE}`);
console.log(`   🍪 Cookies: ${COOKIE_PATH}`);

// ========== VALIDACIONES ==========
if (!fs.existsSync(COOKIE_PATH)) {
  console.error(`❌ No se encontró el archivo de cookies: ${COOKIE_PATH}`);
  console.error('💡 Ejecuta primero: node scripts/login_seller.js');
  process.exit(1);
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ No se encontró el archivo: ${CSV_PATH}`);
  console.error('💡 Asegúrate de haber generado los archivos de oportunidades primero.');
  console.error('💡 Ejecuta: node buscando_productos_csv.js ' + SELLER_ID);
  process.exit(1);
}

// ========== FUNCIONES AUXILIARES ==========

/**
 * Lee ASINs y precios desde el archivo CSV de oportunidades
 */
function leerAsinsDesdeArchivo(rutaCsv) {
  return new Promise((resolve, reject) => {
    const productos = [];
    let asinField = null;
    let precioField = null;

    fs.createReadStream(rutaCsv)
      .pipe(csv())
      .on('headers', (headers) => {
        console.log(`📊 Columnas encontradas: ${headers.join(', ')}`);

        // Buscar columna de ASIN
        for (const h of headers) {
          const limpio = h.trim().replace(/"/g, '').replace(/\uFEFF/g, '').toLowerCase();
          if (limpio === 'asin') {
            asinField = h;
            break;
          }
        }

        // Buscar columna de precio competitivo o sugerido
        for (const h of headers) {
          const limpio = h.trim().replace(/"/g, '').replace(/\uFEFF/g, '').toLowerCase();
          if (limpio === 'precio_competitivo') {
            precioField = h;
            break;
          } else if (limpio === 'precio_sugerido' && !precioField) {
            precioField = h;
          }
        }

        if (!asinField) {
          console.error('❌ No se encontró la columna "asin" en el CSV');
        }
        if (!precioField) {
          console.error('❌ No se encontró columna de precio (precio_competitivo o precio_sugerido)');
        }
      })
      .on('data', (row) => {
        if (!asinField || !precioField) return;

        const asin = (row[asinField] || '').trim().replace(/"/g, '').replace(/\uFEFF/g, '');
        const precioRaw = (row[precioField] || '').trim().replace(/"/g, '');
        
        if (asin && precioRaw) {
          const precio = parseFloat(precioRaw);
          if (!isNaN(precio) && precio > 0) {
            productos.push({ asin, precio });
          }
        }
      })
      .on('end', () => {
        console.log(`✅ ${productos.length} productos con ASIN y precio válidos encontrados`);
        resolve(productos);
      })
      .on('error', reject);
  });
}

// ========== PROCESO PRINCIPAL ==========
(async () => {
  console.log('');
  console.log('🚀 Iniciando proceso de solicitud de plantilla...');
  
  // Leer productos del CSV
  const productos = await leerAsinsDesdeArchivo(CSV_PATH);
  
  if (productos.length === 0) {
    console.error('❌ No se encontraron productos válidos en el archivo');
    process.exit(1);
  }

  // Limitar a 500 productos por lote (límite de Amazon)
  const productosASubir = productos.slice(0, 500);
  if (productos.length > 500) {
    console.log(`⚠️  Se procesarán los primeros 500 productos de ${productos.length} totales`);
  }

  console.log(`📦 Procesando ${productosASubir.length} productos...`);

  // Preparar lista de ASINs para el textarea
  const asinsParaTextarea = productosASubir.map(p => p.asin);

  // Lanzar navegador con las cookies de Seller Central
  console.log('🌐 Abriendo navegador...');
  const browser = await chromium.launch({ 
    headless: false  // Cambiar a true para modo silencioso
  });
  
  const context = await browser.newContext({
    storageState: COOKIE_PATH
  });

  const page = await context.newPage();
  
  console.log('📄 Navegando a la página de generación de plantilla...');
  await page.goto('https://sellercentral.amazon.com/product-search/bulk/generate/add-offer', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Esperar y llenar el textarea con los ASINs
  console.log('📝 Ingresando ASINs...');
  const textareaSelector = 'textarea[placeholder*="identificadores"]';
  await page.waitForSelector(textareaSelector, { timeout: 15000 });

  await page.fill(textareaSelector, asinsParaTextarea.join('\n'));
  await page.keyboard.press('Enter');
  await page.dispatchEvent(textareaSelector, 'blur');
  
  console.log('⏳ Esperando procesamiento de ASINs...');
  await page.waitForTimeout(3000);

  // Esperar el botón de generar plantilla
  console.log('🔍 Buscando botón de generación...');
  await page.waitForSelector('div.form-generate-template-button button[type="button"]', {
    timeout: 30000,
    state: 'visible'
  });

  const boton = await page.$('div.form-generate-template-button button[type="button"]');
  const isDisabled = await boton.getAttribute('disabled');

  if (isDisabled === null) {
    console.log('✅ Botón habilitado. Solicitando plantilla...');
    await boton.click();
    await page.waitForTimeout(5000);
    
    console.log('');
    console.log('🎉 Plantilla solicitada exitosamente');
    console.log(`📊 Total ASINs enviados: ${productosASubir.length}`);
    console.log(`📂 Archivo procesado: ${ARCHIVO_NOMBRE}`);
    console.log('');
    console.log('📋 Próximos pasos:');
    console.log('   1. Espera unos minutos a que Amazon genere la plantilla');
    console.log('   2. Descarga la plantilla desde Seller Central');
    console.log('   3. Llena la plantilla con los datos de precio');
    console.log('   4. Sube la plantilla completada para publicar los productos');
    
    await browser.close();
    process.exit(0);
  } else {
    console.error('');
    console.error('❌ El botón aún está deshabilitado.');
    console.error('💡 Posibles causas:');
    console.error('   - Los ASINs no son válidos');
    console.error('   - Ya existen en tu inventario');
    console.error('   - Hay un problema de conexión');
    console.error('');
    console.error('🔍 Revisa la interfaz del navegador para más detalles.');
    
    await browser.close();
    process.exit(1);
  }
})().catch((error) => {
  console.error('');
  console.error('❌ Error durante el proceso:', error.message);
  console.error('');
  process.exit(1);
});
