const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * ENRIQUECEDOR DE PRODUCTOS EN LOTES
 * 
 * Procesa productos consolidados en lotes pequeños siguiendo el patrón de verificar_en_mx.js
 * Compatible con el sistema cerebro para procesamiento iterativo.
 * 
 * USO:
 *   node enrich-products-batch.js SELLER_ID [CANTIDAD]
 * 
 * EJEMPLO:
 *   node enrich-products-batch.js A3Q5ASRA7J8Y5E 20
 * 
 * PARÁMETROS:
 *   SELLER_ID: ID del vendedor (obligatorio)
 *   CANTIDAD: Número de productos a procesar en este lote (opcional, default: 50)
 * 
 * FUNCIONAMIENTO:
 * - Lee el archivo consolidado del vendedor
 * - Identifica productos sin datos de precio/vendedor actual
 * - Procesa CANTIDAD productos pendientes
 * - Actualiza el archivo consolidado in-place
 * - Puede ser llamado repetidamente hasta completar todos los productos
 */

// ========== CONFIGURACIÓN ==========
const SELLER_ID = process.argv[2];
const CANTIDAD = parseInt(process.argv[3], 10) || 50;

if (!SELLER_ID) {
  console.error('❌ Error: Debes proporcionar un SELLER_ID');
  console.log('📋 Uso: node enrich-products-batch.js SELLER_ID [CANTIDAD]');
  console.log('📋 Ejemplo: node enrich-products-batch.js A3Q5ASRA7J8Y5E 20');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const VENDOR_DIR = path.join(DATA_DIR, 'vendors', SELLER_ID);
const CONSOLIDATED_JSON = path.join(VENDOR_DIR, 'all-products-consolidated.json');

console.log(`🔧 Configuración:`);
console.log(`   📂 Vendedor: ${SELLER_ID}`);
console.log(`   📊 Lote: ${CANTIDAD} productos`);
console.log(`   📄 Archivo: ${CONSOLIDATED_JSON}`);

// ========== VALIDACIONES ==========
if (!fs.existsSync(CONSOLIDATED_JSON)) {
  console.error(`❌ No se encontró archivo consolidado: ${CONSOLIDATED_JSON}`);
  console.log('💡 Ejecuta primero: node process-vendor-categories.js');
  process.exit(1);
}

// ========== CARGAR DATOS ==========
console.log('📥 Cargando productos consolidados...');
const consolidatedData = JSON.parse(fs.readFileSync(CONSOLIDATED_JSON, 'utf8'));
const productos = consolidatedData.all_products || consolidatedData.products || consolidatedData;

if (!productos || !Array.isArray(productos)) {
  console.error('❌ El archivo consolidado no contiene un array válido de productos');
  console.error('📋 Estructura encontrada:', Object.keys(consolidatedData));
  process.exit(1);
}

console.log(`📊 Total productos consolidados: ${productos.length}`);

// ========== IDENTIFICAR PENDIENTES ==========
const pendientes = productos.filter(producto => {
  // Un producto está pendiente si NUNCA ha sido intentado
  const fecha = producto.fecha_enriquecimiento;
  
  // Si no tiene fecha_enriquecimiento, nunca ha sido procesado
  if (!fecha) {
    return true;
  }
  
  // Si tiene fecha pero es muy antigua (más de 7 días), re-procesar
  const fechaEnriquecimiento = new Date(fecha);
  const ahora = new Date();
  const diasDiferencia = (ahora - fechaEnriquecimiento) / (1000 * 60 * 60 * 24);
  
  return diasDiferencia > 7; // Re-enriquecer si tiene más de 7 días
});

console.log(`⏳ Productos pendientes de enriquecimiento: ${pendientes.length}`);

if (pendientes.length === 0) {
  console.log('✅ Todos los productos ya están enriquecidos y actualizados');
  process.exit(0);
}

// ========== SELECCIONAR LOTE ==========
const loteAProcesar = pendientes.slice(0, CANTIDAD);
console.log(`🔄 Procesando lote de ${loteAProcesar.length} productos`);

// ========== FUNCIÓN DE EXTRACCIÓN ==========
async function extraerDatosAmazonMX(page, asin, urlMX) {
  const resultado = {
    precio_actual_mx: null,
    vendedor_actual_mx: null,
    disponibilidad_mx: 'no disponible',
    fecha_enriquecimiento: new Date().toISOString(),
    error_enriquecimiento: null
  };

  try {
    console.log(`   🔍 Navegando a: ${urlMX}`);
    await page.goto(urlMX, { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });

    // Esperar a que cargue el contenido
    await page.waitForTimeout(2000);

    // Verificar si la página existe
    const titulo = await page.title();
    if (titulo.toLowerCase().includes('no encontramos') || 
        titulo.toLowerCase().includes('página no encontrada') ||
        titulo.toLowerCase().includes('lo sentimos')) {
      resultado.disponibilidad_mx = 'no listado';
      return resultado;
    }

    // Buscar el título del producto para confirmar que existe
    const tituloProducto = await page.$('#productTitle');
    if (!tituloProducto) {
      resultado.disponibilidad_mx = 'no listado';
      return resultado;
    }

    // Extraer precio
    const selectoresPrecio = [
      '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-price-whole',
      '.a-price-whole',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price .a-offscreen'
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
              console.log(`   💰 Precio encontrado: $${resultado.precio_actual_mx}`);
              break;
            }
          }
        }
      } catch (err) {
        // Continuar con el siguiente selector
      }
    }

    // Extraer vendedor
    const selectoresVendedor = [
      '#sellerProfileTriggerId',
      '[data-csa-c-type="link"][data-csa-c-slot-id="merchant-name"]',
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
    const disponibilidadElements = await page.$$('#availability span, #availability .a-color-success, #availability .a-color-price');
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
                  textoLimpio.includes('agotado')) {
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

  } catch (error) {
    console.log(`   ❌ Error procesando ${asin}: ${error.message}`);
    resultado.error_enriquecimiento = error.message;
  }

  return resultado;
}

