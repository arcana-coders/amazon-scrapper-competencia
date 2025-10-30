const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SELLER_ID = process.argv[2];
const BATCH_NUMBER = process.argv[3]; // Puede ser número o "all"
const LOTE = Math.min(parseInt(process.argv[4], 10) || 20, 100); // Máximo 100 productos por lote

if (!SELLER_ID) {
  console.error('❌ Debes indicar el SELLER_ID.');
  console.log('📖 Uso:');
  console.log('   node verify-products-mx-batch.js SELLER_ID [BATCH_NUM] [CANTIDAD]');
  console.log('');
  console.log('📝 Ejemplos:');
  console.log('   node verify-products-mx-batch.js A3Q5ASRA7J8Y5E         # Vendedor pequeño (all-products)');
  console.log('   node verify-products-mx-batch.js A3Q5ASRA7J8Y5E 1       # Solo batch 1');
  console.log('   node verify-products-mx-batch.js A3Q5ASRA7J8Y5E 1 10    # Batch 1, lotes de 10');
  console.log('   node verify-products-mx-batch.js A3Q5ASRA7J8Y5E all    # Todos los batches');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data', 'vendors', SELLER_ID);

// Determinar qué archivo procesar
let CONSOLIDATED_JSON, CONSOLIDATED_CSV;
let isBatchMode = false;

if (BATCH_NUMBER && BATCH_NUMBER !== 'all') {
  // Modo batch individual
  isBatchMode = true;
  CONSOLIDATED_JSON = path.join(DATA_DIR, `batch-${BATCH_NUMBER}-consolidated.json`);
  CONSOLIDATED_CSV = path.join(DATA_DIR, `batch-${BATCH_NUMBER}-consolidated.csv`);
  console.log(`📦 Verificando en MX - BATCH ${BATCH_NUMBER} del vendedor ${SELLER_ID}`);
} else if (BATCH_NUMBER === 'all') {
  // Modo "todos los batches" - procesa all-products
  CONSOLIDATED_JSON = path.join(DATA_DIR, 'all-products-consolidated.json');
  CONSOLIDATED_CSV = path.join(DATA_DIR, 'all-products-consolidated.csv');
  console.log(`📦 Verificando en MX - TODOS los batches del vendedor ${SELLER_ID}`);
} else {
  // Modo vendedor pequeño (sin batch)
  CONSOLIDATED_JSON = path.join(DATA_DIR, 'all-products-consolidated.json');
  CONSOLIDATED_CSV = path.join(DATA_DIR, 'all-products-consolidated.csv');
  console.log(`📦 Verificando en MX - vendedor pequeño ${SELLER_ID}`);
}

if (!fs.existsSync(CONSOLIDATED_JSON)) {
  console.error(`❌ No existe el archivo ${CONSOLIDATED_JSON}`);
  if (isBatchMode) {
    console.log('💡 Asegúrate de haber consolidado el batch primero con consolidate-batch-products.js');
  }
  process.exit(1);
}

console.log(`🔧 Preparando verificación MX para ${SELLER_ID} (lote de ${LOTE})`);
const rawData = JSON.parse(fs.readFileSync(CONSOLIDATED_JSON, 'utf8'));
const productos = rawData.all_products || rawData.products || rawData;

if (!Array.isArray(productos)) {
  console.error('❌ Formato inesperado en el consolidado');
  process.exit(1);
}

const esPendienteMX = (producto) => {
  const fecha = producto.fecha_verificacion_mx;
  if (!fecha) return true;

  const dias = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24);
  if (dias > 7) return true;

  const disponibilidad = (producto.disponibilidad_mx || '').toLowerCase();
  const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
  const missingCriticos = (!producto.precio_actual_mx && !producto.vendedor_actual_mx) && !producto.error_verificacion_mx;

  return requiereDatos && missingCriticos;
};

const pendientes = productos.filter(esPendienteMX);

if (pendientes.length === 0) {
  console.log('✅ Todos los productos ya tienen verificación MX reciente.');
  process.exit(0);
}

const lote = pendientes.slice(0, LOTE);
console.log(`⏳ Se procesarán ${lote.length} productos de ${pendientes.length} pendientes.`);

