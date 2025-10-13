#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Script para gestionar categorías en sistema de batches
 * Permite:
 * - Ver categorías completadas
 * - Identificar categoría problemática
 * - Saltar categorías
 * - Reescanear vendedor
 */

if (process.argv.length < 3) {
  console.log('❌ Uso: node manage-batch-categories.js SELLER_ID');
  console.log('📋 Ejemplo: node manage-batch-categories.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const ROOT_DIR = __dirname;
const VENDOR_DIR = path.join(ROOT_DIR, 'data', 'vendors', SELLER_ID);
const PROJECTS_FILE = path.join(ROOT_DIR, 'data', 'projects.json');
const PROGRESS_FILE = path.join(VENDOR_DIR, 'progress.json');
const SKIP_CATEGORIES_FILE = path.join(VENDOR_DIR, 'skip-categories.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Cargar projects.json
 */
function loadProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: {} };
  }
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
}

/**
 * Cargar progress.json
 */
function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
}

/**
 * Cargar categorías a saltar
 */
function loadSkipCategories() {
  if (!fs.existsSync(SKIP_CATEGORIES_FILE)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(SKIP_CATEGORIES_FILE, 'utf8'));
}

/**
 * Guardar categorías a saltar
 */
function saveSkipCategories(categories) {
  fs.writeFileSync(SKIP_CATEGORIES_FILE, JSON.stringify(categories, null, 2));
}

/**
 * Encontrar archivos batch
 */
function findBatchFiles() {
  if (!fs.existsSync(VENDOR_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(VENDOR_DIR);
  return files
    .filter(f => f.includes('plan-batch-') && f.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/batch-(\d+)/)[1]);
      const numB = parseInt(b.match(/batch-(\d+)/)[1]);
      return numA - numB;
    })
    .map(f => path.join(VENDOR_DIR, f));
}

/**
 * Obtener todas las categorías principales del vendedor
 */
function getMainCategories() {
  const projectsData = loadProjects();
  const project = projectsData.projects?.[SELLER_ID];
  
  if (!project || !project.main_categories) {
    return [];
  }
  
  return project.main_categories;
}

/**
 * Obtener categorías procesadas desde batches
 */
function getProcessedCategoriesFromBatches() {
  const batchFiles = findBatchFiles();
  const processed = new Set();
  
  for (const batchFile of batchFiles) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    if (batch.categories) {
      batch.categories.forEach(cat => {
        if (cat.name) processed.add(cat.name);
      });
    }
  }
  
  return Array.from(processed);
}

/**
 * Mostrar estado actual
 */
async function showStatus() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  📊 GESTIÓN DE CATEGORÍAS - SISTEMA INCREMENTAL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📦 Vendedor: ${SELLER_ID}`);
  console.log('');
  
  // Obtener información
  const mainCategories = getMainCategories();
  const processedFromBatches = getProcessedCategoriesFromBatches();
  const progress = loadProgress();
  const skipCategories = loadSkipCategories();
  const batchFiles = findBatchFiles();
  
  console.log(`📋 Total categorías principales: ${mainCategories.length}`);
  console.log(`📦 Batches creados: ${batchFiles.length}`);
  console.log(`✅ Categorías en batches: ${processedFromBatches.length}`);
  console.log('');
  
  if (progress) {
    console.log('📊 PROGRESO DE SCRAPING:');
    console.log(`   ✅ Completadas: ${progress.completed_categories.length}`);
    console.log(`   ❌ Fallidas: ${progress.failed_categories.length}`);
    console.log(`   📦 Total productos: ${progress.total_products_found}`);
    console.log('');
    
    if (progress.completed_categories.length > 0) {
      console.log('✅ Categorías completadas:');
      progress.completed_categories.slice(-5).forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat.name}`);
      });
      if (progress.completed_categories.length > 5) {
        console.log(`   ... y ${progress.completed_categories.length - 5} más`);
      }
      console.log('');
    }
    
    if (progress.failed_categories.length > 0) {
      console.log('❌ Categorías con errores:');
      progress.failed_categories.forEach((cat, i) => {
        console.log(`   ${i + 1}. ${cat.name} - ${cat.error}`);
      });
      console.log('');
    }
  }
  
  if (skipCategories.length > 0) {
    console.log('⏭️  CATEGORÍAS MARCADAS PARA SALTAR:');
    skipCategories.forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat.name} - ${cat.reason}`);
    });
    console.log('');
  }
  
  // Categorías pendientes
  const processedNames = new Set(
    progress ? progress.completed_categories.map(c => c.name) : []
  );
  const skippedNames = new Set(skipCategories.map(c => c.name));
  
  const pending = mainCategories.filter(cat => 
    !processedNames.has(cat) && 
    !skippedNames.has(cat) &&
    !processedFromBatches.includes(cat)
  );
  
  if (pending.length > 0) {
    console.log(`⏳ Categorías pendientes (no en batches): ${pending.length}`);
    pending.slice(0, 5).forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat}`);
    });
    if (pending.length > 5) {
      console.log(`   ... y ${pending.length - 5} más`);
    }
    console.log('');
  }
}

