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
    await typewriteLine('  [0] ← Cancelar');
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    if (opcion === '0') {
      return;
    } else if (opcion === '1') {
      await generarOportunidadesBatchEspecifico(rl, sellerId, batches);
    } else if (opcion === '2') {
      await generarOportunidadesTodosLosBatches(rl, sellerId, batches);
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
  await showInfo('� Paso 1/2: Filtrando productos con precios válidos...');
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

module.exports = { show };
