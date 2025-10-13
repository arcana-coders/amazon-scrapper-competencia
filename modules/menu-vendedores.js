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
  
  const sellerId = await ask('ID del vendedor (Seller ID): ', rl);
  
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
        const otro = await ask('¿Registrar otro vendedor? (s/n): ', rl);
        
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
  
  for (let i = 0; i < vendorIds.length; i++) {
    const sellerId = vendorIds[i];
    const info = getVendorInfo(sellerId);
    const summary = getVendorSummary(sellerId);
    
    await typewriteLine(`[${i + 1}] ${sellerId}`, { charDelay: 6 });
    
    if (info.store_name) {
      await typewriteLine(`    Tienda: ${info.store_name}`, { charDelay: 6 });
    }
    
    if (summary.exists) {
      await typewriteLine(`    Productos: ${summary.products_count}`, { charDelay: 6 });
      
      if (summary.has_batches) {
        await typewriteLine(`    Batches: ${summary.batches_count}`, { charDelay: 6 });
      }
    }
    
    if (info.phase) {
      await typewriteLine(`    Fase: ${info.phase}`, { charDelay: 6 });
    }
    
    await typewriteLine('');
  }
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
  const choice = await ask('¿Qué vendedor borrar? (0 para cancelar): ', rl);
  
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
  
  const confirm = await ask('Confirmar (escribe "SI" para borrar): ', rl);
  
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
    const otro = await ask('¿Borrar otro vendedor? (s/n): ', rl);
    
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
  const choice = await ask('Número de vendedor (0 para cancelar): ', rl);
  
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= vendorIds.length) {
    await showWarning('Operación cancelada');
    return;
  }
  
  const sellerId = vendorIds[index];
  const info = getVendorInfo(sellerId);
  const summary = getVendorSummary(sellerId);
  
  await typewriteLine('');
  await showSeparator('═', 50);
  await typewriteLine(`📊 DETALLE: ${info.store_name || sellerId}`, { charDelay: 10 });
  await showSeparator('═', 50);
  await typewriteLine('');
  
  await typewriteLine(`🆔 Seller ID: ${sellerId}`, { charDelay: 8 });
  
  if (info.store_name) {
    await typewriteLine(`🏪 Tienda: ${info.store_name}`, { charDelay: 8 });
  }
  
  if (info.registered_date) {
    const date = new Date(info.registered_date).toLocaleDateString();
    await typewriteLine(`📅 Registrado: ${date}`, { charDelay: 8 });
  }
  
  if (info.phase) {
    await typewriteLine(`📍 Fase actual: ${info.phase}`, { charDelay: 8 });
  }
  
  await typewriteLine('');
  await typewriteLine('📦 Archivos:', { charDelay: 8 });
  await typewriteLine(`   Total: ${summary.files.total}`, { charDelay: 8 });
  await typewriteLine(`   Productos: ${summary.files.products}`, { charDelay: 8 });
  await typewriteLine(`   Análisis: ${summary.files.intelligent}`, { charDelay: 8 });
  await typewriteLine(`   Batches: ${summary.files.batches}`, { charDelay: 8 });
  
  await typewriteLine('');
  await typewriteLine(`📊 Productos encontrados: ${summary.products_count}`, { charDelay: 8 });
  
  if (summary.has_batches) {
    await typewriteLine('');
    await typewriteLine(`📋 Batches (${summary.batches_count}):`, { charDelay: 8 });
    
    summary.batches_status.forEach(async (batch) => {
      const icon = batch.status === 'completed' ? '✅' : '⏳';
      await typewriteLine(`   ${icon} Batch ${batch.number}: ${batch.completed_categories}/${batch.total_categories} categorías (${batch.progress}%)`, { charDelay: 6 });
    });
  }
  
  await typewriteLine('');
}

/**
 * Función principal del módulo
 */
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await showMenu();
    
    const option = await ask('Selecciona una opción: ', rl);
    
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