/**
 * Menú principal
 */
async function mainMenu() {
  await showStatus();
  
  console.log('¿Qué deseas hacer?');
  console.log('[1] Marcar una categoría para saltar');
  console.log('[2] Ver categorías marcadas para saltar');
  console.log('[3] Quitar marca de una categoría');
  console.log('[4] Limpiar todas las marcas');
  console.log('[5] Ver categorías completadas');
  console.log('[6] Ver categorías fallidas');
  console.log('[7] Reiniciar progress.json (borrar progreso)');
  console.log('[0] Salir');
  console.log('');
  
  const choice = await ask('Opción: ');
  
  switch (choice) {
    case '1':
      await markCategoryToSkip();
      break;
    case '2':
      await viewSkippedCategories();
      break;
    case '3':
      await unmarkCategory();
      break;
    case '4':
      await clearAllMarks();
      break;
    case '5':
      await viewCompletedCategories();
      break;
    case '6':
      await viewFailedCategories();
      break;
    case '7':
      await resetProgress();
      break;
    case '0':
      console.log('');
      console.log('👋 ¡Hasta luego!');
      console.log('');
      rl.close();
      process.exit(0);
      break;
    default:
      console.log('❌ Opción no válida');
  }
  
  await mainMenu(); // Volver al menú
}

/**
 * Marcar categoría para saltar
 */
async function markCategoryToSkip() {
  console.log('');
  console.log('⏭️  MARCAR CATEGORÍA PARA SALTAR');
  console.log('─────────────────────────────────');
  console.log('');
  
  const mainCategories = getMainCategories();
  const skipCategories = loadSkipCategories();
  const skippedNames = new Set(skipCategories.map(c => c.name));
  
  const available = mainCategories.filter(cat => !skippedNames.has(cat));
  
  if (available.length === 0) {
    console.log('⚠️  No hay categorías disponibles para marcar');
    console.log('');
    await ask('Presiona Enter para continuar...');
    return;
  }
  
  console.log('Categorías disponibles:');
  available.forEach((cat, i) => {
    console.log(`[${i + 1}] ${cat}`);
  });
  console.log('[0] Cancelar');
  console.log('');
  
  const choice = await ask('Número de categoría: ');
  const index = parseInt(choice) - 1;
  
  if (index === -1) {
    console.log('Operación cancelada');
    return;
  }
  
  if (index < 0 || index >= available.length) {
    console.log('❌ Opción no válida');
    return;
  }
  
  const categoryName = available[index];
  const reason = await ask('Razón (loop/error/otro): ');
  
  skipCategories.push({
    name: categoryName,
    reason: reason || 'Sin especificar',
    marked_at: new Date().toISOString()
  });
  
  saveSkipCategories(skipCategories);
  
  console.log('');
  console.log(`✅ Categoría "${categoryName}" marcada para saltar`);
  console.log('');
  await ask('Presiona Enter para continuar...');
}

/**
 * Ver categorías marcadas
 */