async function extraerDatosMX(page, asin) {
  const url = `https://www.amazon.com.mx/dp/${asin}`;
  const resultado = {
    url_mx: url,
    precio_actual_mx: null,
    vendedor_actual_mx: null,
    disponibilidad_mx: 'no disponible',
    fecha_verificacion_mx: new Date().toISOString(),
    error_verificacion_mx: null
  };

  try {
    console.log(`   🌐 Visitando ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Pequeña interacción aleatoria para imitar comportamiento humano
    const randomScroll = Math.floor(Math.random() * 400) + 200;
    await page.evaluate(y => window.scrollBy(0, y), randomScroll);
    await page.waitForTimeout(Math.floor(Math.random() * 800) + 400);
    await page.mouse.move(
      Math.floor(Math.random() * 1200) + 50,
      Math.floor(Math.random() * 600) + 50,
      { steps: 5 }
    );

    // Verificar si la página existe
    const titulo = await page.title();
    if (titulo.toLowerCase().includes('no encontramos') || 
        titulo.toLowerCase().includes('página no encontrada') ||
        titulo.toLowerCase().includes('lo sentimos')) {
      resultado.disponibilidad_mx = 'no listado';
      return resultado;
    }

    const tituloProducto = await page.$('#productTitle');
    if (!tituloProducto) {
      resultado.disponibilidad_mx = 'no listado';
      return resultado;
    }

    // Extraer precio - Selectores actualizados para MX
    const selectoresPrecio = [
      '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-price-whole',
      '#corePrice_feature_div .a-price .a-offscreen',
      '.a-price-whole',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '#price_inside_buybox'
    ];

    for (const selector of selectoresPrecio) {
      try {
        const precioElemento = await page.$(selector);
        if (precioElemento) {
          let precioTexto = await precioElemento.textContent();
          if (precioTexto) {
            // Limpiar el precio: extraer solo números y punto decimal
            const precio = precioTexto.replace(/[^\d.,]/g, '').replace(',', '');
            if (precio && !isNaN(parseFloat(precio))) {
              resultado.precio_actual_mx = parseFloat(precio);
              console.log(`   💰 Precio encontrado: $${resultado.precio_actual_mx} MXN`);
              break;
            }
          }
        }
      } catch (err) {
        // Continuar con el siguiente selector
      }
    }

    // Extraer vendedor - Selectores específicos para MX
    const selectoresVendedor = [
      '#sellerProfileTriggerId',
      '[data-csa-c-type="link"][data-csa-c-slot-id="merchant-name"]',
      '#merchant-info a',
      '#tabular-buybox .tabular-buybox-text[tabular-attribute-ending="soldby"]',
      '#buybox-tabular .tabular-buybox-column .a-link-normal',
      '#bylineInfo',
      '.author .a-link-normal'
    ];

    for (const selector of selectoresVendedor) {
      try {
        const vendedorElemento = await page.$(selector);
        if (vendedorElemento) {
          const vendedorTexto = await vendedorElemento.textContent();
          if (vendedorTexto && vendedorTexto.trim()) {
            resultado.vendedor_actual_mx = vendedorTexto.trim();
            console.log(`   🏪 Vendedor encontrado: ${resultado.vendedor_actual_mx}`);
            break;
          }
        }
      } catch (err) {
        // Continuar con el siguiente selector
      }
    }

    // Verificar disponibilidad
    const disponibilidadElements = await page.$$('#availability span, #availability .a-color-success, #availability .a-color-price, #availability .a-color-state');
    for (const elem of disponibilidadElements) {
      const texto = await elem.textContent();
      if (texto) {
        const textoLimpio = texto.toLowerCase().trim();
        if (textoLimpio.includes('en stock') || 
            textoLimpio.includes('disponible') ||
            textoLimpio.includes('entrega')) {
          resultado.disponibilidad_mx = 'disponible';
          break;
        } else if (textoLimpio.includes('no disponible') || 
                  textoLimpio.includes('agotado') ||
                  textoLimpio.includes('out of stock')) {
          resultado.disponibilidad_mx = 'no disponible';
          break;
        }
      }
    }

    // Si encontramos precio, asumimos que está disponible
    if (resultado.precio_actual_mx && resultado.disponibilidad_mx === 'no disponible') {
      resultado.disponibilidad_mx = 'disponible';
    }

    console.log(`   ✅ Disponibilidad: ${resultado.disponibilidad_mx}`);

    if (!resultado.error_verificacion_mx && resultado.disponibilidad_mx === 'disponible' && !resultado.precio_actual_mx && !resultado.vendedor_actual_mx) {
      resultado.error_verificacion_mx = 'PRICE_AND_SELLER_NOT_FOUND';
    }

  } catch (err) {
    console.log(`   ❌ Error con ${asin}: ${err.message}`);
    resultado.error_verificacion_mx = err.message;
  }

  return resultado;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  
  // 🔥 USAR COOKIES DE AMAZON MX (amazonmx.json)
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'auth', 'amazonmx.json'),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  try {
    let indice = 0;
    for (const producto of lote) {
      indice++;
      const asin = producto.asin;
      if (!asin) continue;

      const datosMX = await extraerDatosMX(page, asin);
      const idxGlobal = productos.findIndex(p => p.asin === asin);
      if (idxGlobal !== -1) {
        productos[idxGlobal] = {
          ...productos[idxGlobal],
          ...datosMX
        };
      }

      const delay = Math.floor(Math.random() * 2000) + 2000; // 2-4 segundos
      console.log(`   ⏳ Esperando ${delay / 1000}s (${indice}/${lote.length})`);
      await page.waitForTimeout(delay);
      // Scroll adicional entre productos para variar patrón
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  } finally {
    await browser.close();
  }

  if (rawData.all_products) {
    rawData.all_products = productos;
  } else if (rawData.products) {
    rawData.products = productos;
  }

  fs.writeFileSync(CONSOLIDATED_JSON, JSON.stringify(rawData, null, 2));
  console.log(`💾 JSON actualizado: ${CONSOLIDATED_JSON}`);

  const todosLosCampos = new Set();
  productos.forEach(p => Object.keys(p).forEach(k => todosLosCampos.add(k)));
  const headers = Array.from(todosLosCampos).sort();

  const escapeCsv = value => {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const csvContenido = [
    headers.join(','),
    ...productos.map(p => headers.map(h => escapeCsv(p[h])).join(','))
  ].join('\n');

  fs.writeFileSync(CONSOLIDATED_CSV, csvContenido);
  console.log(`📄 CSV actualizado: ${CONSOLIDATED_CSV}`);

  const pendientesRestantes = productos.filter(esPendienteMX).length;
  console.log('');
  console.log('✅ Verificación MX completada');
  console.log('📊 Resumen:');
  console.log(`   Procesados en este lote: ${lote.length}`);
  console.log(`   Pendientes restantes: ${pendientesRestantes}`);
  console.log('');
  
  if (pendientesRestantes > 0) {
    console.log('💡 Aún quedan productos pendientes. Ejecuta el script nuevamente para continuar.');
  } else {
    console.log('🎉 ¡Todos los productos han sido verificados en MX!');
    console.log('📌 Siguiente paso: Ejecutar verify-products-usa-batch.js para verificar precios USA');
  }
})();
