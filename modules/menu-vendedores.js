/**
 * MÓDULO: GESTIÓN DE VENDEDORES
 * 
 * [1] Registrar nuevo vendedor
 * [2] Ver vendedores registrados
 * [3] Borrar vendedor
 * [4] Ver detalle de vendedor
 * [0] Volver
 */

const { spawn } = require('child_process');
const path = require('path');

const {
  typewriteLine,
  showTitle,
  showSeparator,
  showError,
  showSuccess,
  showWarning,
  showInfo,
  ask
} = require('./utils/display-utils');

const {
  loadProjects,
  listVendorIds,
  getVendorInfo,
  addVendor,
  deleteVendor
} = require('./utils/projects-utils');

const {
  getVendorSummary,
  vendorDirExists,
  ROOT_DIR
} = require('./utils/vendor-utils');

/**
 * Mostrar menú principal de vendedores
 */
async function showMenu() {
  await showTitle('GESTIÓN DE VENDEDORES', { icon: '📋' });
  await typewriteLine('[1] ➕ Registrar nuevo vendedor', { charDelay: 8 });
  await typewriteLine('[2] 👁️  Ver vendedores registrados', { charDelay: 8 });
  await typewriteLine('[3] 🗑️  Borrar vendedor', { charDelay: 8 });
  await typewriteLine('[4] ℹ️  Ver detalle de vendedor', { charDelay: 8 });
  await typewriteLine('[0] ← Volver al menú principal', { charDelay: 8 });
  await typewriteLine('');
}

/**
 * Registrar nuevo vendedor
 */
async function registrarVendedor(rl) {
  await typewriteLine('');
  await showTitle('REGISTRAR NUEVO VENDEDOR', { icon: '➕' });

  const sellerId = await ask(rl, 'ID del vendedor (Seller ID): ');

  if (!sellerId || sellerId === '0') {
    await showWarning('Operación cancelada');
    return;
  }

  // Verificar si ya existe
  const existing = getVendorInfo(sellerId);
  if (existing) {
    await showError(`El vendedor ${sellerId} ya está registrado`);
    return;
  }

  // Ejecutar test-seller.js
  await typewriteLine('');
  await showInfo('Ejecutando análisis del vendedor...');
  await typewriteLine('Esto puede tardar 1-2 minutos');
  await typewriteLine('');

  const testSellerScript = path.join(ROOT_DIR, 'test-seller.js');

  return new Promise((resolve) => {
    const child = spawn('node', [testSellerScript, sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');

      if (code === 0) {
        await showSuccess(`Vendedor ${sellerId} registrado correctamente`);

        // Preguntar si quiere registrar otro
        await typewriteLine('');
        const otro = await ask(rl, '¿Registrar otro vendedor? (s/n): ');

        if (otro.toLowerCase() === 's') {
          await registrarVendedor(rl);
        }
      } else {
        await showError('Error al registrar el vendedor');
      }

      resolve();
    });
  });
}

/**
 * Ver vendedores registrados
 */
async function verVendedores(rl) {
  await typewriteLine('');
  await showTitle('VENDEDORES REGISTRADOS', { icon: '👁️' });

  const vendorIds = listVendorIds();

  if (vendorIds.length === 0) {
    await showWarning('No hay vendedores registrados');
    await typewriteLine('');
    await showInfo('Usa la opción [1] para registrar un vendedor');
    return;
  }

  await typewriteLine(`Total: ${vendorIds.length} vendedor(es)`, { charDelay: 8 });
  await typewriteLine('');

  // Encabezados de tabla
  await typewriteLine('┌─────┬───────────────┬──────────┬─────────┬────────────────────────────────────────────┐', { charDelay: 0 });
  await typewriteLine('│ #   │ Seller ID     │ Productos│ Batches │ Tienda (Link)                              │', { charDelay: 0 });
  await typewriteLine('├─────┼───────────────┼──────────┼─────────┼────────────────────────────────────────────┤', { charDelay: 0 });

  for (let i = 0; i < vendorIds.length; i++) {
    const sellerId = vendorIds[i];
    const info = getVendorInfo(sellerId);
    const summary = getVendorSummary(sellerId);

    const num = `${i + 1}`.padEnd(3);
    const id = sellerId.substring(0, 13).padEnd(13);
    const productos = summary.exists ? `${summary.products_count}`.padEnd(8) : '-'.padEnd(8);
    const batches = summary.has_batches ? `${summary.batches_count}`.padEnd(7) : '-'.padEnd(7);
    const url = `amazon.com.mx/s?me=${sellerId}`.substring(0, 42).padEnd(42);

    await typewriteLine(`│ ${num} │ ${id} │ ${productos} │ ${batches} │ ${url} │`, { charDelay: 0 });
  }

  await typewriteLine('└─────┴───────────────┴──────────┴─────────┴────────────────────────────────────────────┘', { charDelay: 0 });
  await typewriteLine('');
  await typewriteLine('💡 Copia el link para visitar la tienda del vendedor en el navegador', { charDelay: 8 });
}

