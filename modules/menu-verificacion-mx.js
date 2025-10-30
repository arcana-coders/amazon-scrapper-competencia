/**
 * MÓDULO: VERIFICACIÓN EN AMAZON MX (FASE 3.5)
 * 
 * Verifica productos en Amazon México para obtener el precio del BUY BOX:
 * - Precio en MXN (buy box)
 * - Vendedor actual MX
 * - Disponibilidad
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
  getVerificationStatus 
} = require('./utils/vendor-utils');
const path = require('path');
const fs = require('fs');

/**
 * Determinar fase actual del vendedor
 */
function determinarFase(sellerId) {
  // Desde modules/ subir un nivel a la raíz del proyecto
  const projectRoot = path.join(__dirname, '..');
  const vendorDir = path.join(projectRoot, 'data', 'vendors', sellerId);
  
  if (!fs.existsSync(vendorDir)) {
    return '📋 Registrado';
  }
  
  // Verificar si tiene batches consolidados
  const batches = getBatchConsolidatedFiles(sellerId);
  
  if (batches.length === 0) {
    return '📋 Registrado';
  }
  
  // Verificar estado de verificación MX
  let totalProductos = 0;
  let verificadosMX = 0;
  let verificadosUSA = 0;
  
  for (const batchFile of batches) {
    if (fs.existsSync(batchFile)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
        const data = Array.isArray(fileContent) ? fileContent : fileContent.all_products;
        
        if (Array.isArray(data)) {
          totalProductos += data.length;
          
          for (const product of data) {
            if (product.fecha_verificacion_mx) {
              verificadosMX++;
            }
            if (product.fecha_verificacion_usa) {
              verificadosUSA++;
            }
          }
        }
      } catch (e) {
        // Ignorar errores de lectura
      }
    }
  }
  
  if (totalProductos === 0) {
    return '📋 Registrado';
  }
  
  // Determinar fase según verificaciones
  if (verificadosUSA === totalProductos) {
    return '🇺🇸 Verificado USA';
  } else if (verificadosUSA > 0) {
    return '🔄 Verificando USA';
  } else if (verificadosMX === totalProductos) {
    return '✅ Verificado MX';
  } else if (verificadosMX > 0) {
    return '🔄 Verificando MX';
  } else {
    return '📦 Consolidado';
  }
}

/**
 * Verificar cuántos productos pendientes quedan en MX
 */
async function verificarProductosPendientesMX(sellerId, batchNumber) {
  // Desde modules/ subir un nivel a la raíz del proyecto
  const projectRoot = path.join(__dirname, '..');
  const vendorDir = path.join(projectRoot, 'data', 'vendors', sellerId);
  
  // Si no hay batchNumber, es vendedor pequeño
  const consolidatedFile = batchNumber 
    ? path.join(vendorDir, `batch-${batchNumber}-consolidated.json`)
    : path.join(vendorDir, 'all-products-consolidated.json');
  
  console.log(`\n🔍 DEBUG: Verificando pendientes en: ${consolidatedFile}`);
  
  if (!fs.existsSync(consolidatedFile)) {
    console.log('❌ DEBUG: Archivo no existe');
    return 0;
  }
  
  try {
    const fileContent = JSON.parse(fs.readFileSync(consolidatedFile, 'utf-8'));
    // El archivo puede ser array directo o tener estructura {all_products: [...]}
    const data = Array.isArray(fileContent) ? fileContent : fileContent.all_products;
    
    if (!Array.isArray(data)) {
      console.error('❌ DEBUG: Estructura de archivo no reconocida');
      return 0;
    }
    
    const pendientes = data.filter(p => !p.fecha_verificacion_mx).length;
    console.log(`📊 DEBUG: Total productos: ${data.length}, Pendientes: ${pendientes}`);
    return pendientes;
  } catch (e) {
    console.error('❌ DEBUG: Error leyendo archivo:', e.message);
    return 0;
  }
}

