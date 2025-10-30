#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════
 * 🎯 PANEL MAESTRO V2 - SISTEMA AMAZON
 * ═══════════════════════════════════════════════════════════════
 * 
 * Sistema modular para gestión completa de vendedores Amazon:
 * - Scraping de productos
 * - Verificación en Amazon USA
 * - Generación de oportunidades de negocio
 * - Gestión de plantillas Seller Central
 * - Publicación de productos
 * 
 * Arquitectura modular con menús independientes
 */

const readline = require('readline');
const path = require('path');

// Importar utilidades
const {
  typewriteLine,
  showTitle,
  showSeparator,
  showError,
  showSuccess,
  showInfo,
  clearScreen,
  ask
} = require('./modules/utils/display-utils');

const {
  loadProjects,
  countVendorsByPhase
} = require('./modules/utils/projects-utils');

// Importar módulos de menús
const menuVendedores = require('./modules/menu-vendedores');
const menuPlanes = require('./modules/menu-planes');
const menuScraping = require('./modules/menu-scraping');
const menuVerificacionMX = require('./modules/menu-verificacion-mx');
const menuVerificacionUSA = require('./modules/menu-verificacion-usa');
const menuOportunidades = require('./modules/menu-oportunidades');
const menuPlantillas = require('./modules/menu-plantillas');
const menuPublicacion = require('./modules/menu-publicacion');
const menuReportes = require('./modules/menu-reportes');

/**
 * Mostrar banner inicial
 */
async function showBanner() {
  clearScreen();
  await showSeparator('═', 60);
  await typewriteLine('           🤖  PANEL MAESTRO V2 - SISTEMA AMAZON', { charDelay: 3 });
  await showSeparator('═', 60);
  await typewriteLine('');
  await typewriteLine('  Sistema modular para gestión completa del flujo Amazon:', { charDelay: 2 });
  await typewriteLine('  Desde el scraping hasta la publicación en Seller Central', { charDelay: 2 });
  await typewriteLine('');
  await showSeparator('═', 60);
  await typewriteLine('');
}

/**
 * Mostrar resumen rápido del sistema
 */
async function showQuickSummary() {
  const counts = countVendorsByPhase();
  
  await typewriteLine(`📊 Resumen rápido:`, { charDelay: 2 });
  await typewriteLine(`   Total vendedores: ${counts.total}`, { charDelay: 2 });
  
  if (counts.total > 0) {
    await typewriteLine(`   • Registrados: ${counts.registered || 0}`, { charDelay: 2 });
    await typewriteLine(`   • Con plan: ${counts.planned || 0}`, { charDelay: 2 });
    await typewriteLine(`   • En scraping: ${counts.scraping || 0}`, { charDelay: 2 });
    await typewriteLine(`   • Scrapeados: ${counts.scraped || 0}`, { charDelay: 2 });
  }
  
  await typewriteLine('');
}

/**
 * Mostrar menú principal
 */
async function showMainMenu() {
  await showSeparator('─', 60);
  await typewriteLine('¿Qué deseas hacer?', { charDelay: 2 });
  await typewriteLine('');
  await typewriteLine('[1] 📋 Gestión de Vendedores', { charDelay: 2 });
  await typewriteLine('[2] 🎯 Generar Plan de Scraping', { charDelay: 2 });
  await typewriteLine('[3] 🔄 Ejecutar Scraping (Fase 1)', { charDelay: 2 });
  await typewriteLine('[4] 🇲🇽 Verificar en Amazon MX (Fase 2)', { charDelay: 2 });
  await typewriteLine('[5] 🇺🇸 Verificar en Amazon USA (Fase 3)', { charDelay: 2 });
  await typewriteLine('[6] 💰 Generar Oportunidades (Fase 4)', { charDelay: 2 });
  await typewriteLine('[7] 📄 Gestión de Plantillas (Fase 5a)', { charDelay: 2 });
  await typewriteLine('[8] 🚀 Publicar Productos (Fase 5b)', { charDelay: 2 });
  await typewriteLine('[9] 📊 Reportes y Estado', { charDelay: 2 });
  await typewriteLine('[0] Salir', { charDelay: 2 });
  await typewriteLine('');
}

/**
 * Manejar selección del menú principal
 */
async function handleMainMenu(rl) {
  const option = await ask(rl, 'Selecciona una opción: ');
  
  switch (option) {
    case '1':
      await menuVendedores.show(rl);
      break;
      
    case '2':
      await menuPlanes.show(rl);
      break;
      
    case '3':
      await menuScraping.show(rl);
      break;
      
    case '4':
      await menuVerificacionMX.show(rl);
      break;
      
    case '5':
      await menuVerificacionUSA.show(rl);
      break;
      
    case '6':
      await menuOportunidades.show(rl);
      break;
      
    case '7':
      await menuPlantillas.show(rl);
      break;
      
    case '8':
      await menuPublicacion.show(rl);
      break;
      
    case '9':
      await menuReportes.show(rl);
      break;
      
    case '0':
      return false; // Salir
      
    default:
      await showError('Opción inválida. Intenta de nuevo.');
      break;
  }
  
  return true; // Continuar
}

/**
 * Loop principal
 */
async function mainLoop() {
  await showBanner();
  await showQuickSummary();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  let continuar = true;
  
  while (continuar) {
    await showMainMenu();
    continuar = await handleMainMenu(rl);
    
    if (continuar) {
      await typewriteLine('');
    }
  }
  
  await typewriteLine('');
  await showSuccess('¡Hasta luego! 👋');
  await typewriteLine('');
  
  rl.close();
  process.exit(0);
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('\n❌ Error fatal:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Promise rechazada:', reason);
  process.exit(1);
});

// Iniciar
if (require.main === module) {
  mainLoop().catch(error => {
    console.error('❌ Error en mainLoop:', error.message);
    process.exit(1);
  });
}

module.exports = { mainLoop };
