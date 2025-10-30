/**
 * MÓDULO: EJECUTAR SCRAPING
 * 
 * [1] Scraping Simple (vendedor completo)
 * [2] Scraping por Batch
 * [3] Opciones Avanzadas
 * [4] Ver progreso
 * [0] Volver
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { 
  typewriteLine, 
  showTitle, 
  showSeparator,
  showInfo, 
  showWarning,
  showSuccess,
  showError,
  ask, 
  pause 
} = require('./utils/display-utils');
const { loadProjects, listVendorIds, getVendorInfo } = require('./utils/projects-utils');
const { getBatchFiles, vendorDirExists, getVendorDir } = require('./utils/vendor-utils');

// ============================================
// SCRAPING SIMPLE (VENDEDOR COMPLETO)
// ============================================
async function scrapingSimple(rl) {
  await typewriteLine('');
  await showTitle('SCRAPING SIMPLE', { icon: '🎯' });
  
  // Listar vendedores registrados
  const projects = loadProjects();
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showWarning('No hay vendedores registrados');
    await pause(rl);
    return;
  }
  
  await typewriteLine('\nVendedores disponibles:', { charDelay: 10 });
  await typewriteLine('');
  
  const vendorList = [];
  for (let i = 0; i < vendors.length; i++) {
    const sellerId = vendors[i];
    const vendor = getVendorInfo(sellerId);
    vendorList.push({ sellerId, vendor });
    await typewriteLine(`[${i + 1}] ${sellerId} - ${vendor.nombre || 'Sin nombre'}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const vendorOption = await ask(rl, 'Selecciona un vendedor: ');
  
  if (vendorOption === '0') {
    return;
  }
  
  const selectedIndex = parseInt(vendorOption) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= vendorList.length) {
    await showError('Opción inválida');
    await pause(rl);
    return;
  }
  
  const sellerId = vendorList[selectedIndex].sellerId;
  
  // Ejecutar scraping simple
  await typewriteLine('\n🚀 Iniciando scraping completo del vendedor...\n');
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'b-scrape-vendedor.js');
    const child = spawn('node', [scriptPath, sellerId], { stdio: 'inherit' });
    
    child.on('close', async (code) => {
      if (code === 0) {
        await showSuccess('✓ Scraping completado exitosamente');
      } else {
        await showError(`✗ Scraping finalizó con errores (código: ${code})`);
      }
      await pause(rl);
      resolve();
    });
  });
}

// ============================================
// SCRAPING POR BATCH
// ============================================
async function scrapingBatch(rl) {
  await typewriteLine('');
  await showTitle('SCRAPING POR BATCH', { icon: '📦' });
  
  // Filtrar solo vendedores con plan de batches
  const projects = loadProjects();
  const vendorsWithBatches = [];
  
  for (const sellerId in projects.projects) {
    if (vendorDirExists(sellerId)) {
      const batchFiles = getBatchFiles(sellerId);
      if (batchFiles.length > 0) {
        vendorsWithBatches.push({
          sellerId,
          batches: batchFiles.length,
          vendor: projects.projects[sellerId]
        });
      }
    }
  }
  
  if (vendorsWithBatches.length === 0) {
    await showWarning('No hay vendedores con plan de batches generado');
    await showInfo('Primero genera un plan de batches en: [2] Gestionar Planes');
    await pause(rl);
    return;
  }
  
  // Listar vendedores con batches
  await typewriteLine('\nVendedores con plan de batches:', { charDelay: 10 });
  await typewriteLine('');
  
  for (let i = 0; i < vendorsWithBatches.length; i++) {
    const { sellerId, batches, vendor } = vendorsWithBatches[i];
    await typewriteLine(`[${i + 1}] ${sellerId} (${batches} batches) - ${vendor.nombre || 'Sin nombre'}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const vendorOption = await ask(rl, 'Selecciona un vendedor: ');
  
  if (vendorOption === '0') {
    return;
  }
  
  const selectedIndex = parseInt(vendorOption) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= vendorsWithBatches.length) {
    await showError('Opción inválida');
    await pause(rl);
    return;
  }
  
  const selectedVendor = vendorsWithBatches[selectedIndex];
  const sellerId = selectedVendor.sellerId;
  
  // Mostrar batches disponibles
  const batchFiles = getBatchFiles(sellerId);
  await typewriteLine(`\nBatches disponibles para ${sellerId}:`, { charDelay: 10 });
  await typewriteLine('');
  
  const batchList = [];
  for (const batchFile of batchFiles) {
    const batchNum = batchFile.number;
    const vendorDir = getVendorDir(sellerId);
    
    // Verificar si el batch ya fue consolidado
    const consolidatedFile = path.join(vendorDir, `batch-${batchNum}-consolidated.json`);
    
    // Verificar si hay archivos de productos extraídos (por categoría)
    const files = fs.existsSync(vendorDir) ? fs.readdirSync(vendorDir) : [];
    const categoryFiles = files.filter(f => 
      f.includes('-products.json') && 
      !f.includes('consolidated') &&
      !f.includes('batch-')
    );
    
    let status;
    if (fs.existsSync(consolidatedFile)) {
      status = '✓ Consolidado';
    } else if (categoryFiles.length > 0) {
      status = '🔄 Listo para consolidar';
    } else {
      status = '⏳ Pendiente';
    }
    
    batchList.push({ batchNum, status });
    await typewriteLine(`[${batchNum}] Batch ${batchNum} - ${status}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const batchOption = await ask(rl, 'Selecciona un batch: ');
  
  if (batchOption === '0') {
    return;
  }
  
  const batchNum = batchOption;
  const selectedBatch = batchList.find(b => b.batchNum.toString() === batchNum);
  
  if (!selectedBatch) {
    await showError(`Batch ${batchNum} no existe`);
    await pause(rl);
    return;
  }
  
  // Ejecutar extracción de batch
  await typewriteLine(`\n🚀 Iniciando extracción del Batch ${batchNum}...\n`);
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'extract-batch-products.js');
    const child = spawn('node', [scriptPath, sellerId, batchNum], { stdio: 'inherit' });
    
    child.on('close', async (code) => {
      if (code === 0) {
        await showSuccess(`✓ Batch ${batchNum} extraído exitosamente`);
        
        // Preguntar si consolidar automáticamente
        await typewriteLine('');
        const consolidar = await ask(rl, '¿Consolidar productos ahora? (s/n): ');
        
        if (consolidar.toLowerCase() === 's') {
          await typewriteLine('\n📊 Consolidando productos...\n');
          
          const consolidateScript = path.join(__dirname, '..', 'consolidate-batch-products.js');
          const childConsolidate = spawn('node', [consolidateScript, sellerId, batchNum], { stdio: 'inherit' });
          
          childConsolidate.on('close', async (codeConsolidate) => {
            if (codeConsolidate === 0) {
              await showSuccess('✓ Productos consolidados (JSON + CSV generados)');
            } else {
              await showError('✗ Error al consolidar productos');
            }
            await pause('\nPresiona Enter para volver al menú...');
            resolve();
          });
        } else {
          await pause('\nPresiona Enter para volver al menú...');
          resolve();
        }
      } else {
        await showError(`✗ Extracción finalizó con errores (código: ${code})`);
        await pause('\nPresiona Enter para volver al menú...');
        resolve();
      }
    });
  });
}

// ============================================
// OPCIONES AVANZADAS
// ============================================
async function opcionesAvanzadas(rl) {
  await typewriteLine('');
  await showTitle('OPCIONES AVANZADAS', { icon: '🔧' });
  
  await typewriteLine('[1] 🔄 Reextraer batch (forzar)', { charDelay: 8 });
  await typewriteLine('[2] 🧹 Limpiar archivos temporales', { charDelay: 8 });
  await typewriteLine('[3] 📋 Consolidar productos manualmente', { charDelay: 8 });
  await typewriteLine('[0] ← Volver', { charDelay: 8 });
  await typewriteLine('');
  
  const option = await ask(rl, 'Selecciona: ');
  
  switch (option) {
    case '1':
      await showInfo('Función en desarrollo');
      await pause(rl);
      break;
    case '2':
      await showInfo('Función en desarrollo');
      await pause(rl);
      break;
    case '3':
      await consolidarManualmente(rl);
      break;
    case '0':
      break;
    default:
      await showWarning('Opción inválida');
      await pause(rl);
  }
}

async function consolidarManualmente(rl) {
  await typewriteLine('');
  await showTitle('CONSOLIDAR PRODUCTOS', { icon: '📋' });
  
  const vendors = listVendorIds();
  if (vendors.length === 0) {
    await showWarning('No hay vendedores registrados');
    await pause(rl);
    return;
  }
  
  await typewriteLine('\nVendedores disponibles:', { charDelay: 10 });
  await typewriteLine('');
  
  const vendorList = [];
  for (let i = 0; i < vendors.length; i++) {
    const sellerId = vendors[i];
    const vendor = getVendorInfo(sellerId);
    vendorList.push({ sellerId, vendor });
    await typewriteLine(`[${i + 1}] ${sellerId} - ${vendor.nombre || 'Sin nombre'}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const consolidateOption = await ask(rl, 'Selecciona un vendedor: ');
  
  if (consolidateOption === '0') {
    return;
  }
  
  const selectedIndex = parseInt(consolidateOption) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= vendorList.length) {
    await showError('Opción inválida');
    await pause(rl);
    return;
  }
  
  const sellerId = vendorList[selectedIndex].sellerId;
  
  await typewriteLine('\n📊 Consolidando productos...\n');
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'consolidate-batch-products.js');
    const child = spawn('node', [scriptPath, sellerId], { stdio: 'inherit' });
    
    child.on('close', async (code) => {
      if (code === 0) {
        await showSuccess('✓ Productos consolidados');
      } else {
        await showError(`✗ Error al consolidar (código: ${code})`);
      }
      await pause(rl);
      resolve();
    });
  });
}

// ============================================
// VER PROGRESO
// ============================================
async function verProgreso(rl) {
  await typewriteLine('');
  await showTitle('PROGRESO DE EXTRACCIÓN', { icon: '📊' });
  
  const projects = loadProjects();
  let hayBatches = false;
  
  for (const sellerId in projects.projects) {
    if (vendorDirExists(sellerId)) {
      const batchFiles = getBatchFiles(sellerId);
      
      if (batchFiles.length > 0) {
        hayBatches = true;
        await typewriteLine(`\n📦 ${sellerId}:`, { charDelay: 10 });
        
        for (const batchFile of batchFiles) {
          const fileName = path.basename(batchFile);
          const match = fileName.match(/plan-batch-(\d+)\.json/);
          const batchNum = match ? match[1] : '?';
          
          const extractedFile = path.join(
            getVendorDir(sellerId),
            `batch-${batchNum}-products.json`
          );
          
          if (fs.existsSync(extractedFile)) {
            const content = JSON.parse(fs.readFileSync(extractedFile, 'utf-8'));
            const totalProducts = content.products ? content.products.length : 0;
            await typewriteLine(`  ✓ Batch ${batchNum}: ${totalProducts} productos extraídos`, { charDelay: 5 });
          } else {
            await typewriteLine(`  ⏳ Batch ${batchNum}: Pendiente`, { charDelay: 5 });
          }
        }
      }
    }
  }
  
  if (!hayBatches) {
    await showInfo('No hay batches en progreso');
  }
  
  await typewriteLine('');
  await pause(rl);
}

// ============================================
// MENÚ PRINCIPAL
// ============================================
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await typewriteLine('');
    await showTitle('EJECUTAR SCRAPING (FASE 1)', { icon: '🔄' });
    
    await typewriteLine('[1] 🎯 Scraping Simple (vendedor completo)', { charDelay: 8 });
    await typewriteLine('[2] 📦 Scraping por Batch', { charDelay: 8 });
    await typewriteLine('[3] 🔧 Opciones Avanzadas', { charDelay: 8 });
    await typewriteLine('[4] 📊 Ver progreso actual', { charDelay: 8 });
    await typewriteLine('[0] ← Volver', { charDelay: 8 });
    await typewriteLine('');
    
    const option = await ask(rl, 'Selecciona una opción: ');
    
    switch (option) {
      case '1':
        await scrapingSimple(rl);
        break;
      case '2':
        await scrapingBatch(rl);
        break;
      case '3':
        await opcionesAvanzadas(rl);
        break;
      case '4':
        await verProgreso(rl);
        break;
      case '0':
        continuar = false;
        break;
      default:
        await showWarning('Opción inválida');
        await pause(rl);
    }
  }
}

module.exports = { show };
