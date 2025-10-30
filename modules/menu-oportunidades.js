/**
 * MÓDULO: GENERAR OPORTUNIDADES (FASE 5)
 * 
 * Genera archivos CSV con productos que representan oportunidades de negocio:
 * - oportunidades.csv: Precio sugerido < Precio actual
 * - oportunidades_menos_50.csv: Precio sugerido - $50 < Precio actual
 * - oportunidades_menos_100.csv: Precio sugerido - $100 < Precio actual
 */

const { spawn } = require('child_process');
const { 
  typewriteLine, 
  showTitle, 
  showInfo, 
  showError, 
  showSuccess, 
  showWarning,
  showSeparator,
  ask, 
  clearScreen 
} = require('./utils/display-utils');
const { listVendorIds, getVendorInfo } = require('./utils/projects-utils');
const { 
  vendorDirExists, 
  getBatchConsolidatedFiles,
  getVerificationStatus,
  countOpportunities,
  detectVendorPhase
} = require('./utils/vendor-utils');
const path = require('path');

/**
 * Menú principal de oportunidades
 */
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await clearScreen();
    await showTitle('GENERAR OPORTUNIDADES (FASE 5)', { icon: '💰' });
    await typewriteLine('');
    await showInfo('Filtra productos con potencial de negocio basado en precios competitivos');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await typewriteLine('  [1] 🎯 Generar oportunidades de un vendedor');
    await typewriteLine('  [2] 📊 Ver resumen de oportunidades');
    await typewriteLine('  [0] ← Volver al menú principal');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    switch (opcion) {
      case '1':
        await generarOportunidades(rl);
        break;
      case '2':
        await verResumenOportunidades(rl);
        break;
      case '0':
        continuar = false;
        break;
      default:
        await showError('❌ Opción no válida');
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}

/**
 * Generar oportunidades de un vendedor
 */
