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
const { getBatchFiles, vendorDirExists, getVendorDir, countVendorProducts, hasSimplePlan, hasAnyPlan, countConsolidatedBatches, countExtractedBatches } = require('./utils/vendor-utils');

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
  
  // Listar todos los vendedores registrados y su estado de plan
  const projects = loadProjects();
  const vendors = [];
  
  for (const sellerId in projects.projects) {
    const vendor = projects.projects[sellerId];
    const productCount = vendorDirExists(sellerId) ? countVendorProducts(sellerId) : 0;
    const batchFiles = getBatchFiles(sellerId);
    const tieneBatches = batchFiles.length > 0;
    const tienePlanSimple = vendorDirExists(sellerId) ? hasSimplePlan(sellerId) : false;
    const tieneCualquierPlan = tieneBatches || tienePlanSimple;
    
    vendors.push({
      sellerId,
      products: productCount,
      vendor,
      tieneBatches,
      tienePlanSimple,
      tieneCualquierPlan
    });
  }
  
  if (vendors.length === 0) {
  await showWarning('No hay vendedores registrados');
  await showInfo('Primero registra un vendedor en [1] Gestión de Vendedores');
  await pause(rl);
    return;
  }
  
  // Separar por estado de plan (simple o batches)
  const vendoresConPlan = vendors.filter(v => v.tieneCualquierPlan);
  const vendoresSinPlan = vendors.filter(v => !v.tieneCualquierPlan);
  
  await typewriteLine('\nEstado de planes por vendedor:');
  await typewriteLine('');
  
  // Mostrar con plan (simple o batches)
  await typewriteLine('✓ Con plan:');
  if (vendoresConPlan.length === 0) {
    await typewriteLine('   — Ninguno');
  } else {
    for (const { sellerId, products, vendor, tieneBatches, tienePlanSimple } of vendoresConPlan) {
      const tipo = products >= 1000 ? '(GRANDE)' : '(pequeño)';
      const etiquetaPlan = tieneBatches ? 'plan de batches' : (tienePlanSimple ? 'plan simple' : 'plan');
      await typewriteLine(`   • ${sellerId} (${products} productos) ${tipo} - ${vendor.nombre || 'Sin nombre'} — ${etiquetaPlan}`);
    }
  }
  
  await typewriteLine('');
  // Mostrar sin plan (seleccionables)
  await typewriteLine('⏳ Sin plan (seleccionables):');
  if (vendoresSinPlan.length === 0) {
  await typewriteLine('   — Ninguno');
  await typewriteLine('');
  await showInfo('Para regenerar un plan existente usa la opción [4] Resetear plan');
  await pause(rl);
    return;
  }
  
  await typewriteLine('');
  for (let i = 0; i < vendoresSinPlan.length; i++) {
    const { sellerId, products, vendor } = vendoresSinPlan[i];
    const tipo = products >= 1000 ? '(GRANDE)' : '(pequeño)';
    await typewriteLine(`[${i + 1}] ${sellerId} (${products} productos) ${tipo} - ${vendor.nombre || 'Sin nombre'}`);
  }
  
  await typewriteLine('[0] ← Volver');
  await typewriteLine('');
  
  const batchPlanOption = await ask(rl, 'Selecciona un vendedor SIN plan: ');
  
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
  const vendorsConPlan = [];
  const vendorsSinPlan = [];
  
  await typewriteLine('\n🔍 Analizando planes generados...\n');
  
  for (const sellerId in projects.projects) {
    const vendor = projects.projects[sellerId];
    const exists = vendorDirExists(sellerId);
    const productCount = exists ? countVendorProducts(sellerId) : 0;
    const batchFiles = exists ? getBatchFiles(sellerId) : [];
    const simple = exists ? hasSimplePlan(sellerId) : false;
    const anyPlan = exists ? hasAnyPlan(sellerId) : false;

    if (anyPlan) {
      const consolidated = countConsolidatedBatches(sellerId);
      const extracted = countExtractedBatches(sellerId);
      vendorsConPlan.push({ sellerId, vendor, productCount, batchFiles, simple, consolidated, extracted });
    } else {
      vendorsSinPlan.push({ sellerId, vendor, productCount });
    }
  }

  if (vendorsConPlan.length > 0) {
    for (const v of vendorsConPlan) {
      await typewriteLine(`📦 ${v.sellerId} (${v.vendor.nombre || 'Sin nombre'}):`, { charDelay: 10 });
      await typewriteLine(`  • Productos extraídos: ${v.productCount}`, { charDelay: 5 });
      if (v.batchFiles.length > 0) {
        await typewriteLine(`  • Plan de batches: ${v.batchFiles.length} batches generados`, { charDelay: 5 });
        await typewriteLine(`  • Progreso: ${v.consolidated}/${v.batchFiles.length} batches consolidados (${v.extracted} extraído(s))`, { charDelay: 5 });
      }
      if (v.simple) {
        await typewriteLine(`  • Plan: Simple (sin batches)`, { charDelay: 5 });
      }
      await typewriteLine('');
    }
  } else {
    await showInfo('No hay planes generados');
    await showInfo('Genera un plan desde las opciones [1] o [2]');
  }

  // Mostrar también vendedores sin plan
  await showSeparator();
  await typewriteLine('📝 Vendedores registrados sin plan:');
  if (vendorsSinPlan.length === 0) {
    await typewriteLine('  — Ninguno');
  } else {
    for (const v of vendorsSinPlan) {
      const sugerencia = v.productCount >= 1000 ? 'Sugerido: batches' : 'Sugerido: simple';
      await typewriteLine(`  • ${v.sellerId} (${v.vendor.nombre || 'Sin nombre'}) — Productos extraídos: ${v.productCount} — ${sugerencia}`);
    }
  }

  // Acciones útiles
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('Acciones:');
  await typewriteLine('[1] ➕ Crear plan para vendedor sin plan');
  await typewriteLine('[2] 🗑️  Borrar plan de vendedor');
  await typewriteLine('[0] ← Volver');
  await typewriteLine('');

  const action = await ask(rl, 'Selecciona una acción: ');

  if (action === '1') {
    if (vendorsSinPlan.length === 0) {
      await showInfo('No hay vendedores sin plan');
      await pause(rl);
      return;
    }
    await typewriteLine('');
    await typewriteLine('Vendedores sin plan:');
    for (let i = 0; i < vendorsSinPlan.length; i++) {
      const v = vendorsSinPlan[i];
      const sugerencia = v.productCount >= 1000 ? '(recomendado: batches)' : '(recomendado: simple)';
      await typewriteLine(`[${i + 1}] ${v.sellerId} — ${v.vendor.nombre || 'Sin nombre'} ${sugerencia}`);
    }
    await typewriteLine('[0] ← Volver');
    await typewriteLine('');
    const pick = await ask(rl, 'Selecciona vendedor: ');
    if (pick === '0') return;
    const idx = parseInt(pick) - 1;
    if (isNaN(idx) || idx < 0 || idx >= vendorsSinPlan.length) {
      await showError('Opción inválida');
      await pause(rl);
      return;
    }
    const sel = vendorsSinPlan[idx];
    const recommendedBatch = sel.productCount >= 1000;
    let tipo = recommendedBatch ? 'b' : 's';
    const override = await ask(rl, `Crear plan ${recommendedBatch ? 'de batches' : 'simple'} para ${sel.sellerId}. ¿Deseas cambiar? (b = batches, s = simple, Enter para continuar): `);
    if (override.trim().toLowerCase() === 'b') tipo = 'b';
    if (override.trim().toLowerCase() === 's') tipo = 's';

    await typewriteLine(`\n🚀 Generando plan ${tipo === 'b' ? 'de batches' : 'simple'} para ${sel.sellerId}...\n`);
    await new Promise((resolve) => {
      const script = path.join(__dirname, '..', tipo === 'b' ? 'create-plan-batches.js' : 'create-plan.js');
      const child = spawn('node', [script, sel.sellerId], { stdio: 'inherit' });
      child.on('close', async (code) => {
        if (code === 0) {
          await showSuccess('✓ Plan generado');
        } else {
          await showError(`✗ Error al generar plan (código: ${code})`);
        }
        resolve();
      });
    });
    await pause(rl);
  } else if (action === '2') {
    if (vendorsConPlan.length === 0) {
      await showInfo('No hay vendedores con plan');
      await pause(rl);
      return;
    }
    await typewriteLine('');
    await typewriteLine('Vendedores con plan:');
    for (let i = 0; i < vendorsConPlan.length; i++) {
      const v = vendorsConPlan[i];
      const etiquetaPlan = v.batchFiles.length > 0 ? 'batches' : (v.simple ? 'simple' : 'plan');
      await typewriteLine(`[${i + 1}] ${v.sellerId} — ${v.vendor.nombre || 'Sin nombre'} (${etiquetaPlan})`);
    }
    await typewriteLine('[0] ← Volver');
    await typewriteLine('');
    const pick = await ask(rl, 'Selecciona vendedor a borrar plan: ');
    if (pick === '0') return;
    const idx = parseInt(pick) - 1;
    if (isNaN(idx) || idx < 0 || idx >= vendorsConPlan.length) {
      await showError('Opción inválida');
      await pause(rl);
      return;
    }
    const sel = vendorsConPlan[idx];
    await showWarning(`\n⚠️ Esto eliminará archivos de plan de ${sel.sellerId}. Los productos extraídos NO se borrarán.`);
    const confirm = await ask(rl, 'Escribe "SI" para confirmar: ');
    if (confirm !== 'SI') {
      await showInfo('Operación cancelada');
      await pause(rl);
      return;
    }
    // Borrar planes
    const dir = getVendorDir(sel.sellerId);
    let eliminados = 0;
    // Borrar batch plans
    for (const b of sel.batchFiles) {
      try { fs.unlinkSync(b.path); eliminados++; } catch (e) {}
    }
    // Borrar simple plan
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (/^\d{4}-\d{2}-\d{2}-plan\.json$/.test(f)) {
        try { fs.unlinkSync(path.join(dir, f)); eliminados++; } catch (e) {}
      }
    }
    await showSuccess(`✓ ${eliminados} archivo(s) de plan eliminados`);
    await pause(rl);
  } else {
    // volver
  }
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
      fs.unlinkSync(batchFile.path);
      eliminados++;
    } catch (err) {
      await showError(`Error al eliminar ${path.basename(batchFile.path)}: ${err.message}`);
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