async function viewSkippedCategories() {
  console.log('');
  console.log('⏭️  CATEGORÍAS MARCADAS PARA SALTAR');
  console.log('──────────────────────────────────');
  console.log('');
  
  const skipCategories = loadSkipCategories();
  
  if (skipCategories.length === 0) {
    console.log('✅ No hay categorías marcadas para saltar');
  } else {
    skipCategories.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name}`);
      console.log(`   Razón: ${cat.reason}`);
      console.log(`   Marcada: ${new Date(cat.marked_at).toLocaleString()}`);
      console.log('');
    });
  }
  
  await ask('Presiona Enter para continuar...');
}

/**
 * Quitar marca de categoría
 */
async function unmarkCategory() {
  console.log('');
  console.log('✅ QUITAR MARCA DE CATEGORÍA');
  console.log('────────────────────────────');
  console.log('');
  
  const skipCategories = loadSkipCategories();
  
  if (skipCategories.length === 0) {
    console.log('⚠️  No hay categorías marcadas');
    console.log('');
    await ask('Presiona Enter para continuar...');
    return;
  }
  
  skipCategories.forEach((cat, i) => {
    console.log(`[${i + 1}] ${cat.name} - ${cat.reason}`);
  });
  console.log('[0] Cancelar');
  console.log('');
  
  const choice = await ask('Número de categoría: ');
  const index = parseInt(choice) - 1;
  
  if (index === -1) {
    console.log('Operación cancelada');
    return;
  }
  
  if (index < 0 || index >= skipCategories.length) {
    console.log('❌ Opción no válida');
    return;
  }
  
  const removed = skipCategories.splice(index, 1)[0];
  saveSkipCategories(skipCategories);
  
  console.log('');
  console.log(`✅ Marca removida de "${removed.name}"`);
  console.log('');
  await ask('Presiona Enter para continuar...');
}

/**
 * Limpiar todas las marcas
 */
async function clearAllMarks() {
  console.log('');
  console.log('🗑️  LIMPIAR TODAS LAS MARCAS');
  console.log('───────────────────────────');
  console.log('');
  
  const skipCategories = loadSkipCategories();
  
  if (skipCategories.length === 0) {
    console.log('⚠️  No hay categorías marcadas');
    console.log('');
    await ask('Presiona Enter para continuar...');
    return;
  }
  
  console.log(`⚠️  Esto eliminará ${skipCategories.length} marca(s)`);
  const confirm = await ask('¿Estás seguro? (s/n): ');
  
  if (confirm.toLowerCase() === 's' || confirm.toLowerCase() === 'si') {
    saveSkipCategories([]);
    console.log('');
    console.log('✅ Todas las marcas han sido eliminadas');
  } else {
    console.log('');
    console.log('❌ Operación cancelada');
  }
  
  console.log('');
  await ask('Presiona Enter para continuar...');
}

/**
 * Ver categorías completadas
 */
async function viewCompletedCategories() {
  console.log('');
  console.log('✅ CATEGORÍAS COMPLETADAS');
  console.log('─────────────────────────');
  console.log('');
  
  const progress = loadProgress();
  
  if (!progress || progress.completed_categories.length === 0) {
    console.log('⚠️  No hay categorías completadas aún');
  } else {
    progress.completed_categories.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name}`);
      console.log(`   Productos: ${cat.products_found || 'N/A'}`);
      console.log(`   Completada: ${new Date(cat.completed_at).toLocaleString()}`);
      console.log('');
    });
  }
  
  await ask('Presiona Enter para continuar...');
}

/**
 * Ver categorías fallidas
 */
async function viewFailedCategories() {
  console.log('');
  console.log('❌ CATEGORÍAS CON ERRORES');
  console.log('─────────────────────────');
  console.log('');
  
  const progress = loadProgress();
  
  if (!progress || progress.failed_categories.length === 0) {
    console.log('✅ No hay categorías con errores');
  } else {
    progress.failed_categories.forEach((cat, i) => {
      console.log(`${i + 1}. ${cat.name}`);
      console.log(`   Error: ${cat.error}`);
      console.log(`   Falló: ${new Date(cat.failed_at).toLocaleString()}`);
      console.log('');
    });
  }
  
  await ask('Presiona Enter para continuar...');
}

/**
 * Reiniciar progress.json
 */
async function resetProgress() {
  console.log('');
  console.log('🔄 REINICIAR PROGRESO');
  console.log('────────────────────');
  console.log('');
  
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.log('⚠️  No existe archivo de progreso');
    console.log('');
    await ask('Presiona Enter para continuar...');
    return;
  }
  
  console.log('⚠️  ADVERTENCIA: Esto borrará todo el progreso de scraping');
  console.log('   Los archivos de batch NO se eliminarán');
  console.log('');
  const confirm = await ask('¿Estás seguro? (s/n): ');
  
  if (confirm.toLowerCase() === 's' || confirm.toLowerCase() === 'si') {
    fs.unlinkSync(PROGRESS_FILE);
    console.log('');
    console.log('✅ Progress.json eliminado');
  } else {
    console.log('');
    console.log('❌ Operación cancelada');
  }
  
  console.log('');
  await ask('Presiona Enter para continuar...');
}

// Ejecutar
mainMenu().catch(error => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