/**
 * Borrar vendedor
 */
async function borrarVendedor(rl) {
  await typewriteLine('');
  await showTitle('BORRAR VENDEDOR', { icon: '🗑️' });

  const vendorIds = listVendorIds();

  if (vendorIds.length === 0) {
    await showWarning('No hay vendedores registrados');
    return;
  }

  await typewriteLine('Vendedores disponibles:', { charDelay: 8 });
  await typewriteLine('');

  for (let i = 0; i < vendorIds.length; i++) {
    const sellerId = vendorIds[i];
    const info = getVendorInfo(sellerId);
    const storeName = info.store_name || sellerId;

    await typewriteLine(`[${i + 1}] ${storeName} (${sellerId})`, { charDelay: 6 });
  }

  await typewriteLine('');
  const choice = await ask(rl, '¿Qué vendedor borrar? (0 para cancelar): ');

  const index = parseInt(choice) - 1;

  if (index < 0 || index >= vendorIds.length) {
    await showWarning('Operación cancelada');
    return;
  }

  const sellerId = vendorIds[index];
  const info = getVendorInfo(sellerId);
  const storeName = info.store_name || sellerId;

  await typewriteLine('');
  await showWarning(`⚠️  ¿Estás seguro de borrar ${storeName} (${sellerId})?`);
  await typewriteLine('    Esto solo borrará el registro, no los archivos.', { charDelay: 8 });
  await typewriteLine('');

  const confirm = await ask(rl, 'Confirmar (escribe "SI" para borrar): ');

  if (confirm !== 'SI') {
    await showWarning('Operación cancelada');
    return;
  }

  const result = deleteVendor(sellerId);

  if (result.success) {
    await showSuccess(`Vendedor ${sellerId} borrado del registro`);
    await typewriteLine('');
    await showInfo('Los archivos en data/vendors/ no se borraron');

    // Preguntar si quiere borrar otro
    await typewriteLine('');
    const otro = await ask(rl, '¿Borrar otro vendedor? (s/n): ');

    if (otro.toLowerCase() === 's') {
      await borrarVendedor(rl);
    }
  } else {
    await showError('Error al borrar el vendedor');
  }
}

/**
 * Ver detalle de vendedor
 */
