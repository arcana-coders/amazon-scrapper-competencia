/**
 * MÓDULO: GESTIÓN DE PLANTILLAS (FASE 6)
 * 
 * Gestiona plantillas de Seller Central para publicación masiva:
 * 1. Solicitar plantilla a Amazon Seller Central
 * 2. Descargar plantilla generada
 * 3. Llenar plantilla con productos (límite 500 productos)
 * 4. Ver estado de plantillas
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
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
  getVendorDir,
  getAllOpportunitiesFiles,
  countOpportunities
} = require('./utils/vendor-utils');

const LIMITE_PRODUCTOS = 500;

/**
 * Menú principal de plantillas
 */
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await clearScreen();
    await showTitle('GESTIÓN DE PLANTILLAS (FASE 6)', { icon: '📄' });
    await typewriteLine('');
    await showInfo('Administra plantillas de Seller Central para publicación masiva');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await typewriteLine('  [1] 📤 Solicitar plantilla a Amazon');
    await typewriteLine('  [2] 📥 Descargar plantilla generada');
    await typewriteLine('  [3] 📝 Llenar plantilla con productos');
    await typewriteLine('  [4] 📊 Ver estado de plantillas');
    await typewriteLine('  [0] ← Volver al menú principal');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    switch (opcion) {
      case '1':
        await solicitarPlantilla(rl);
        break;
      case '2':
        await descargarPlantilla(rl);
        break;
      case '3':
        await llenarPlantilla(rl);
        break;
      case '4':
        await verEstadoPlantillas(rl);
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
 * Solicitar plantilla a Amazon
 */
async function solicitarPlantilla(rl) {
  await clearScreen();
  await showTitle('SOLICITAR PLANTILLA A AMAZON', { icon: '📤' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showInfo('Vendedores disponibles:');
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
  
  // Detectar si hay oportunidades por batches
  const opportunities = getAllOpportunitiesFiles(sellerId);
  
  if (opportunities.length === 0) {
    await typewriteLine('');
    await showWarning('⚠️  No se encontraron archivos de oportunidades');
    await showInfo('Primero genera oportunidades en el menú [6]');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  
  let batchNumber = null;
  let opcionArchivo = null;
  
  // Si hay oportunidades por batches, preguntar cuál batch
  const batchOpportunities = opportunities.filter(o => o.type === 'batch');
  if (batchOpportunities.length > 0) {
    await showInfo(`Se encontraron oportunidades en ${batchOpportunities.length} batch(es):`);
    await typewriteLine('');
    
    for (let idx = 0; idx < batchOpportunities.length; idx++) {
      const opp = batchOpportunities[idx];
      const counts = await countOpportunities(sellerId, opp.batchNumber);
      await typewriteLine(`  [${idx + 1}] Batch ${opp.batchNumber} - ${counts.total} oportunidades`);
    }
    
    await typewriteLine('');
    const batchSel = await ask(rl, '👉 Selecciona un batch (número) o [0] para cancelar: ');
    
    if (batchSel === '0') {
      return;
    }
    
    const batchIdx = parseInt(batchSel) - 1;
    if (batchIdx < 0 || batchIdx >= batchOpportunities.length) {
      await showError('Selección inválida');
      await ask(rl, '\nPresiona ENTER para continuar...');
      return;
    }
    
    batchNumber = batchOpportunities[batchIdx].batchNumber;
  }
  
  // Preguntar qué archivo de oportunidades usar
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo('¿Qué archivo de oportunidades deseas usar?');
  await typewriteLine('');
  await typewriteLine('  [1] Oportunidades directas (más rentables)');
  await typewriteLine('  [2] Oportunidades con descuento de $50');
  await typewriteLine('  [3] Oportunidades con descuento de $100');
  await typewriteLine('');
  
  const opcion = await ask(rl, '👉 Selecciona una opción [1]: ');
  opcionArchivo = opcion || '1';
  
  if (!['1', '2', '3'].includes(opcionArchivo)) {
    await showError('Opción inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning('Solicitando plantilla a Amazon Seller Central...');
  await showInfo('Se abrirá el navegador automáticamente');
  await typewriteLine('');
  
  const args = batchNumber 
    ? [sellerId, opcionArchivo, batchNumber]
    : [sellerId, opcionArchivo];
  
  await ejecutarScript(
    path.join(__dirname, '..', 'solicitar-plantilla-seller.js'),
    args
  );
}

/**
 * Descargar plantilla generada
 */
async function descargarPlantilla(rl) {
  await clearScreen();
  await showTitle('DESCARGAR PLANTILLA GENERADA', { icon: '📥' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showInfo('Vendedores disponibles:');
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
  await showWarning('Descargando plantilla de Amazon Seller Central...');
  await showInfo('Se abrirá el navegador automáticamente');
  await typewriteLine('');
  
  await ejecutarScript(
    path.join(__dirname, '..', 'descargar-plantilla-seller.js'),
    [sellerId]
  );
}

/**
 * Llenar plantilla con productos
 */
async function llenarPlantilla(rl) {
  await clearScreen();
  await showTitle('LLENAR PLANTILLA CON PRODUCTOS', { icon: '📝' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showInfo('Vendedores disponibles:');
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
  
  // Obtener archivos de oportunidades disponibles
  const opportunities = getAllOpportunitiesFiles(sellerId);
  
  if (opportunities.length === 0) {
    await typewriteLine('');
    await showError('No hay archivos de oportunidades generados');
    await showInfo('Primero genera oportunidades en el menú [5] Generar Oportunidades');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Mostrar archivos disponibles
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo('Archivos de oportunidades disponibles:');
  await typewriteLine('');
  
  const archivosParaElegir = [];
  let idx = 1;
  
  for (const opp of opportunities) {
    if (opp.type === 'small-vendor') {
      await typewriteLine(`  📦 Vendedor completo:`);
    } else {
      await typewriteLine(`  📦 Batch ${opp.batchNumber}:`);
    }
    
    if (opp.oportunidades) {
      await typewriteLine(`     [${idx}] Principal (recomendado)`);
      archivosParaElegir.push({ 
        path: opp.oportunidades, 
        label: opp.type === 'small-vendor' ? 'Principal' : `Batch ${opp.batchNumber} - Principal`,
        batchNumber: opp.batchNumber,
        opcion: '1'
      });
      idx++;
    }
    if (opp.oportunidadesMenos50) {
      await typewriteLine(`     [${idx}] Menos $50`);
      archivosParaElegir.push({ 
        path: opp.oportunidadesMenos50, 
        label: opp.type === 'small-vendor' ? 'Menos $50' : `Batch ${opp.batchNumber} - Menos $50`,
        batchNumber: opp.batchNumber,
        opcion: '2'
      });
      idx++;
    }
    if (opp.oportunidadesMenos100) {
      await typewriteLine(`     [${idx}] Menos $100`);
      archivosParaElegir.push({ 
        path: opp.oportunidadesMenos100, 
        label: opp.type === 'small-vendor' ? 'Menos $100' : `Batch ${opp.batchNumber} - Menos $100`,
        batchNumber: opp.batchNumber,
        opcion: '3'
      });
      idx++;
    }
    await typewriteLine('');
  }
  
  await showWarning(`⚠️  Amazon permite máximo ${LIMITE_PRODUCTOS} productos por plantilla`);
  await typewriteLine('');
  
  const archivoSeleccion = await ask(rl, '👉 Selecciona un archivo (número) o [0] para cancelar: ');
  
  if (archivoSeleccion === '0') {
    return;
  }
  
  const archivoIndex = parseInt(archivoSeleccion) - 1;
  if (archivoIndex < 0 || archivoIndex >= archivosParaElegir.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const archivoSeleccionado = archivosParaElegir[archivoIndex];
  
  // Contar productos en el archivo
  const numProductos = await contarLineasCSV(archivoSeleccionado.path);
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo(`Archivo seleccionado: ${archivoSeleccionado.label}`);
  await showInfo(`Total de productos: ${numProductos}`);
  
  if (numProductos > LIMITE_PRODUCTOS) {
    await typewriteLine('');
    await showWarning(`⚠️  El archivo tiene ${numProductos} productos, pero Amazon solo acepta ${LIMITE_PRODUCTOS}`);
    await showInfo('Se procesarán solo los primeros 500 productos');
  }
  
  await typewriteLine('');
  const confirmar = await ask(rl, '¿Continuar con el llenado de plantilla? (s/n): ');
  
  if (confirmar.toLowerCase() !== 's') {
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning('Llenando plantilla con productos...');
  await showInfo('Esto puede tardar unos minutos');
  await typewriteLine('');
  
  // Construir argumentos para el script
  const scriptArgs = [sellerId, archivoSeleccionado.opcion];
  if (archivoSeleccionado.batchNumber) {
    scriptArgs.push(archivoSeleccionado.batchNumber.toString());
  }
  
  await ejecutarScriptConCSV(
    path.join(__dirname, '..', 'llenar-plantilla-seller.js'),
    scriptArgs,
    archivoSeleccionado.path
  );
}

/**
 * Ver estado de plantillas
 */
async function verEstadoPlantillas(rl) {
  await clearScreen();
  await showTitle('ESTADO DE PLANTILLAS', { icon: '📊' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showInfo('Selecciona un vendedor:');
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
  const vendorDir = getVendorDir(sellerId);
  const plantillasDir = path.join(vendorDir, 'plantillas');
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  
  if (!fs.existsSync(plantillasDir)) {
    await showWarning('No hay directorio de plantillas');
    await showInfo('Primero solicita una plantilla en la opción [1]');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const files = fs.readdirSync(plantillasDir);
  
  // Plantillas descargadas (sin llenar)
  const plantillasDescargadas = files.filter(f => 
    f.includes('inventory-loader') && !f.includes('FINAL') && f.endsWith('.xlsx')
  );
  
  // Plantillas llenadas (listas para subir)
  const plantillasLlenadas = files.filter(f => 
    f.includes('FINAL') && f.endsWith('.xlsx')
  );
  
  // Plantillas subidas (registros)
  const plantillasSubidas = files.filter(f => 
    f.includes('subida-') && f.endsWith('.txt')
  );
  
  await showInfo(`Estado de plantillas para ${sellerId}:`);
  await typewriteLine('');
  
  await typewriteLine(`  📥 Plantillas descargadas: ${plantillasDescargadas.length}`);
  if (plantillasDescargadas.length > 0) {
    const descargadasParaMostrar = plantillasDescargadas.slice(0, 5);
    for (let i = 0; i < descargadasParaMostrar.length; i++) {
      await typewriteLine(`     - ${descargadasParaMostrar[i]}`);
    }
    if (plantillasDescargadas.length > 5) {
      await typewriteLine(`     ... y ${plantillasDescargadas.length - 5} más`);
    }
  }
  
  await typewriteLine('');
  await typewriteLine(`  📝 Plantillas llenadas (listas): ${plantillasLlenadas.length}`);
  if (plantillasLlenadas.length > 0) {
    const llenadasParaMostrar = plantillasLlenadas.slice(0, 5);
    for (let i = 0; i < llenadasParaMostrar.length; i++) {
      await typewriteLine(`     - ${llenadasParaMostrar[i]}`);
    }
    if (plantillasLlenadas.length > 5) {
      await typewriteLine(`     ... y ${plantillasLlenadas.length - 5} más`);
    }
  }
  
  await typewriteLine('');
  await typewriteLine(`  ✅ Plantillas subidas: ${plantillasSubidas.length}`);
  if (plantillasSubidas.length > 0) {
    const subidasParaMostrar = plantillasSubidas.slice(0, 5);
    for (let i = 0; i < subidasParaMostrar.length; i++) {
      await typewriteLine(`     - ${subidasParaMostrar[i]}`);
    }
    if (plantillasSubidas.length > 5) {
      await typewriteLine(`     ... y ${plantillasSubidas.length - 5} más`);
    }
  }
  
  await typewriteLine('');
  
  if (plantillasLlenadas.length > 0) {
    await showSuccess(`� Tienes ${plantillasLlenadas.length} plantilla(s) lista(s) para subir`);
    await showInfo('Usa el menú [7] PUBLICACIÓN para subirlas a Seller Central');
  } else if (plantillasDescargadas.length > 0) {
    await showWarning('⚠️  Tienes plantillas descargadas pero sin llenar');
    await showInfo('Usa la opción [3] para llenarlas con productos');
  } else {
    await showWarning('⚠️  No hay plantillas disponibles');
    await showInfo('Usa la opción [1] para solicitar una plantilla a Amazon');
  }
  
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
      if (code === 0) {
        typewriteLine('');
        showSuccess('✅ Proceso completado exitosamente');
      } else {
        typewriteLine('');
        showError(`❌ Error en el proceso (código: ${code})`);
      }
      typewriteLine('');
      ask(require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      }), 'Presiona ENTER para continuar...').then(resolve);
    });
  });
}

/**
 * Ejecutar script con archivo CSV
 */
function ejecutarScriptConCSV(scriptPath, args, csvPath) {
  return new Promise((resolve) => {
    // El script llenar-plantilla-seller.js debería aceptar el path del CSV como argumento
    const allArgs = [...args, csvPath];
    
    const child = spawn('node', [scriptPath, ...allArgs], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        typewriteLine('');
        showSuccess('✅ Plantilla llenada exitosamente');
        typewriteLine('');
        showInfo('📌 Siguiente paso: Usa el menú [7] PUBLICACIÓN para subir la plantilla');
      } else {
        typewriteLine('');
        showError(`❌ Error al llenar plantilla (código: ${code})`);
      }
      typewriteLine('');
      ask(require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      }), 'Presiona ENTER para continuar...').then(resolve);
    });
  });
}

/**
 * Contar líneas de un archivo CSV
 */
function contarLineasCSV(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve(0);
      return;
    }
    
    const csv = require('csv-parser');
    let count = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', () => count++)
      .on('end', () => resolve(count))
      .on('error', () => resolve(0));
  });
}

module.exports = { show };