// ========== PROCESAMIENTO PRINCIPAL ==========
(async () => {
  console.log('🚀 Iniciando navegador...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  try {
    let procesados = 0;
    
    for (const producto of loteAProcesar) {
      procesados++;
      const asin = producto.asin;
      const urlMX = `https://www.amazon.com.mx/dp/${asin}`;
      
      console.log(`\n🔄 (${procesados}/${loteAProcesar.length}) Procesando ASIN: ${asin}`);
      
      // Extraer datos actuales
      const datosActuales = await extraerDatosAmazonMX(page, asin, urlMX);
      
      // Actualizar el producto en el array principal
      const indiceProducto = productos.findIndex(p => p.asin === asin);
      if (indiceProducto !== -1) {
        // Mantener datos históricos y agregar datos actuales
        productos[indiceProducto] = {
          ...productos[indiceProducto],
          ...datosActuales
        };
      }

      // Delay aleatorio entre productos (3-6 segundos)
      const delay = Math.floor(Math.random() * 3000) + 3000;
      console.log(`   ⏳ Esperando ${delay / 1000}s...`);
      await page.waitForTimeout(delay);
    }

  } catch (error) {
    console.error(`❌ Error durante el procesamiento: ${error.message}`);
  } finally {
    await browser.close();
    console.log('🔚 Navegador cerrado');
  }

  // ========== GUARDAR RESULTADOS ==========
  console.log('\n💾 Guardando resultados...');
  
  try {
    // Actualizar el objeto consolidado y guardar
    if (consolidatedData.all_products) {
      consolidatedData.all_products = productos;
    } else if (consolidatedData.products) {
      consolidatedData.products = productos;
    } else {
      // Si es un array directo, mantener como array
      consolidatedData = productos;
    }
    
    fs.writeFileSync(CONSOLIDATED_JSON, JSON.stringify(consolidatedData, null, 2));
    console.log(`✅ JSON actualizado: ${CONSOLIDATED_JSON}`);
    
    // Regenerar CSV
    const CSV_PATH = path.join(VENDOR_DIR, 'all-products-consolidated.csv');
    
    if (productos.length > 0) {
      // Crear headers del CSV con todos los campos posibles
      const todosLosCampos = new Set();
      productos.forEach(producto => {
        Object.keys(producto).forEach(campo => todosLosCampos.add(campo));
      });
      
      const headers = Array.from(todosLosCampos).sort();
      
      // Función para escapar CSV
      const escapeCsv = (value) => {
        if (value == null) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      // Generar contenido CSV
      const csvContent = [
        headers.join(','), // Header
        ...productos.map(producto => 
          headers.map(header => escapeCsv(producto[header])).join(',')
        )
      ].join('\n');
      
      fs.writeFileSync(CSV_PATH, csvContent);
      console.log(`✅ CSV actualizado: ${CSV_PATH}`);
    }
    
    // ========== ESTADÍSTICAS FINALES ==========
    const totalPendientes = productos.filter(p => !p.precio_actual_mx || !p.vendedor_actual_mx).length;
    const totalEnriquecidos = productos.length - totalPendientes;
    
    console.log('\n📊 RESUMEN DEL LOTE:');
    console.log(`   ✅ Productos procesados este lote: ${loteAProcesar.length}`);
    console.log(`   📈 Total productos enriquecidos: ${totalEnriquecidos}/${productos.length}`);
    console.log(`   ⏳ Productos pendientes: ${totalPendientes}`);
    
    if (totalPendientes > 0) {
      console.log(`\n🔄 Para continuar, ejecuta:`);
      console.log(`   node enrich-products-batch.js ${SELLER_ID} ${CANTIDAD}`);
    } else {
      console.log(`\n🎉 ¡COMPLETADO! Todos los productos han sido enriquecidos.`);
    }
    
  } catch (error) {
    console.error(`❌ Error guardando resultados: ${error.message}`);
    process.exit(1);
  }
})();