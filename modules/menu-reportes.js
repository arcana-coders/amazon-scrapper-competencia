/**
 * MÓDULO: REPORTES Y ESTADÍSTICAS (FASE 8)
 * 
 * Muestra reportes y estadísticas del sistema:
 * 1. Resumen general
 * 2. Reporte por vendedor
 * 3. Reporte de oportunidades
 * 4. Exportar reporte
 */

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
const { 
  listVendorIds, 
  getVendorInfo, 
  countVendorsByPhase 
} = require('./utils/projects-utils');
const { 
  getVendorDir,
  getVerificationStatus,
  countOpportunities,
  getBatchConsolidatedFiles,
  getAllOpportunitiesFiles
} = require('./utils/vendor-utils');

/**
 * Menú principal de reportes
 */
async function show(rl) {
  let continuar = true;
  
  while (continuar) {
    await clearScreen();
    await showTitle('REPORTES Y ESTADÍSTICAS (FASE 8)', { icon: '📊' });
    await typewriteLine('');
    await showInfo('Visualiza estadísticas y genera reportes del sistema');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    await typewriteLine('  [1] 📈 Resumen general del sistema');
    await typewriteLine('  [2] 📦 Reporte detallado por vendedor');
    await typewriteLine('  [3] 💰 Reporte de oportunidades');
    await typewriteLine('  [4] 📄 Exportar reporte a CSV');
    await typewriteLine('  [0] ← Volver al menú principal');
    await typewriteLine('');
    await showSeparator();
    await typewriteLine('');
    
    const opcion = await ask(rl, '👉 Elige una opción: ');
    
    switch (opcion) {
      case '1':
        await resumenGeneral(rl);
        break;
      case '2':
        await reportePorVendedor(rl);
        break;
      case '3':
        await reporteOportunidades(rl);
        break;
      case '4':
        await exportarReporte(rl);
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
 * Resumen general del sistema
 */
async function resumenGeneral(rl) {
  await clearScreen();
  await showTitle('RESUMEN GENERAL DEL SISTEMA', { icon: '📈' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados en el sistema');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showWarning('Analizando datos del sistema...');
  await typewriteLine('');
  
  let totalProductos = 0;
  let totalVerificados = 0;
  let totalOportunidades = 0;
  let vendedoresConBatches = 0;
  let totalBatches = 0;
  
  for (const sellerId of vendors) {
    const batches = getBatchConsolidatedFiles(sellerId);
    const vendorInfo = getVendorInfo(sellerId);
    const isLarge = vendorInfo?.is_large_vendor || false;
    
    if (isLarge && batches.length > 0) {
      vendedoresConBatches++;
      totalBatches += batches.length;
      
      // Contar productos y verificaciones por batch
      for (const batch of batches) {
        const status = getVerificationStatus(sellerId, batch.number);
        if (status) {
          totalProductos += status.total;
          totalVerificados += status.verified;
        }
        
        try {
          const counts = await countOpportunities(sellerId, batch.number);
          if (counts) {
            totalOportunidades += counts.total;
          }
        } catch (err) {
          // Ignorar errores
        }
      }
    } else {
      // Vendedor pequeño
      const status = getVerificationStatus(sellerId, null);
      if (status) {
        totalProductos += status.total;
        totalVerificados += status.verified;
      }
      
      try {
        const counts = await countOpportunities(sellerId, null);
        if (counts) {
          totalOportunidades += counts.total;
        }
      } catch (err) {
        // Ignorar errores
      }
    }
  }
  
  const vendedoresPequenos = vendors.length - vendedoresConBatches;
  const porcentajeVerificado = totalProductos > 0 
    ? Math.round((totalVerificados / totalProductos) * 100) 
    : 0;
  
  await showSeparator();
  await typewriteLine('');
  await showSuccess('📊 RESUMEN GENERAL');
  await typewriteLine('');
  await typewriteLine(`  👥 Vendedores registrados: ${vendors.length}`);
  await typewriteLine(`     - Vendedores pequeños: ${vendedoresPequenos}`);
  await typewriteLine(`     - Vendedores con batches: ${vendedoresConBatches}`);
  await typewriteLine(`     - Total de batches: ${totalBatches}`);
  await typewriteLine('');
  await typewriteLine(`  📦 Productos totales: ${totalProductos.toLocaleString()}`);
  await typewriteLine(`     - Verificados en USA: ${totalVerificados.toLocaleString()} (${porcentajeVerificado}%)`);
  await typewriteLine(`     - Pendientes: ${(totalProductos - totalVerificados).toLocaleString()}`);
  await typewriteLine('');
  await typewriteLine(`  💰 Oportunidades encontradas: ${totalOportunidades.toLocaleString()}`);
  
  if (totalProductos > 0) {
    const tasaOportunidad = Math.round((totalOportunidades / totalProductos) * 100);
    await typewriteLine(`     - Tasa de oportunidad: ${tasaOportunidad}%`);
  }
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  
  if (totalOportunidades > 0) {
    await showSuccess(`✅ Sistema operativo: ${totalOportunidades.toLocaleString()} productos listos para publicar`);
  } else if (totalVerificados > 0) {
    await showWarning('⚠️  Productos verificados pero sin oportunidades generadas');
    await showInfo('Genera oportunidades en el menú [5] GENERAR OPORTUNIDADES');
  } else if (totalProductos > 0) {
    await showWarning('⚠️  Productos scrapeados pero sin verificar');
    await showInfo('Verifica productos en el menú [4] VERIFICAR EN USA');
  } else {
    await showWarning('⚠️  Sistema sin productos scrapeados');
    await showInfo('Registra vendedores y scrapea productos en el menú [3] SCRAPING');
  }
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Reporte detallado por vendedor
 */
async function reportePorVendedor(rl) {
  await clearScreen();
  await showTitle('REPORTE POR VENDEDOR', { icon: '📦' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showInfo('Selecciona un vendedor:');
  await typewriteLine('');
  vendors.forEach((vendor, idx) => {
    typewriteLine(`  [${idx + 1}] ${vendor}`);
  });
  
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
  const vendorInfo = getVendorInfo(sellerId);
  const vendorDir = getVendorDir(sellerId);
  
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showWarning(`Generando reporte de ${sellerId}...`);
  await typewriteLine('');
  
  // Información básica
  await showInfo('📋 INFORMACIÓN GENERAL');
  await typewriteLine('');
  await typewriteLine(`  Seller ID: ${sellerId}`);
  await typewriteLine(`  Fase actual: ${vendorInfo?.current_phase || 'Desconocida'}`);
  await typewriteLine(`  Estado: ${vendorInfo?.status || 'unknown'}`);
  await typewriteLine(`  Tipo: ${vendorInfo?.is_large_vendor ? 'Vendedor grande (con batches)' : 'Vendedor pequeño'}`);
  await typewriteLine('');
  
  // Análisis de batches o producto único
  const batches = getBatchConsolidatedFiles(sellerId);
  const isLarge = vendorInfo?.is_large_vendor || false;
  
  if (isLarge && batches.length > 0) {
    await showInfo('📦 ANÁLISIS POR BATCHES');
    await typewriteLine('');
    await typewriteLine(`  Total de batches: ${batches.length}`);
    await typewriteLine('');
    
    let totalProductos = 0;
    let totalVerificados = 0;
    let totalOportunidades = 0;
    
    for (const batch of batches) {
      const status = getVerificationStatus(sellerId, batch.number);
      
      if (status) {
        totalProductos += status.total;
        totalVerificados += status.verified;
        
        await typewriteLine(`  Batch ${batch.number}:`);
        await typewriteLine(`     Productos: ${status.total}`);
        await typewriteLine(`     Verificados: ${status.verified} (${status.percentage}%)`);
        await typewriteLine(`     Pendientes: ${status.pending}`);
        
        try {
          const counts = await countOpportunities(sellerId, batch.number);
          if (counts && counts.total > 0) {
            await typewriteLine(`     Oportunidades: ${counts.total}`);
            totalOportunidades += counts.total;
          }
        } catch (err) {
          // Ignorar errores
        }
        
        await typewriteLine('');
      }
    }
    
    await showSeparator();
    await typewriteLine('');
    await showSuccess('📊 TOTALES');
    await typewriteLine('');
    await typewriteLine(`  Total productos: ${totalProductos.toLocaleString()}`);
    await typewriteLine(`  Total verificados: ${totalVerificados.toLocaleString()}`);
    await typewriteLine(`  Total oportunidades: ${totalOportunidades.toLocaleString()}`);
  } else {
    // Vendedor pequeño
    await showInfo('📊 ANÁLISIS DE PRODUCTOS');
    await typewriteLine('');
    
    const status = getVerificationStatus(sellerId, null);
    
    if (status) {
      await typewriteLine(`  Total productos: ${status.total}`);
      await typewriteLine(`  Verificados: ${status.verified} (${status.percentage}%)`);
      await typewriteLine(`  Pendientes: ${status.pending}`);
      await typewriteLine(`  Con precio USD: ${status.withPrice}`);
      await typewriteLine(`  Disponibles: ${status.disponible}`);
      await typewriteLine(`  No disponibles: ${status.noDisponible}`);
      await typewriteLine(`  No listados: ${status.noListado}`);
      await typewriteLine('');
      
      try {
        const counts = await countOpportunities(sellerId, null);
        if (counts) {
          await showInfo('💰 OPORTUNIDADES');
          await typewriteLine('');
          await typewriteLine(`  Principal: ${counts.principal}`);
          await typewriteLine(`  Menos $50: ${counts.menos50}`);
          await typewriteLine(`  Menos $100: ${counts.menos100}`);
          await typewriteLine(`  Total: ${counts.total}`);
        }
      } catch (err) {
        await showWarning('  No se encontraron oportunidades generadas');
      }
    } else {
      await showWarning('  No hay datos de productos disponibles');
    }
  }
  
  // Estado de plantillas
  await typewriteLine('');
  await showSeparator();
  await typewriteLine('');
  await showInfo('📄 PLANTILLAS');
  await typewriteLine('');
  
  const plantillasDir = path.join(vendorDir, 'plantillas');
  
  if (fs.existsSync(plantillasDir)) {
    const files = fs.readdirSync(plantillasDir);
    const plantillasLlenadas = files.filter(f => (f.includes('FINAL') || f.includes('listo_para_subir')) && f.endsWith('.xlsx')).length;
    const plantillasSubidas = files.filter(f => f.includes('subida-') && f.endsWith('.txt')).length;
    
    await typewriteLine(`  Plantillas llenadas: ${plantillasLlenadas}`);
    await typewriteLine(`  Plantillas subidas: ${plantillasSubidas}`);
  } else {
    await typewriteLine('  Sin plantillas generadas');
  }
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Reporte de oportunidades
 */
async function reporteOportunidades(rl) {
  await clearScreen();
  await showTitle('REPORTE DE OPORTUNIDADES', { icon: '💰' });
  await typewriteLine('');
  
  const vendors = listVendorIds();
  
  if (vendors.length === 0) {
    await showError('No hay vendedores registrados');
    await ask(rl, '\nPresiona ENTER para continuar...');
    return;
  }
  
  await showWarning('Analizando oportunidades de todos los vendedores...');
  await typewriteLine('');
  
  const reporteVendedores = [];
  
  for (const sellerId of vendors) {
    const batches = getBatchConsolidatedFiles(sellerId);
    const vendorInfo = getVendorInfo(sellerId);
    const isLarge = vendorInfo?.is_large_vendor || false;
    
    let totalOportunidades = 0;
    let detalles = [];
    
    if (isLarge && batches.length > 0) {
      for (const batch of batches) {
        try {
          const counts = await countOpportunities(sellerId, batch.number);
          if (counts && counts.total > 0) {
            totalOportunidades += counts.total;
            detalles.push({
              tipo: `Batch ${batch.number}`,
              principal: counts.principal,
              menos50: counts.menos50,
              menos100: counts.menos100,
              total: counts.total
            });
          }
        } catch (err) {
          // Ignorar errores
        }
      }
    } else {
      try {
        const counts = await countOpportunities(sellerId, null);
        if (counts && counts.total > 0) {
          totalOportunidades = counts.total;
          detalles.push({
            tipo: 'Vendedor completo',
            principal: counts.principal,
            menos50: counts.menos50,
            menos100: counts.menos100,
            total: counts.total
          });
        }
      } catch (err) {
        // Ignorar errores
      }
    }
    
    if (totalOportunidades > 0) {
      reporteVendedores.push({
        sellerId,
        totalOportunidades,
        detalles
      });
    }
  }
  
  // Ordenar por total de oportunidades
  reporteVendedores.sort((a, b) => b.totalOportunidades - a.totalOportunidades);
  
  await showSeparator();
  await typewriteLine('');
  
  if (reporteVendedores.length === 0) {
    await showWarning('No se encontraron oportunidades generadas');
    await typewriteLine('');
    await showInfo('Genera oportunidades en el menú [5] GENERAR OPORTUNIDADES');
  } else {
    await showSuccess(`💰 OPORTUNIDADES ENCONTRADAS: ${reporteVendedores.reduce((sum, v) => sum + v.totalOportunidades, 0).toLocaleString()}`);
    await typewriteLine('');
    
    for (const reporte of reporteVendedores) {
      await typewriteLine(`  📦 ${reporte.sellerId} (${reporte.totalOportunidades.toLocaleString()} oportunidades)`);
      
      for (const detalle of reporte.detalles) {
        await typewriteLine(`     ${detalle.tipo}:`);
        await typewriteLine(`        Principal: ${detalle.principal}`);
        await typewriteLine(`        Menos $50: ${detalle.menos50}`);
        await typewriteLine(`        Menos $100: ${detalle.menos100}`);
      }
      
      await typewriteLine('');
    }
  }
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

/**
 * Exportar reporte a CSV
 */
async function exportarReporte(rl) {
  await clearScreen();
  await showTitle('EXPORTAR REPORTE', { icon: '📄' });
  await typewriteLine('');
  
  await showWarning('⚠️  Esta funcionalidad está en desarrollo');
  await typewriteLine('');
  await showInfo('Por ahora, usa los reportes en pantalla');
  await showInfo('Próximamente podrás exportar reportes en formato CSV');
  
  await typewriteLine('');
  await ask(rl, 'Presiona ENTER para continuar...');
}

module.exports = { show };
