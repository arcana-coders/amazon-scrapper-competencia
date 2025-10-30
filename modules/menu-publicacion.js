/**
 * MÓDULO: PUBLICAR PRODUCTOS (FASE 7)
 * 
 * Gestiona la publicación de productos en Amazon Seller Central:
 * 1. Subir plantilla llenada
 * 2. Consultar estado de feed
 * 3. Ver productos publicados
 * 4. Ver errores de publicación
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
  getVendorDir
} = require('./utils/vendor-utils');

/**
 * Menú principal de publicación
 */
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await clearScreen();
    await showTitle('PUBLICAR PRODUCTOS (FASE 7)', { icon: '🚀' });
    await typewriteLine('');
    await showInfo('Publica productos en Amazon Seller Central');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await typewriteLine('  [1] 📤 Subir plantilla a Seller Central');
    await typewriteLine('  [2] 🔍 Consultar estado de feed');
    await typewriteLine('  [3] 📊 Ver resumen de publicaciones');
    await typewriteLine('  [0] ← Volver al menú principal');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    switch (opcion) {
      case '1':
        await subirPlantilla(rl);
        break;
      case '2':
        await consultarEstadoFeed(rl);
        break;
      case '3':
        await verResumenPublicaciones(rl);
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
 * Subir plantilla a Seller Central
 */
async function subirPlantilla(rl) {
  await clearScreen();
  await showTitle('SUBIR PLANTILLA A SELLER CENTRAL', { icon: '📤' });
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
  const vendorDir = getVendorDir(sellerId);
  const plantillasDir = path.join(vendorDir, 'plantillas');
  
  if (!fs.existsSync(plantillasDir)) {
    await typewriteLine('');
    await showError('No hay directorio de plantillas');
    await showInfo('Primero llena una plantilla en el menú [6] PLANTILLAS');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  // Buscar plantillas llenadas (listas para subir)
  const plantillasListas = fs.readdirSync(plantillasDir)
    .filter(f => f.includes('listo_para_subir') && f.endsWith('.xlsx') || f.includes('FINAL') && f.endsWith('.xlsx'))
    .map(f => ({
      nombre: f,
      fecha: fs.statSync(path.join(plantillasDir, f)).mtime,
      path: path.join(plantillasDir, f)
    }))
    .sort((a, b) => b.fecha - a.fecha);
  
  if (plantillasListas.length === 0) {
    await typewriteLine('');
    await showError('No hay plantillas listas para subir');
    await showInfo('Primero llena una plantilla en el menú [6] PLANTILLAS → [3] Llenar plantilla');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo('Plantillas listas para subir:');
  await typewriteLine('');
  
  for (let idx = 0; idx < plantillasListas.length; idx++) {
    const plantilla = plantillasListas[idx];
    const fecha = plantilla.fecha.toLocaleString('es-MX');
    await typewriteLine(`  [${idx + 1}] ${plantilla.nombre}`);
    await typewriteLine(`      Fecha: ${fecha}`);
  }
  
  await typewriteLine('');
  const plantillaSeleccion = await ask(rl, '👉 Selecciona una plantilla (número) o [0] para cancelar: ');
  
  if (plantillaSeleccion === '0') {
    return;
  }
  
  const plantillaIndex = parseInt(plantillaSeleccion) - 1;
  if (plantillaIndex < 0 || plantillaIndex >= plantillasListas.length) {
    await showError('Selección inválida');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const plantillaSeleccionada = plantillasListas[plantillaIndex];
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo(`Plantilla: ${plantillaSeleccionada.nombre}`);
  await typewriteLine('');
  await showWarning('⚠️  Este proceso:');
  await typewriteLine('   - Abrirá el navegador automáticamente');
  await typewriteLine('   - Subirá la plantilla a Seller Central');
  await typewriteLine('   - Puede tardar varios minutos');
  await typewriteLine('');
  
  const confirmar = await ask(rl, '¿Continuar con la subida? (s/n): ');
  
  if (confirmar.toLowerCase() !== 's') {
    return;
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning('Subiendo plantilla a Amazon Seller Central...');
  await showInfo('NO cierres el navegador hasta que termine el proceso');
  await typewriteLine('');
  
  await ejecutarScript(
    path.join(__dirname, '..', 'subir-plantilla-seller.js'),
    [sellerId]
  );
}

/**
 * Consultar estado de feed
 */
async function consultarEstadoFeed(rl) {
  await clearScreen();
  await showTitle('CONSULTAR ESTADO DE FEED', { icon: '🔍' });
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
  await showWarning('Consultando estado del feed en Seller Central...');
  await showInfo('Se abrirá el navegador automáticamente');
  await typewriteLine('');
  
  // Verificar si existe el script
  const scriptPath = path.join(__dirname, '..', 'scripts', 'consultar-estado-feed-seller.js');
  if (!fs.existsSync(scriptPath)) {
    await showWarning('⚠️  Script de consulta no encontrado');
    await showInfo('Esta funcionalidad está en desarrollo');
    await typewriteLine('');
    await showInfo('💡 Por ahora, consulta manualmente en:');
    await typewriteLine('   https://sellercentral.amazon.com.mx/product-search/bulk/status');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await ejecutarScript(scriptPath, [sellerId]);
}

/**
 * Ver resumen de publicaciones
 */
async function verResumenPublicaciones(rl) {
  await clearScreen();
  await showTitle('RESUMEN DE PUBLICACIONES', { icon: '📊' });
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
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  const files = fs.readdirSync(plantillasDir);
  
  // Plantillas subidas (registros)
  const registrosSubida = files.filter(f => 
    f.includes('subida-') && f.endsWith('.txt')
  );
  
  // Plantillas listas (sin subir)
  const plantillasListas = files.filter(f => 
    (f.includes('listo_para_subir') || f.includes('FINAL')) && f.endsWith('.xlsx')
  );
  
  await showInfo(`Resumen de publicaciones para ${sellerId}:`);
  await typewriteLine('');
  
  await typewriteLine(`  ✅ Plantillas subidas: ${registrosSubida.length}`);
  if (registrosSubida.length > 0) {
    const registrosParaMostrar = registrosSubida.slice(0, 5);
    for (let i = 0; i < registrosParaMostrar.length; i++) {
      const f = registrosParaMostrar[i];
      const stats = fs.statSync(path.join(plantillasDir, f));
      const fecha = stats.mtime.toLocaleString('es-MX');
      await typewriteLine(`     - ${f} (${fecha})`);
    }
    if (registrosSubida.length > 5) {
      await typewriteLine(`     ... y ${registrosSubida.length - 5} más`);
    }
  }
  
  await typewriteLine('');
  await typewriteLine(`  ⏳ Plantillas pendientes: ${plantillasListas.length}`);
  if (plantillasListas.length > 0) {
    const plantillasParaMostrar = plantillasListas.slice(0, 3);
    for (let i = 0; i < plantillasParaMostrar.length; i++) {
      await typewriteLine(`     - ${plantillasParaMostrar[i]}`);
    }
    if (plantillasListas.length > 3) {
      await typewriteLine(`     ... y ${plantillasListas.length - 3} más`);
    }
  }
  
  await typewriteLine('');
  
  if (registrosSubida.length > 0) {
    await showSuccess(`✅ Has subido ${registrosSubida.length} plantilla(s)`);
    await showInfo('Consulta el estado en Seller Central para ver productos publicados');
  } else {
    await showWarning('⚠️  No has subido ninguna plantilla aún');
    await showInfo('Usa la opción [1] para subir una plantilla');
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

module.exports = { show };