async function generarOportunidades(rl) {
  await clearScreen();
  await showTitle('GENERAR OPORTUNIDADES', { icon: '🎯' });
  await typewriteLine('');
  
  // Listar vendedores disponibles
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await typewriteLine('');
    await showInfo('Primero registra un vendedor en el menú [1] Gestión de Vendedores');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Mostrar lista de vendedores
  await showInfo('Vendedores disponibles:');
  await typewriteLine('');
  for (let idx = 0; idx < vendors.length; idx++) {
    const vendor = vendors[idx];
    const phaseInfo = detectVendorPhase(vendor);
    
    let icon = '📦';
    if (phaseInfo.ready) icon = '✅';
    else if (phaseInfo.phase >= 3) icon = '⏳';
    
    await typewriteLine(`  [${idx + 1}] ${icon} ${vendor} - ${phaseInfo.label}`);
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  
  const seleccion = await ask(rl, '👉 Selecciona un vendedor (número) o [0] para cancelar: ');
  
  if (seleccion === '0') {
    return;
  }
  
  const vendorIndex = parseInt(seleccion) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const sellerId = vendors[vendorIndex];
  
  if (!vendorDirExists(sellerId)) {
    await showError(`No existe el directorio del vendedor ${sellerId}`);
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Detectar si es vendedor pequeño o con batches
  const batches = getBatchConsolidatedFiles(sellerId);
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  
  if (batches.length > 0) {
    // Vendedor con batches
    await showInfo(`Vendedor con batches detectado (${batches.length} batches disponibles)`);
    await typewriteLine('');
    await typewriteLine('  [1] 🎯 Generar oportunidades de batch específico');
    await typewriteLine('  [2] 🔄 Generar oportunidades de todos los batches');
    await typewriteLine('  [3] 📦 Generar oportunidades consolidadas (máx 500 ASINs por archivo)');
    await typewriteLine('  [0] ← Cancelar');
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    if (opcion === '0') {
      return;
    } else if (opcion === '1') {
      await generarOportunidadesBatchEspecifico(rl, sellerId, batches);
    } else if (opcion === '2') {
      await generarOportunidadesTodosLosBatches(rl, sellerId, batches);
    } else if (opcion === '3') {
      await generarOportunidadesConsolidadas(rl, sellerId, batches);
    } else {
      await showError('Opción inválida');
      await ask(rl, '\nPresiona ENTER para continuar...');
    }
  } else {
    // Vendedor pequeño
    await showInfo('Vendedor pequeño detectado (sin batches)');
    await typewriteLine('');
    await generarOportunidadesVendedorPequeno(rl, sellerId);
  }
}

/**
 * Generar oportunidades de batch específico
 */
async function generarOportunidadesBatchEspecifico(rl, sellerId, batches) {
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo('Batches disponibles:');
  await typewriteLine('');
  
  // Mostrar estado de verificación de cada batch
  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    const status = getVerificationStatus(sellerId, batch.number);
    const verified = status ? `${status.verified}/${status.total} verificados` : 'Sin verificar';
    await typewriteLine(`  [${idx + 1}] Batch ${batch.number} (${verified})`);
  }
  
  await typewriteLine('');
  const seleccion = await ask(rl, '👉 Selecciona un batch (número) o [0] para cancelar: ');
  
  if (seleccion === '0') {
    return;
  }
  
  const batchIndex = parseInt(seleccion) - 1;
  if (batchIndex < 0 || batchIndex >= batches.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const batchNumber = batches[batchIndex].number;
  
  // Verificar que el batch tenga verificaciones MX y USA completas
  const phaseInfo = detectVendorPhase(sellerId);
  
  if (!phaseInfo.ready) {
    await typewriteLine('');
    await showWarning(`⚠️  El vendedor no está listo para generar oportunidades`);
    await showInfo(`Estado actual: ${phaseInfo.label}`);
    
    if (phaseInfo.stats) {
      await typewriteLine('');
      await typewriteLine(`   📊 Productos totales: ${phaseInfo.stats.total}`);
      await typewriteLine(`   🇲🇽 Verificados MX: ${phaseInfo.stats.mx}/${phaseInfo.stats.total}`);
      await typewriteLine(`   🇺🇸 Verificados USA: ${phaseInfo.stats.usa}/${phaseInfo.stats.total}`);
      await typewriteLine('');
      
      if (phaseInfo.stats.mx < phaseInfo.stats.total) {
        await showInfo('❌ Falta completar verificación MX - Menú [4]');
      }
      if (phaseInfo.stats.usa < phaseInfo.stats.total) {
        await showInfo('❌ Falta completar verificación USA - Menú [5]');
      }
    }
    
    await typewriteLine('');
    await showInfo('💡 Ambas verificaciones (MX y USA) deben estar al 100% antes de generar oportunidades');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showSuccess(`✅ Vendedor listo para generar oportunidades`);
  await showWarning(`Generando oportunidades del batch ${batchNumber}...`);
  await typewriteLine('');
  
  // Ejecutar scripts
  await ejecutarGeneracionOportunidades(rl, sellerId, batchNumber);
}

/**
 * Generar oportunidades de todos los batches
 */
async function generarOportunidadesTodosLosBatches(rl, sellerId, batches) {
  await typewriteLine('');
  await showWarning(`Se generarán oportunidades para ${batches.length} batches`);
  await showInfo('Esto procesará cada batch secuencialmente');
  await typewriteLine('');
  
  const confirmar = await ask(rl, '¿Continuar? (s/n): ');
  
  if (confirmar.toLowerCase() !== 's') {
    return;
  }
  
  for (const batch of batches) {
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await showWarning(`Generando oportunidades del batch ${batch.number}...`);
    await typewriteLine('');
    
    await ejecutarGeneracionOportunidades(rl, sellerId, batch.number);
    
    // Pausa entre batches
    if (batch !== batches[batches.length - 1]) {
      await typewriteLine('');
      await showInfo('Pausa de 2 segundos antes del siguiente batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await typewriteLine('');
  await showSuccess('✅ Generación de oportunidades completada para todos los batches');
  await ask(rl, '\nPresiona ENTER para continuar...');
}

/**
 * Generar oportunidades de vendedor pequeño
 */
async function generarOportunidadesVendedorPequeno(rl, sellerId) {
  // Verificar que esté verificado
  const status = getVerificationStatus(sellerId, null);
  if (!status || status.verified === 0) {
    await showWarning('⚠️  El vendedor no tiene productos verificados en USA');
    await showInfo('Primero ejecuta la verificación USA en el menú [4] Verificar en USA');
    await typewriteLine('');
    const continuar = await ask(rl, '¿Generar oportunidades de todos modos? (s/n): ');
    if (continuar.toLowerCase() !== 's') {
      return;
    }
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning('Generando oportunidades del vendedor completo...');
  await typewriteLine('');
  
  await ejecutarGeneracionOportunidades(rl, sellerId, null);
}

/**
 * Ejecutar scripts de generación de oportunidades
 */
async function ejecutarGeneracionOportunidades(rl, sellerId, batchNumber) {
  const rootDir = path.join(__dirname, '..');
  
  // Paso 1: Ejecutar prepare_business_csv.js
  await showInfo('📊 Paso 1/2: Filtrando productos con precios válidos...');
  await typewriteLine('');
  
  const success1 = await ejecutarScript(
    path.join(rootDir, 'prepare_business_csv.js'),
    batchNumber ? [sellerId, batchNumber] : [sellerId]
  );
  
  if (!success1) {
    await showError('❌ Error al filtrar productos');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await typewriteLine('');
  await showInfo('📊 Paso 2/2: Generando archivos de oportunidades...');
  await typewriteLine('');
  
  // Paso 2: Ejecutar buscando_productos_csv.js
  const success2 = await ejecutarScript(
    path.join(rootDir, 'buscando_productos_csv.js'),
    batchNumber ? [sellerId, batchNumber] : [sellerId]
  );
  
  if (!success2) {
    await showError('❌ Error al generar oportunidades');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Mostrar resumen
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showSuccess('✅ Oportunidades generadas exitosamente');
  await typewriteLine('');
  
  // Contar oportunidades
  try {
    const counts = await countOpportunities(sellerId, batchNumber);
    if (counts && counts.total > 0) {
      await showInfo('📈 Resumen de oportunidades:');
      await typewriteLine('');
      await typewriteLine(`   Principal: ${counts.principal} productos`);
      await typewriteLine(`   Menos $50: ${counts.menos50} productos`);
      await typewriteLine(`   Menos $100: ${counts.menos100} productos`);
      await typewriteLine(`   Total: ${counts.total} oportunidades encontradas`);
    } else {
      await showWarning('⚠️  No se encontraron oportunidades');
    }
  } catch (err) {
    await showWarning('No se pudo calcular el resumen de oportunidades');
  }
  
  await typewriteLine('');
  await showInfo('📌 Siguiente paso: Usar el menú [6] PLANTILLAS para generar templates');
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Ejecutar script externo
 */
function ejecutarScript(scriptPath, args) {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Ver resumen de oportunidades
 */
async function verResumenOportunidades(rl) {
  await clearScreen();
  await showTitle('RESUMEN DE OPORTUNIDADES', { icon: '📊' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showInfo('Selecciona un vendedor para ver su resumen:');
  await typewriteLine('');
  
  for (let idx = 0; idx < vendors.length; idx++) {
    await typewriteLine(`  [${idx + 1}] ${vendors[idx]}`);
  }
  
  await typewriteLine('');
  const seleccion = await ask(rl, '👉 Selecciona un vendedor (número) o [0] para cancelar: ');
  
  if (seleccion === '0') {
    return;
  }
  
  const vendorIndex = parseInt(seleccion) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const sellerId = vendors[vendorIndex];
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning(`Analizando oportunidades de ${sellerId}...`);
  await typewriteLine('');
  
  // Detectar batches
  const batches = getBatchConsolidatedFiles(sellerId);
  const vendorInfo = getVendorInfo(sellerId);
  const isLarge = vendorInfo?.is_large_vendor || false;
  
  if (isLarge && batches.length > 0) {
    // Mostrar resumen por batch
    await showInfo(`Vendedor con ${batches.length} batches:`);
    await typewriteLine('');
    
    let totalGeneral = 0;
    for (const batch of batches) {
      try {
        const counts = await countOpportunities(sellerId, batch.number);
        
        if (counts && counts.total > 0) {
          await typewriteLine(`  📦 Batch ${batch.number}:`);
          await typewriteLine(`     Principal: ${counts.principal}`);
          await typewriteLine(`     Menos $50: ${counts.menos50}`);
          await typewriteLine(`     Menos $100: ${counts.menos100}`);
          await typewriteLine(`     Total: ${counts.total}`);
          await typewriteLine('');
          totalGeneral += counts.total;
        } else {
          await typewriteLine(`  📦 Batch ${batch.number}: Sin oportunidades generadas`);
          await typewriteLine('');
        }
      } catch (err) {
        await typewriteLine(`  📦 Batch ${batch.number}: Error al contar`);
        await typewriteLine('');
      }
    }
    
    await showSeparator();
    await typewriteLine('');
    await showSuccess(`💰 Total general: ${totalGeneral} oportunidades`);
  } else {
    // Mostrar resumen general
    try {
      const counts = await countOpportunities(sellerId, null);
      
      if (counts && counts.total > 0) {
        await showInfo('Resumen del vendedor:');
        await typewriteLine('');
        await typewriteLine(`  Principal: ${counts.principal} productos`);
        await typewriteLine(`  Menos $50: ${counts.menos50} productos`);
        await typewriteLine(`  Menos $100: ${counts.menos100} productos`);
        await typewriteLine('');
        await showSuccess(`💰 Total: ${counts.total} oportunidades encontradas`);
      } else {
        await showWarning('No hay oportunidades generadas para este vendedor');
        await typewriteLine('');
        await showInfo('Usa la opción [1] para generar oportunidades');
      }
    } catch (err) {
      await showError('Error al contar oportunidades');
    }
  }
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Generar oportunidades consolidadas (todos los batches en archivos de máximo 500 ASINs)
 */
async function generarOportunidadesConsolidadas(rl, sellerId, batches) {
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  
  // Verificar que el vendedor esté listo
  const phaseInfo = detectVendorPhase(sellerId);
  
  if (!phaseInfo.ready) {
    await typewriteLine('');
    await showWarning(`⚠️  El vendedor no está listo para generar oportunidades`);
    await showInfo(`Estado actual: ${phaseInfo.label}`);
    
    if (phaseInfo.stats) {
      await typewriteLine('');
      await typewriteLine(`   📊 Productos totales: ${phaseInfo.stats.total}`);
      await typewriteLine(`   🇲🇽 Verificados MX: ${phaseInfo.stats.mx}/${phaseInfo.stats.total}`);
      await typewriteLine(`   🇺🇸 Verificados USA: ${phaseInfo.stats.usa}/${phaseInfo.stats.total}`);
      await typewriteLine('');
      
      if (phaseInfo.stats.mx < phaseInfo.stats.total) {
        await showInfo('❌ Falta completar verificación MX - Menú [4]');
      }
      if (phaseInfo.stats.usa < phaseInfo.stats.total) {
        await showInfo('❌ Falta completar verificación USA - Menú [5]');
      }
    }
    
    await typewriteLine('');
    await showInfo('💡 Ambas verificaciones (MX y USA) deben estar al 100% antes de generar oportunidades');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Mostrar información del proceso
  await showInfo(`Generación de oportunidades consolidadas para ${sellerId}`);
  await typewriteLine('');
  await typewriteLine(`📦 Batches a consolidar: ${batches.length}`);
  await typewriteLine(`📊 Productos totales: ${phaseInfo.stats.total}`);
  await typewriteLine(`💼 Archivos máx 500 ASINs cada uno`);
  await typewriteLine('');
  await showWarning('Este proceso:');
  await typewriteLine('  1. Combinará todos los batches consolidados');
  await typewriteLine('  2. Eliminará duplicados por ASIN');
  await typewriteLine('  3. Aplicará filtros de oportunidades');
  await typewriteLine('  4. Dividirá en archivos de máximo 500 ASINs');
  await typewriteLine('  5. Generará 3 tipos: principal, menos_50, menos_100');
  await typewriteLine('');
  
  const confirmar = await ask(rl, '¿Continuar? (s/n): ');
  
  if (confirmar.toLowerCase() !== 's') {
    await showInfo('Operación cancelada');
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showSuccess('🚀 Iniciando generación de oportunidades consolidadas...');
  
  try {
    // Ejecutar la consolidación y generación
    await ejecutarGeneracionOportunidadesConsolidadas(rl, sellerId, batches);
    
    await typewriteLine('');
    await showSuccess('✅ Oportunidades consolidadas generadas exitosamente');
    
  } catch (error) {
    await typewriteLine('');
    await showError('❌ Error durante la generación:');
    await typewriteLine(`   ${error.message}`);
  }
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Ejecutar la generación de oportunidades consolidadas
 */
async function ejecutarGeneracionOportunidadesConsolidadas(rl, sellerId, batches) {
  const fs = require('fs');
  const path = require('path');
  const csv = require('csv-parser');
  const { parse } = require('json2csv');
  
  const baseDir = path.join(__dirname, '..', 'data', 'vendors', sellerId);
  
  await showInfo('📂 Paso 1: Consolidando todos los batches...');
  
  // Leer y combinar todos los batch-N-consolidated.json
  const todosLosProductos = [];
  const asinsVistos = new Set();
  
  for (const batch of batches) {
    if (batch.json && fs.existsSync(batch.json)) {
      try {
        const data = JSON.parse(fs.readFileSync(batch.json, 'utf8'));
        const products = data.all_products || data.products || [];
        
        await typewriteLine(`   📦 Batch ${batch.number}: ${products.length} productos`);
        
        for (const producto of products) {
          if (producto.asin && !asinsVistos.has(producto.asin)) {
            todosLosProductos.push(producto);
            asinsVistos.add(producto.asin);
          }
        }
      } catch (e) {
        await typewriteLine(`   ❌ Error leyendo batch ${batch.number}: ${e.message}`);
      }
    }
  }
  
  await typewriteLine('');
  await typewriteLine(`📊 Total productos únicos: ${todosLosProductos.length}`);
  
  // Crear archivo temporal consolidado completo
  const archivoConsolidadoCompleto = path.join(baseDir, 'vendedor-completo-consolidated.json');
  fs.writeFileSync(archivoConsolidadoCompleto, JSON.stringify({ all_products: todosLosProductos }, null, 2));
  
  await showInfo('📋 Paso 2: Procesando filtros y oportunidades...');
  
  // Usar lógica similar a los scripts existentes pero integrada
  await procesarOportunidadesConsolidadas(rl, sellerId, todosLosProductos);
  
  // Limpiar archivo temporal
  if (fs.existsSync(archivoConsolidadoCompleto)) {
    fs.unlinkSync(archivoConsolidadoCompleto);
  }
}

/**
 * Procesar oportunidades consolidadas con división en chunks de 500
 */
async function procesarOportunidadesConsolidadas(rl, sellerId, productos) {
  const fs = require('fs');
  const path = require('path');
  const { parse } = require('json2csv');
  
  const baseDir = path.join(__dirname, '..', 'data', 'vendors', sellerId);
  
  await typewriteLine('   🔍 Aplicando filtros de negocio...');
  
  // PASO 1: Aplicar filtros iniciales (lógica EXACTA de prepare_business_csv.js)
  const productosFiltrados = productos.filter(producto => {
    return producto.precio_actual_mx && 
           producto.precio_actual_usd && 
           producto.price;
  });
  
  await typewriteLine(`   ✅ Productos con datos completos: ${productosFiltrados.length}`);
  
  // PASO 2: Calcular precio sugerido (lógica EXACTA de prepare_business_csv.js)
  const productosConPrecioSugerido = [];
  
  for (const producto of productosFiltrados) {
    let nuevo = { ...producto };
    
    // Cálculo EXACTO de precio_sugerido
    let precio_usd = parseFloat(producto.precio_actual_usd);
    if (!isNaN(precio_usd)) {
      nuevo.precio_sugerido = (precio_usd * 41.79 + 314.81).toFixed(2);
    } else {
      nuevo.precio_sugerido = '';
    }
    
    productosConPrecioSugerido.push(nuevo);
  }
  
  await typewriteLine('   💰 Identificando oportunidades...');
  
  // PASO 3: Aplicar 3 filtros de oportunidades (lógica EXACTA de buscando_productos_csv.js)
  
  // Función ajustarCompetitivo EXACTA del script original
  function ajustarCompetitivo(precio_actual_mx, competitivo) {
    if (precio_actual_mx <= 2500) {
      const limite = precio_actual_mx - 100;
      return competitivo < limite ? limite : competitivo;
    } else {
      const limite = precio_actual_mx - 200;
      return competitivo < limite ? limite : competitivo;
    }
  }
  
  let usados = new Set();
  let oportunidades = [];
  let oportunidades_menos_50 = [];
  let oportunidades_menos_100 = [];
  
  // Límites de precio
  const PRECIO_MAXIMO = 7000;          // excluir > 7000 en todos los filtros
  const PRECIO_MIN_PRINCIPAL = 699;    // incluir solo >= 699 en oportunidad directa
  const PRECIO_MIN_OTROS = 1000;       // incluir solo >= 1000 en -50 y -100
  let excluidos_por_precio = 0;
  let excluidos_por_min_principal = 0;
  let excluidos_por_min_otros = 0;
  
  // 1. Primer filtro EXACTO: precio_sugerido < precio_actual_mx
  productosConPrecioSugerido.forEach(row => {
    const sugerido = parseFloat(row.precio_sugerido);
    const actual = parseFloat(row.precio_actual_mx);
    
    // Excluir por rango para principal: < 699 o > 7000
    if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
      excluidos_por_precio++;
      return;
    }
    if (!isNaN(actual) && actual < PRECIO_MIN_PRINCIPAL) {
      excluidos_por_min_principal++;
      return;
    }
    
    if (!isNaN(sugerido) && !isNaN(actual) && sugerido < actual) {
      let competitivo = ajustarCompetitivo(actual, sugerido);
      let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
      oportunidades.push(nuevo);
      usados.add(row.asin);
    }
  });
  
  // 2. Segundo filtro EXACTO: (precio_sugerido - 50) < precio_actual_mx,
  // pero solo si no está en oportunidades y sugerido >= actual
  productosConPrecioSugerido.forEach(row => {
    if (!usados.has(row.asin)) {
      const sugerido = parseFloat(row.precio_sugerido);
      const actual = parseFloat(row.precio_actual_mx);
      
      // Excluir por rango para -50: < 1000 o > 7000
      if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
        return;
      }
      if (!isNaN(actual) && actual < PRECIO_MIN_OTROS) {
        excluidos_por_min_otros++;
        return;
      }
      
      if (!isNaN(sugerido) && !isNaN(actual)) {
        if ((sugerido - 50) < actual && sugerido >= actual) {
          let competitivo = ajustarCompetitivo(actual, sugerido - 50);
          let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
          oportunidades_menos_50.push(nuevo);
          usados.add(row.asin);
        }
      }
    }
  });
  
  // 3. Tercer filtro EXACTO: (precio_sugerido - 100) < precio_actual_mx,
  // pero solo si no está en anteriores
  productosConPrecioSugerido.forEach(row => {
    if (!usados.has(row.asin)) {
      const sugerido = parseFloat(row.precio_sugerido);
      const actual = parseFloat(row.precio_actual_mx);
      
      // Excluir por rango para -100: < 1000 o > 7000
      if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
        return;
      }
      if (!isNaN(actual) && actual < PRECIO_MIN_OTROS) {
        excluidos_por_min_otros++;
        return;
      }
      
      if (!isNaN(sugerido) && !isNaN(actual)) {
        if ((sugerido - 100) < actual && (sugerido - 50) >= actual) {
          let competitivo = ajustarCompetitivo(actual, sugerido - 100);
          let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
          oportunidades_menos_100.push(nuevo);
          usados.add(row.asin);
        }
      }
    }
  });
  
  await typewriteLine(`   📊 Oportunidades principales: ${oportunidades.length}`);
  await typewriteLine(`   📊 Oportunidades menos $50: ${oportunidades_menos_50.length}`);
  await typewriteLine(`   📊 Oportunidades menos $100: ${oportunidades_menos_100.length}`);
  
  if (excluidos_por_precio > 0) {
    await typewriteLine(`   ⚠️  Excluidos por precio > $${PRECIO_MAXIMO.toLocaleString()}: ${excluidos_por_precio}`);
  }
  if (excluidos_por_min_principal > 0) {
    await typewriteLine(`   ⚠️  Excluidos por precio < $${PRECIO_MIN_PRINCIPAL} (oportunidad directa): ${excluidos_por_min_principal}`);
  }
  if (excluidos_por_min_otros > 0) {
    await typewriteLine(`   ⚠️  Excluidos por precio < $${PRECIO_MIN_OTROS} (oportunidades -50/-100): ${excluidos_por_min_otros}`);
  }
  
  await typewriteLine('');
  await showInfo('📄 Paso 3: Generando archivos con máximo 500 ASINs...');
  
  // Generar archivos divididos en chunks de 500
  const oportunidadesParaArchivos = {
    principal: oportunidades,
    menos50: oportunidades_menos_50,
    menos100: oportunidades_menos_100
  };
  
  await generarArchivosChunkeados(rl, baseDir, sellerId, oportunidadesParaArchivos);
}

/**
 * Generar archivos divididos en chunks de máximo 500 ASINs
 */
async function generarArchivosChunkeados(rl, baseDir, sellerId, oportunidades) {
  const fs = require('fs');
  const path = require('path');
  const { parse } = require('json2csv');
  
  const CHUNK_SIZE = 500;
  const campos = [
    'asin', 'precio_actual_mx', 'precio_actual_usd', 'price', 'title',
    'precio_sugerido', 'url_usa', 'vendedor_actual_mx', 'vendedor_actual_usa', 'precio_competitivo'
  ];
  
  // Función helper para dividir array en chunks
  const dividirEnChunks = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };
  
  const tiposOportunidades = [
    { key: 'principal', nombre: 'oportunidades', datos: oportunidades.principal },
    { key: 'menos50', nombre: 'oportunidades-menos-50', datos: oportunidades.menos50 },
    { key: 'menos100', nombre: 'oportunidades-menos-100', datos: oportunidades.menos100 }
  ];
  
  let totalArchivos = 0;
  
  for (const tipo of tiposOportunidades) {
    if (tipo.datos.length === 0) {
      await typewriteLine(`   📄 ${tipo.nombre}: Sin datos para generar`);
      continue;
    }
    
    const chunks = dividirEnChunks(tipo.datos, CHUNK_SIZE);
    await typewriteLine(`   📄 ${tipo.nombre}: ${chunks.length} archivo${chunks.length > 1 ? 's' : ''} (${tipo.datos.length} productos)`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const numeroParte = i + 1;
      const nombreArchivo = chunks.length > 1 
        ? `vendedor-${tipo.nombre}-parte-${numeroParte}.csv`
        : `vendedor-${tipo.nombre}.csv`;
      
      const rutaArchivo = path.join(baseDir, nombreArchivo);
      
      try {
        const csvData = parse(chunk, { fields: campos });
        fs.writeFileSync(rutaArchivo, csvData);
        totalArchivos++;
        
        await typewriteLine(`     ✅ ${nombreArchivo} (${chunk.length} productos)`);
      } catch (error) {
        await typewriteLine(`     ❌ Error generando ${nombreArchivo}: ${error.message}`);
      }
    }
  }
  
  await typewriteLine('');
  await showSuccess(`📁 Total archivos generados: ${totalArchivos}`);
}

module.exports = { show, generarOportunidadesConsolidadas };
