/**
 * MÓDULO: GESTIONAR PLANES
 * 
 * [1] Plan Simple
 * [2] Plan Batches
 * [3] Ver estado
 * [4] Resetear
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
const { getBatchFiles, vendorDirExists, getVendorDir, countVendorProducts } = require('./utils/vendor-utils');

// ============================================
// PLAN SIMPLE (< 1000 productos)
// ============================================
async function planSimple(rl) {
  await typewriteLine('');
  await showTitle('PLAN SIMPLE', { icon: '📝' });
  
  // Listar vendedores pequeños (< 1000 productos)
  const projects = loadProjects();
  const smallVendors = [];
  
  for (const sellerId in projects.projects) {
    const vendor = projects.projects[sellerId];
    if (vendorDirExists(sellerId)) {
      const productCount = countVendorProducts(sellerId);
      
      // Solo vendedores con productos extraídos y < 1000
      if (productCount > 0 && productCount < 1000) {
        // Verificar si ya tiene plan simple
        const vendorDir = getVendorDir(sellerId);
        const files = fs.readdirSync(vendorDir);
        const tienePlanSimple = files.some(f => f.match(/^\d{4}-\d{2}-\d{2}-plan\.json$/));
        
        smallVendors.push({
          sellerId,
          products: productCount,
          vendor,
          tienePlanSimple
        });
      }
    }
  }
  
  if (smallVendors.length === 0) {
    await showWarning('No hay vendedores pequeños (< 1000 productos) con datos extraídos');
    await showInfo('Primero ejecuta scraping en un vendedor');
    await pause(rl);
    return;
  }
  
  // Filtrar vendedores SIN plan simple
  const vendoresSinPlan = smallVendors.filter(v => !v.tienePlanSimple);
  
  if (vendoresSinPlan.length === 0) {
    await showWarning('Todos los vendedores pequeños ya tienen plan simple');
    await showInfo('El plan simple se genera automáticamente al hacer scraping');
    await pause(rl);
    return;
  }
  
  await typewriteLine('\nVendedores disponibles (sin plan simple):', { charDelay: 10 });
  await typewriteLine('');
  
  for (let i = 0; i < vendoresSinPlan.length; i++) {
    const { sellerId, products, vendor } = vendoresSinPlan[i];
    await typewriteLine(`[${i + 1}] ${sellerId} (${products} productos) - ${vendor.nombre || 'Sin nombre'}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const planOption = await ask(rl, 'Selecciona un vendedor: ');
  
  if (planOption === '0') {
    return;
  }
  
  const selectedIndex = parseInt(planOption) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= vendoresSinPlan.length) {
    await showError('Opción inválida');
    await pause(rl);
    return;
  }
  
  const selected = vendoresSinPlan[selectedIndex];
  const sellerId = selected.sellerId;
  
  await typewriteLine(`\n🚀 Generando plan simple para ${sellerId}...\n`);
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'create-plan.js');
    const child = spawn('node', [scriptPath, sellerId], { stdio: 'inherit' });
    
    child.on('close', async (code) => {
      if (code === 0) {
        await showSuccess('✓ Plan simple generado exitosamente');
      } else {
        await showError(`✗ Error al generar plan (código: ${code})`);
      }
      await pause(rl);
      resolve();
    });
  });
}

// ============================================
// PLAN BATCHES (>= 1000 productos)
// ============================================
async function planBatches(rl) {
  await typewriteLine('');
  await showTitle('PLAN BATCHES', { icon: '📦' });
  
  // Listar todos los vendedores con productos
  const projects = loadProjects();
  const vendors = [];
  
  for (const sellerId in projects.projects) {
    const vendor = projects.projects[sellerId];
    if (vendorDirExists(sellerId)) {
      const productCount = countVendorProducts(sellerId);
      
      if (productCount > 0) {
        // Verificar si ya tiene plan de batches
        const batchFiles = getBatchFiles(sellerId);
        const tieneBatches = batchFiles.length > 0;
        
        vendors.push({
          sellerId,
          products: productCount,
          vendor,
          tieneBatches
        });
      }
    }
  }
  
  if (vendors.length === 0) {
    await showWarning('No hay vendedores con datos extraídos');
    await showInfo('Primero ejecuta scraping en un vendedor');
    await pause(rl);
    return;
  }
  
  // Filtrar vendedores SIN plan de batches
  const vendoresSinPlan = vendors.filter(v => !v.tieneBatches);
  
  if (vendoresSinPlan.length === 0) {
    await showWarning('Todos los vendedores ya tienen plan de batches');
    await showInfo('Para regenerar un plan, usa la opción [4] Resetear plan');
    await pause(rl);
    return;
  }
  
  await typewriteLine('\nVendedores disponibles (sin plan de batches):', { charDelay: 10 });
  await typewriteLine('');
  
  for (let i = 0; i < vendoresSinPlan.length; i++) {
    const { sellerId, products, vendor } = vendoresSinPlan[i];
    const tipo = products >= 1000 ? '(GRANDE)' : '(pequeño)';
    await typewriteLine(`[${i + 1}] ${sellerId} (${products} productos) ${tipo} - ${vendor.nombre || 'Sin nombre'}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const batchPlanOption = await ask(rl, 'Selecciona un vendedor: ');
  
  if (batchPlanOption === '0') {
    return;
  }
  
  const selectedIndex = parseInt(batchPlanOption) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= vendoresSinPlan.length) {
    await showError('Opción inválida');
    await pause(rl);
    return;
  }
  
  const selected = vendoresSinPlan[selectedIndex];
  const sellerId = selected.sellerId;
  
  await typewriteLine(`\n🚀 Generando plan de batches para ${sellerId}...\n`);
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'create-plan-batches.js');
    const child = spawn('node', [scriptPath, sellerId], { stdio: 'inherit' });
    
    child.on('close', async (code) => {
      if (code === 0) {
        await showSuccess('✓ Plan de batches generado exitosamente');
        
        // Mostrar resumen de batches generados
        const newBatchFiles = getBatchFiles(sellerId);
        await typewriteLine(`\n📦 Se generaron ${newBatchFiles.length} batches`);
      } else {
        await showError(`✗ Error al generar plan (código: ${code})`);
      }
      await pause(rl);
      resolve();
    });
  });
}

// ============================================
// VER ESTADO DE PLANES
// ============================================
async function verEstado(rl) {
  await typewriteLine('');
  await showTitle('ESTADO DE PLANES', { icon: '📊' });
  
  const projects = loadProjects();
  let hayPlanes = false;
  
  await typewriteLine('\n🔍 Analizando planes generados...\n');
  
  for (const sellerId in projects.projects) {
    const vendor = projects.projects[sellerId];
    
    if (vendorDirExists(sellerId)) {
      const batchFiles = getBatchFiles(sellerId);
      const productCount = countVendorProducts(sellerId);
      
      if (batchFiles.length > 0 || productCount > 0) {
        hayPlanes = true;
        await typewriteLine(`📦 ${sellerId} (${vendor.nombre || 'Sin nombre'}):`, { charDelay: 10 });
        await typewriteLine(`  • Productos extraídos: ${productCount}`, { charDelay: 5 });
        
        if (batchFiles.length > 0) {
          await typewriteLine(`  • Plan de batches: ${batchFiles.length} batches generados`, { charDelay: 5 });
          
          // Ver progreso de cada batch
          let completados = 0;
          for (const batchFile of batchFiles) {
            // batchFile es un objeto: {filename, path, number}
            const batchNum = batchFile.number;
            
            const consolidatedFile = path.join(
              getVendorDir(sellerId),
              `batch-${batchNum}-consolidated.json`
            );
            
            if (fs.existsSync(consolidatedFile)) {
              completados++;
            }
          }
          
          await typewriteLine(`  • Progreso: ${completados}/${batchFiles.length} batches consolidados`, { charDelay: 5 });
        } else {
          await typewriteLine(`  • Plan: Simple (sin batches)`, { charDelay: 5 });
        }
        
        await typewriteLine('');
      }
    }
  }
  
  if (!hayPlanes) {
    await showInfo('No hay planes generados');
    await showInfo('Genera un plan desde las opciones [1] o [2]');
  }
  
  await typewriteLine('');
  await pause(rl);
}

// ============================================
// RESETEAR PLAN
// ============================================
async function resetearPlan(rl) {
  await typewriteLine('');
  await showTitle('RESETEAR PLAN', { icon: '🔄' });
  
  const projects = loadProjects();
  const vendorsWithPlans = [];
  
  for (const sellerId in projects.projects) {
    if (vendorDirExists(sellerId)) {
      const batchFiles = getBatchFiles(sellerId);
      if (batchFiles.length > 0) {
        vendorsWithPlans.push({
          sellerId,
          batches: batchFiles.length,
          vendor: projects.projects[sellerId]
        });
      }
    }
  }
  
  if (vendorsWithPlans.length === 0) {
    await showWarning('No hay vendedores con planes de batches');
    await pause(rl);
    return;
  }
  
  await typewriteLine('\nVendedores con planes:', { charDelay: 10 });
  await typewriteLine('');
  
  for (let i = 0; i < vendorsWithPlans.length; i++) {
    const { sellerId, batches, vendor } = vendorsWithPlans[i];
    await typewriteLine(`[${i + 1}] ${sellerId} (${batches} batches) - ${vendor.nombre || 'Sin nombre'}`, { charDelay: 5 });
  }
  
  await typewriteLine('[0] ← Volver', { charDelay: 5 });
  await typewriteLine('');
  
  const resetOption = await ask(rl, 'Selecciona vendedor para resetear: ');
  
  if (resetOption === '0') {
    return;
  }
  
  const selectedIndex = parseInt(resetOption) - 1;
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= vendorsWithPlans.length) {
    await showError('Opción inválida');
    await pause(rl);
    return;
  }
  
  const selected = vendorsWithPlans[selectedIndex];
  const sellerId = selected.sellerId;
  if (!selected) {
    await showError(`Vendedor "${sellerId}" no tiene plan de batches`);
    await pause(rl);
    return;
  }
  
  await showWarning(`\n⚠️  Esto eliminará todos los archivos plan-batch-*.json de ${sellerId}`);
  await showWarning('⚠️  Los productos extraídos NO se borrarán\n');
  
  const confirmacion = await ask(rl, 'Escribe "SI" para confirmar: ');
  
  if (confirmacion !== 'SI') {
    await showInfo('Operación cancelada');
    await pause(rl);
    return;
  }
  
  // Eliminar archivos de plan
  const batchFiles = getBatchFiles(sellerId);
  let eliminados = 0;
  
  for (const batchFile of batchFiles) {
    try {
      fs.unlinkSync(batchFile);
      eliminados++;
    } catch (err) {
      await showError(`Error al eliminar ${path.basename(batchFile)}: ${err.message}`);
    }
  }
  
  await showSuccess(`\n✓ ${eliminados} archivos de plan eliminados`);
  await showInfo('Puedes regenerar el plan desde [2] Plan Batches');
  await pause(rl);
  
  // Preguntar si quiere resetear otro
  await typewriteLine('');
  const otro = await ask(rl, '¿Resetear otro vendedor? (s/n): ');
  if (otro.toLowerCase() === 's') {
    await resetearPlan(rl);
  }
}

// ============================================
// MENÚ PRINCIPAL
// ============================================
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await typewriteLine('');
    await showTitle('GESTIONAR PLANES (FASE 0)', { icon: '📋' });
    
    await typewriteLine('[1] 📝 Plan Simple (vendedores pequeños)', { charDelay: 8 });
    await typewriteLine('[2] 📦 Plan Batches (cualquier tamaño)', { charDelay: 8 });
    await typewriteLine('[3] 📊 Ver estado de planes', { charDelay: 8 });
    await typewriteLine('[4] 🔄 Resetear plan de batches', { charDelay: 8 });
    await typewriteLine('[0] ← Volver', { charDelay: 8 });
    await typewriteLine('');
    
    const option = await ask(rl, 'Selecciona una opción: ');
    
    switch (option) {
      case '1':
        await planSimple(rl);
        break;
      case '2':
        await planBatches(rl);
        break;
      case '3':
        await verEstado(rl);
        break;
      case '4':
        await resetearPlan(rl);
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