/**
 * Menú principal de verificación MX
 */
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await clearScreen();
    await showTitle('VERIFICAR EN AMAZON MX (FASE 3.5)', { icon: '🇲🇽' });
    await typewriteLine('');
    await showInfo('Verifica precios del BUY BOX en Amazon México');
    await showWarning('⚠️  Ejecutar ANTES de verificar en USA');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await typewriteLine('  [1] 🔍 Verificar productos de un vendedor');
    await typewriteLine('  [2] 📊 Ver estado de verificación');
    await typewriteLine('  [0] ← Volver al menú principal');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    switch (opcion) {
      case '1':
        await verificarProductos(rl);
        break;
      case '2':
        await verEstadoVerificacion(rl);
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
 * Verificar productos de un vendedor
 */
async function verificarProductos(rl) {
  await clearScreen();
  await showTitle('VERIFICAR PRODUCTOS EN MX', { icon: '🔍' });
  await typewriteLine('');
  
  // Filtrar solo vendedores con batches consolidados
  const allVendors = listVendorIds();
  const vendorsConBatches = [];
  
  for (const vendor of allVendors) {
    if (vendorDirExists(vendor)) {
      const batches = getBatchConsolidatedFiles(vendor);
      if (batches.length > 0) {
        vendorsConBatches.push({
          sellerId: vendor,
          batches: batches.length,
          fase: determinarFase(vendor)
        });
      }
    }
  }
  
  if (vendorsConBatches.length === 0) {
    await showError('No hay vendedores con batches consolidados');
    await typewriteLine('');
    await showInfo('Primero debes:');
    await typewriteLine('  1. Generar plan de scraping en: [2] Generar Plan de Scraping');
    await typewriteLine('  2. Ejecutar scraping en: [3] Ejecutar Scraping');
    await typewriteLine('  3. Consolidar los batches');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Mostrar lista de vendedores con batches
  await showInfo(`Vendedores con batches consolidados (${vendorsConBatches.length}):`);
  await typewriteLine('');
  for (let idx = 0; idx < vendorsConBatches.length; idx++) {
    const { sellerId, batches, fase } = vendorsConBatches[idx];
    await typewriteLine(`  [${idx + 1}] ${sellerId} (${batches} batch${batches > 1 ? 'es' : ''}) - ${fase}`);
  }
  
  await typewriteLine('  [0] ← Volver');
  await typewriteLine('');
  
  const seleccion = await ask(rl, '👉 Selecciona un vendedor (número): ');
  
  if (seleccion === '0') {
    return;
  }
  
  const vendorIndex = parseInt(seleccion) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendorsConBatches.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const sellerId = vendorsConBatches[vendorIndex].sellerId;
  
  // Obtener batches (ya sabemos que existen porque los filtramos)
  const batches = getBatchConsolidatedFiles(sellerId);
  
  // Preguntar qué hacer
  await typewriteLine('');
  await showInfo(`Vendedor con ${batches.length} batch${batches.length > 1 ? 'es' : ''} consolidado${batches.length > 1 ? 's' : ''}`);
  await typewriteLine('');
  await typewriteLine('¿Qué deseas hacer?');
  await typewriteLine('');
  await typewriteLine('  [1] Verificar un batch específico');
  await typewriteLine('  [2] Verificar todos los batches');
  await typewriteLine('  [0] ← Volver');
  await typewriteLine('');
  
  const opcion = await ask(rl, '👉 Elige una opción: ');
  
  if (opcion === '0') {
    return;
  } else if (opcion === '1') {
    await verificarBatchEspecifico(rl, sellerId, batches);
  } else if (opcion === '2') {
    await verificarTodosLosBatches(rl, sellerId, batches);
  } else {
    await showError('Opción inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
  }
}

/**
 * Verificar batch específico
 */
async function verificarBatchEspecifico(rl, sellerId, batches) {
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo('Batches disponibles:');
  await typewriteLine('');
  
  for (let idx = 0; idx < batches.length; idx++) {
    await typewriteLine(`  [${idx + 1}] Batch ${batches[idx].number}`);
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
  
  // Preguntar lote
  await typewriteLine('');
  await showInfo('¿Cuántos productos verificar por lote?');
  await showWarning('Recomendado: 20 productos (default) | Máximo: 100');
  await showInfo('Puedes usar 5-10 para pruebas rápidas, o hasta 100 para avanzar más rápido');
  await typewriteLine('');
  const lote = await ask(rl, '👉 Cantidad por lote [20]: ');
  const loteNum = Math.min(parseInt(lote) || 20, 100);
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning(`Iniciando verificación MX del batch ${batchNumber}...`);
  await showInfo('El script se ejecutará en lotes hasta completar el batch');
  await showInfo(`Tamaño de lote: ${loteNum} productos`);
  await typewriteLine('');
  
  // Ejecutar script en loop hasta completar el batch
  let continuar = true;
  let rondaActual = 1;
  
  while (continuar) {
    await showInfo(`🔄 Ejecutando ronda ${rondaActual} con lote de ${loteNum} productos...`);
    await typewriteLine('');
    
    const resultado = await ejecutarVerificacion(rl, sellerId, batchNumber, loteNum);
    
    await typewriteLine('');
    await showInfo(`📌 Script terminó con código: ${resultado}`);
    await typewriteLine('');
    
    // Si el script terminó exitosamente, verificar si quedan pendientes
    if (resultado === 0) {
      // Esperar 2 segundos para que el archivo se guarde completamente
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar si quedan productos pendientes
      const pendientes = await verificarProductosPendientesMX(sellerId, batchNumber);
      
      if (pendientes > 0) {
        await showWarning(`⏳ Quedan ${pendientes} productos pendientes. Continuando con siguiente lote...`);
        await typewriteLine('');
        rondaActual++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await showSuccess('🎉 ¡Batch completado! Todos los productos verificados en MX');
        continuar = false;
      }
    } else {
      await showError('❌ Error en la verificación. Deteniendo proceso.');
      continuar = false;
    }
  }
  
  await typewriteLine('');
  await ask(rl, '\nPresiona ENTER para volver al menú...');
}

/**
 * Verificar todos los batches
 */
async function verificarTodosLosBatches(rl, sellerId, batches) {
  await typewriteLine('');
  await showWarning(`Se verificarán ${batches.length} batches secuencialmente`);
  await showInfo('Esto puede tardar bastante tiempo. Puedes pausar con Ctrl+C');
  await typewriteLine('');
  
  const confirmar = await ask(rl, '¿Continuar? (s/n): ');
  
  if (confirmar.toLowerCase() !== 's') {
    return;
  }
  
  await typewriteLine('');
  const lote = await ask(rl, '👉 Cantidad por lote [20]: ');
  const loteNum = Math.min(parseInt(lote) || 20, 100);
  
  for (const batch of batches) {
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await showWarning(`📦 Verificando batch ${batch.number}...`);
    await typewriteLine('');
    
    // Ejecutar en loop hasta completar el batch
    let continuar = true;
    let rondaActual = 1;
    
    while (continuar) {
      await showInfo(`🔄 Batch ${batch.number} - Ronda ${rondaActual}...`);
      await typewriteLine('');
      
      const resultado = await ejecutarVerificacion(rl, sellerId, batch.number, loteNum);
      
      if (resultado === 0) {
        // Esperar 2 segundos para que el archivo se guarde completamente
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const pendientes = await verificarProductosPendientesMX(sellerId, batch.number);
        
        if (pendientes > 0) {
          await showWarning(`⏳ Quedan ${pendientes} productos pendientes en batch ${batch.number}. Continuando...`);
          await typewriteLine('');
          rondaActual++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          await showSuccess(`Batch ${batch.number} completado - Todos los productos verificados`);
          continuar = false;
        }
      } else {
        await showError(`❌ Error en batch ${batch.number}. Deteniendo.`);
        return;
      }
    }
    
    // Pausa entre batches
    if (batch !== batches[batches.length - 1]) {
      await typewriteLine('');
      await showInfo('⏸️  Pausa de 5 segundos antes del siguiente batch...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  await typewriteLine('');
  await showSuccess('✅ Todos los batches han sido procesados');
  await ask(rl, '\nPresiona ENTER para continuar...');
}

/**
 * Verificar vendedor pequeño
 */
async function verificarVendedorPequeno(rl, sellerId) {
  await typewriteLine('');
  await showInfo('¿Cuántos productos verificar por lote?');
  await showWarning('Recomendado: 20 productos (default) | Máximo: 100');
  await typewriteLine('');
  const lote = await ask(rl, '👉 Cantidad por lote [20]: ');
  const loteNum = Math.min(parseInt(lote) || 20, 100);
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning(`Iniciando verificación MX para ${sellerId}...`);
  await showInfo('El script se ejecutará en lotes hasta completar todos los productos');
  await showInfo(`Tamaño de lote: ${loteNum} productos`);
  await typewriteLine('');
  
  // Ejecutar en loop hasta completar todos los productos
  let continuar = true;
  let rondaActual = 1;
  
  while (continuar) {
    await showInfo(`🔄 Ejecutando ronda ${rondaActual}...`);
    await typewriteLine('');
    
    const resultado = await ejecutarVerificacion(rl, sellerId, null, loteNum);
    
    if (resultado === 0) {
      const pendientes = await verificarProductosPendientesMX(sellerId, null);
      
      if (pendientes > 0) {
        await showInfo(`📊 Quedan ${pendientes} productos pendientes`);
        await showWarning(`⏳ Continuando con siguiente lote...`);
        await typewriteLine('');
        rondaActual++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        await showSuccess('🎉 ¡Verificación completada! Todos los productos verificados en MX');
        continuar = false;
      }
    } else {
      await showError('❌ Error en la verificación. Deteniendo proceso.');
      continuar = false;
    }
  }
  
  await typewriteLine('');
  await ask(rl, '\nPresiona ENTER para volver al menú...');
}

/**
 * Ejecutar el script de verificación MX
 */
async function ejecutarVerificacion(rl, sellerId, batchNumber, lote) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'verify-products-mx-batch.js');
    
    const args = [scriptPath, sellerId];
    if (batchNumber) {
      args.push(batchNumber.toString());
    }
    args.push(lote.toString());
    
    const proceso = spawn('node', args, {
      stdio: 'inherit',
      shell: true
    });
    
    proceso.on('close', (code) => {
      if (code === 0) {
        showSuccess('\n✅ Lote completado exitosamente');
      } else {
        showError(`\n❌ El proceso terminó con código: ${code}`);
      }
      
      // Resolver con el código de salida para saber si continuar
      setTimeout(() => resolve(code), 1000);
    });
    
    proceso.on('error', (error) => {
      showError(`\n❌ Error al ejecutar el script: ${error.message}`);
      setTimeout(() => resolve(1), 1000); // Retornar código de error
    });
  });
}

/**
 * Ver estado de verificación
 */
async function verEstadoVerificacion(rl) {
  await clearScreen();
  await showTitle('ESTADO DE VERIFICACIÓN MX', { icon: '📊' });
  await typewriteLine('');
  
  // Filtrar solo vendedores con batches consolidados
  const allVendors = listVendorIds();
  const vendorsConBatches = [];
  
  for (const vendor of allVendors) {
    if (vendorDirExists(vendor)) {
      const batches = getBatchConsolidatedFiles(vendor);
      if (batches.length > 0) {
        vendorsConBatches.push({
          sellerId: vendor,
          batches: batches.length,
          fase: determinarFase(vendor)
        });
      }
    }
  }
  
  if (vendorsConBatches.length === 0) {
    await showError('No hay vendedores con batches consolidados');
    await typewriteLine('');
    await showInfo('Primero debes consolidar batches antes de ver su estado');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Mostrar lista
  await showInfo(`Vendedores con batches consolidados (${vendorsConBatches.length}):`);
  await typewriteLine('');
  for (let idx = 0; idx < vendorsConBatches.length; idx++) {
    const { sellerId, batches, fase } = vendorsConBatches[idx];
    await typewriteLine(`  [${idx + 1}] ${sellerId} (${batches} batch${batches > 1 ? 'es' : ''}) - ${fase}`);
  }
  await typewriteLine('  [0] ← Volver');
  await typewriteLine('');
  
  const seleccion = await ask(rl, '👉 Selecciona un vendedor: ');
  
  if (seleccion === '0') {
    return;
  }
  
  const vendorIndex = parseInt(seleccion) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendorsConBatches.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const sellerId = vendorsConBatches[vendorIndex].sellerId;
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo(`Verificación MX de ${sellerId}`);
  await typewriteLine('');
  
  // Detectar batches
  const batches = getBatchConsolidatedFiles(sellerId);
  const vendorInfo = getVendorInfo(sellerId);
  const isLarge = vendorInfo?.is_large_vendor || false;
  
  if (isLarge && batches.length > 0) {
    // Mostrar estado por batch
    await showInfo(`Vendedor con ${batches.length} batches:`);
    await typewriteLine('');
    
    for (const batch of batches) {
      const status = getVerificationStatusMX(sellerId, batch.number);
      
      if (status) {
        await mostrarEstadoBatch(status);
        await typewriteLine('');
      } else {
        await showWarning(`Batch ${batch.number}: Sin datos de verificación MX`);
        await typewriteLine('');
      }
    }
  } else {
    // Mostrar estado general
    const status = getVerificationStatusMX(sellerId, null);
    
    if (status) {
      await showInfo('Estado del vendedor:');
      await typewriteLine('');
      await mostrarEstadoBatch(status);
    } else {
      await showWarning('No hay datos de verificación MX disponibles');
      await showInfo('Ejecuta primero la verificación MX desde la opción [1]');
    }
  }
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Obtener estado de verificación MX
 */
function getVerificationStatusMX(sellerId, batchNumber) {
  const fs = require('fs');
  const path = require('path');
  
  const vendorDir = path.join(__dirname, '..', 'data', 'vendors', sellerId);
  
  let filePath;
  if (batchNumber) {
    filePath = path.join(vendorDir, `batch-${batchNumber}-consolidated.json`);
  } else {
    filePath = path.join(vendorDir, 'all-products-consolidated.json');
  }
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const productos = data.all_products || data.products || data;
  
  if (!Array.isArray(productos)) {
    return null;
  }
  
  const total = productos.length;
  const verified = productos.filter(p => p.precio_actual_mx !== null && p.precio_actual_mx !== undefined).length;
  const pending = total - verified;
  const withPrice = productos.filter(p => p.precio_actual_mx).length;
  const withSeller = productos.filter(p => p.vendedor_actual_mx).length;
  const withErrors = productos.filter(p => p.error_verificacion_mx).length;
  const disponible = productos.filter(p => p.disponibilidad_mx === 'disponible').length;
  const noDisponible = productos.filter(p => p.disponibilidad_mx === 'no disponible').length;
  const noListado = productos.filter(p => p.disponibilidad_mx === 'no listado').length;
  
  return {
    batchNumber,
    total,
    verified,
    pending,
    percentage: ((verified / total) * 100).toFixed(2),
    withPrice,
    withSeller,
    withErrors,
    disponible,
    noDisponible,
    noListado
  };
}

/**
 * Mostrar estado de un batch
 */
async function mostrarEstadoBatch(status) {
  const batchLabel = status.batchNumber ? `Batch ${status.batchNumber}` : 'Vendedor completo';
  
  await typewriteLine(`  📦 ${batchLabel}:`);
  await typewriteLine(`     Total productos: ${status.total}`);
  await typewriteLine(`     Verificados: ${status.verified} (${status.percentage}%)`);
  await typewriteLine(`     Pendientes: ${status.pending}`);
  await typewriteLine(`     Con precio MX: ${status.withPrice}`);
  await typewriteLine(`     Con vendedor MX: ${status.withSeller}`);
  await typewriteLine(`     Con errores: ${status.withErrors}`);
  await typewriteLine(`     Disponibles: ${status.disponible}`);
  await typewriteLine(`     No disponibles: ${status.noDisponible}`);
  await typewriteLine(`     No listados: ${status.noListado}`);
}

module.exports = { show };