async function verDetalleVendedor(rl) {
  await typewriteLine('');
  await showTitle('DETALLE DE VENDEDOR', { icon: 'ℹ️' });

  const vendorIds = listVendorIds();

  if (vendorIds.length === 0) {
    await showWarning('No hay vendedores registrados');
    return;
  }

  await typewriteLine('Selecciona un vendedor:', { charDelay: 8 });
  await typewriteLine('');

  for (let i = 0; i < vendorIds.length; i++) {
    const sellerId = vendorIds[i];
    const info = getVendorInfo(sellerId);
    const storeName = info.store_name || sellerId;

    await typewriteLine(`[${i + 1}] ${storeName}`, { charDelay: 6 });
  }

  await typewriteLine('');
  const choice = await ask(rl, 'Número de vendedor (0 para cancelar): ');

  const index = parseInt(choice) - 1;

  if (index < 0 || index >= vendorIds.length) {
    await showWarning('Operación cancelada');
    return;
  }

  const sellerId = vendorIds[index];
  const info = getVendorInfo(sellerId);
  const summary = getVendorSummary(sellerId);

  // Imports necesarios
  const fs = require('fs');
  const path = require('path');

  // Detectar fase actual
  const { detectVendorPhase, getBatchConsolidatedFiles, getAllOpportunitiesFiles } = require('./utils/vendor-utils');
  const phaseInfo = detectVendorPhase(sellerId);
  const consolidatedBatches = getBatchConsolidatedFiles(sellerId);
  const opportunitiesFiles = getAllOpportunitiesFiles(sellerId);

  await typewriteLine('');
  await showSeparator('═', 60);
  await typewriteLine(`📊 DETALLE: ${info.store_name || sellerId}`, { charDelay: 10 });
  await showSeparator('═', 60);
  await typewriteLine('');

  // Información básica
  await typewriteLine(`🆔 Seller ID: ${sellerId}`, { charDelay: 6 });
  await typewriteLine(`🔗 Tienda: amazon.com.mx/s?me=${sellerId}`, { charDelay: 6 });

  if (info.registered_date) {
    const date = new Date(info.registered_date).toLocaleDateString();
    await typewriteLine(`📅 Registrado: ${date}`, { charDelay: 6 });
  }

  await typewriteLine('');
  await showSeparator('─', 60);

  // Fase actual
  await typewriteLine(`📍 Estado: ${phaseInfo.label}`, { charDelay: 6 });
  await typewriteLine('');

  // Información de plan y scraping
  if (summary.has_batches) {
    await typewriteLine(`📋 Plan: ${summary.batches_count} batches`, { charDelay: 6 });

    let totalCategories = 0;
    let completedCategories = 0;
    let totalExpected = 0;

    for (const batch of summary.batches_status) {
      totalCategories += batch.total_categories || 0;
      completedCategories += batch.completed_categories || 0;
      totalExpected += batch.expected_products || 0;
    }

    await typewriteLine(`📂 Categorías: ${completedCategories}/${totalCategories} scrapeadas`, { charDelay: 6 });
    await typewriteLine(`📦 Productos esperados (plan): ~${totalExpected.toLocaleString()}`, { charDelay: 6 });
    await typewriteLine(`📊 Productos extraídos (bruto): ${summary.products_count.toLocaleString()}`, { charDelay: 6 });
  } else {
    await typewriteLine(`📋 Plan: Vendedor pequeño (sin batches)`, { charDelay: 6 });
    const count = (summary.products_count || 0).toLocaleString();
    await typewriteLine(`📊 Productos extraídos: ${count}`, { charDelay: 6 });
  }

  await typewriteLine('');

  // Información de consolidación
  if (consolidatedBatches.length > 0) {
    await typewriteLine(`✅ Consolidados: ${consolidatedBatches.length} batches`, { charDelay: 6 });

    // Contar productos consolidados
    let totalConsolidados = 0;
    for (const batch of consolidatedBatches) {
      if (batch.json && fs.existsSync(batch.json)) {
        try {
          const data = JSON.parse(fs.readFileSync(batch.json, 'utf8'));
          const products = data.all_products || data.products || [];
          totalConsolidados += Array.isArray(products) ? products.length : 0;
        } catch (e) { }
      }
    }
    await typewriteLine(`📦 Productos únicos (consolidado): ${totalConsolidados.toLocaleString()}`, { charDelay: 6 });
    await typewriteLine(`💡 El consolidado elimina duplicados`, { charDelay: 6 });
  } else {
    // Vendedor pequeño - verificar si tiene all-products-consolidated
    const allProductsFile = path.join(require('./utils/vendor-utils').getVendorDir(sellerId), 'all-products-consolidated.json');
    if (fs.existsSync(allProductsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(allProductsFile, 'utf8'));
        const products = data.all_products || data.products || [];
        const totalConsolidados = Array.isArray(products) ? products.length : 0;
        await typewriteLine(`✅ Consolidado: 1 archivo`, { charDelay: 6 });
        await typewriteLine(`📦 Productos únicos: ${totalConsolidados.toLocaleString()}`, { charDelay: 6 });
      } catch (e) {
        await typewriteLine(`⏳ Sin archivos consolidados`, { charDelay: 6 });
      }
    } else {
      await typewriteLine(`⏳ Sin archivos consolidados`, { charDelay: 6 });
    }
  }

  await typewriteLine('');

  // Información de verificación
  if (phaseInfo.stats) {
    await showSeparator('─', 60);
    await typewriteLine(`🔍 Verificación:`, { charDelay: 6 });
    await typewriteLine(`   🇲🇽 MX: ${phaseInfo.stats.mx}/${phaseInfo.stats.total} productos`, { charDelay: 6 });
    await typewriteLine(`   🇺🇸 USA: ${phaseInfo.stats.usa}/${phaseInfo.stats.total} productos`, { charDelay: 6 });
    await typewriteLine('');
  }

  // Información de oportunidades
  if (opportunitiesFiles.length > 0) {
    await showSeparator('─', 60);
    await typewriteLine(`💰 Oportunidades:`, { charDelay: 6 });

    // Contar cuántos archivos CSV de oportunidades existen realmente
    const vendorDir = require('./utils/vendor-utils').getVendorDir(sellerId);

    let totalOportunidadesFiles = 0;

    if (summary.has_batches) {
      // Vendedor con batches - contar archivos batch-N-oportunidades*.csv
      for (let i = 1; i <= summary.batches_count; i++) {
        const prefijo = `batch-${i}-oportunidades`;
        const files = [
          path.join(vendorDir, `${prefijo}.csv`),
          path.join(vendorDir, `${prefijo}_menos_50.csv`),
          path.join(vendorDir, `${prefijo}_menos_100.csv`)
        ];
        totalOportunidadesFiles += files.filter(f => fs.existsSync(f)).length;
      }
      await typewriteLine(`   📄 ${totalOportunidadesFiles} archivo${totalOportunidadesFiles !== 1 ? 's' : ''} CSV generado${totalOportunidadesFiles !== 1 ? 's' : ''}`, { charDelay: 6 });
      const batchesConOportunidades = Math.floor(totalOportunidadesFiles / 3);
      await typewriteLine(`   📋 ${batchesConOportunidades} batch${batchesConOportunidades !== 1 ? 'es' : ''} con oportunidades completas`, { charDelay: 6 });
    } else {
      // Vendedor pequeño - contar oportunidades*.csv
      const files = [
        path.join(vendorDir, 'oportunidades.csv'),
        path.join(vendorDir, 'oportunidades_menos_50.csv'),
        path.join(vendorDir, 'oportunidades_menos_100.csv')
      ];
      totalOportunidadesFiles = files.filter(f => fs.existsSync(f)).length;
      await typewriteLine(`   📄 ${totalOportunidadesFiles} archivo${totalOportunidadesFiles !== 1 ? 's' : ''} CSV generado${totalOportunidadesFiles !== 1 ? 's' : ''}`, { charDelay: 6 });
      if (totalOportunidadesFiles === 3) {
        await typewriteLine(`   ✅ Set completo (principal, <50%, <100%)`, { charDelay: 6 });
      }
    }
    await typewriteLine('');
  }

  // Detalle de batches si existen
  if (summary.has_batches && summary.batches_count > 0) {
    await showSeparator('─', 60);
    await typewriteLine(`📋 Detalle de batches:`, { charDelay: 6 });
    await typewriteLine('');

    for (const batch of summary.batches_status) {
      const icon = batch.status === 'completed' ? '✅' : '⏳';
      const progress = batch.progress || 0;
      await typewriteLine(`   ${icon} Batch ${batch.number}: ${batch.completed_categories}/${batch.total_categories} cats (${progress}%) - ~${batch.expected_products || 0} prods`, { charDelay: 4 });
    }
    await typewriteLine('');
  }

  await showSeparator('═', 60);
  await typewriteLine('Presiona ENTER para continuar...', { charDelay: 6 });
  await ask(rl, '');
}

/**
 * Función principal del módulo
 */
async function show(rl) {
  let continuar = true;

  while (continuar) {
    await showMenu();

    const option = await ask(rl, 'Selecciona una opción: ');

    switch (option) {
      case '1':
        await registrarVendedor(rl);
        break;

      case '2':
        await verVendedores(rl);
        break;

      case '3':
        await borrarVendedor(rl);
        break;

      case '4':
        await verDetalleVendedor(rl);
        break;

      case '0':
        continuar = false;
        break;

      default:
        await showError('Opción inválida');
        break;
    }

    if (continuar) {
      await typewriteLine('');
    }
  }
}

module.exports = { show };
