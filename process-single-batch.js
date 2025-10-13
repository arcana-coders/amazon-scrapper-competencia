const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Validar argumentos
if (process.argv.length < 4) {
  console.log('❌ Uso: node process-single-batch.js SELLER_ID BATCH_NUMBER');
  console.log('📋 Ejemplo: node process-single-batch.js A3Q5ASRA7J8Y5E 1');
  console.log('📋 Ejemplo: node process-single-batch.js A3Q5ASRA7J8Y5E all  (para procesar todos)');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const BATCH_ARG = process.argv[3];

// Configuración
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');
const PROGRESS_FILE = path.join(VENDOR_DIR, 'progress.json');

// Validar que existe la carpeta del vendedor
if (!fs.existsSync(VENDOR_DIR)) {
  console.error(`❌ No existe carpeta para vendedor ${SELLER_ID}`);
  console.log(`📁 Ruta esperada: ${VENDOR_DIR}`);
  console.log(`🔧 Ejecuta primero: node test-seller.js ${SELLER_ID}`);
  process.exit(1);
}

/**
 * Buscar archivos de batch
 */
function findBatchFiles() {
  if (!fs.existsSync(VENDOR_DIR)) {
    return [];
  }
  const files = fs.readdirSync(VENDOR_DIR);
  const batchFiles = files
    .filter(file => file.includes('plan-batch-') && file.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/batch-(\d+)/)[1]);
      const numB = parseInt(b.match(/batch-(\d+)/)[1]);
      return numA - numB;
    });
  return batchFiles.map(file => ({
    path: path.join(VENDOR_DIR, file),
    filename: file,
    number: parseInt(file.match(/batch-(\d+)/)[1])
  }));
}

/**
 * Cargar projects.json
 */
function loadProjectsFile() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch (error) {
    console.error('⚠️ Error cargando projects.json:', error.message);
    return { projects: {} };
  }
}

/**
 * Guardar projects.json
 */
function saveProjectsFile(data) {
  data.last_updated = new Date().toISOString();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Actualizar estado de batch en projects.json
 */
function updateBatchStatus(batchNumber, status) {
  try {
    const projectsData = loadProjectsFile();
    
    if (!projectsData.projects[SELLER_ID]) {
      console.log('⚠️ Vendedor no encontrado en projects.json');
      return;
    }

    const project = projectsData.projects[SELLER_ID];
    
    if (!project.batches || !Array.isArray(project.batches)) {
      console.log('⚠️ No hay batches registrados en projects.json');
      return;
    }

    const batch = project.batches.find(b => b.batch === batchNumber);
    
    if (batch) {
      batch.status = status;
      if (status === 'completed') {
        batch.completed_at = new Date().toISOString();
      } else if (status === 'scraping') {
        batch.started_at = new Date().toISOString();
      }
      
      saveProjectsFile(projectsData);
      console.log(`📊 Batch ${batchNumber} actualizado a: ${status}`);
    } else {
      console.log(`⚠️ Batch ${batchNumber} no encontrado en projects.json`);
    }
  } catch (error) {
    console.error('❌ Error actualizando estado de batch:', error.message);
  }
}

/**
 * Cargar o crear archivo de progreso
 */
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      return progress;
    } catch (error) {
      console.log('⚠️ Error cargando progreso, creando nuevo');
    }
  }
  
  return {
    seller_id: SELLER_ID,
    started_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    completed_categories: [],
    failed_categories: [],
    total_processed: 0,
    total_products_found: 0
  };
}

/**
 * Guardar progreso
 */
function saveProgress(progress) {
  progress.last_updated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Cargar cookies de autenticación
 */
function loadCookies() {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.error('❌ Archivo de cookies no encontrado:', COOKIES_FILE);
      console.log('🔧 Ejecuta primero: node scripts/a-login.js');
      return null;
    }

    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    return cookiesData.cookies || cookiesData;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Procesar una categoría
 */
async function processCategory(category, progress) {
  const categoryName = category.name;
  
  console.log(`\n🚀 === PROCESANDO: ${categoryName} ===`);
  console.log(`📊 Productos esperados: ${category.expected_products}`);
  
  try {
    return new Promise((resolve, reject) => {
      console.log(`⚡ Ejecutando: node category-intelligent.js ${SELLER_ID} "${categoryName}"`);
      
      const child = spawn('node', ['category-intelligent.js', SELLER_ID, categoryName], {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${categoryName} completada exitosamente`);
          
          progress.completed_categories.push({
            name: categoryName,
            completed_at: new Date().toISOString(),
            products_found: category.expected_products,
            status: 'completed'
          });
          progress.total_processed++;
          progress.total_products_found += category.expected_products;
          
          resolve({
            success: true,
            category: categoryName,
            products: category.expected_products
          });
        } else {
          const errorMsg = `Proceso terminó con código: ${code}`;
          console.error(`❌ Error procesando ${categoryName}: ${errorMsg}`);
          
          progress.failed_categories.push({
            name: categoryName,
            failed_at: new Date().toISOString(),
            error: errorMsg
          });
          
          reject(new Error(errorMsg));
        }
      });
      
      child.on('error', (error) => {
        console.error(`❌ Error ejecutando proceso: ${error.message}`);
        
        progress.failed_categories.push({
          name: categoryName,
          failed_at: new Date().toISOString(),
          error: error.message
        });
        
        reject(error);
      });
    });
    
  } catch (error) {
    console.error(`❌ Error procesando ${categoryName}:`, error.message);
    
    progress.failed_categories.push({
      name: categoryName,
      failed_at: new Date().toISOString(),
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Procesar un batch específico
 */
async function processBatch(batchFile, batchNumber, progress) {
  console.log(`\n📦 === PROCESANDO BATCH ${batchNumber} ===`);
  console.log(`📄 Archivo: ${path.basename(batchFile)}`);
  
  // Actualizar estado a 'scraping'
  updateBatchStatus(batchNumber, 'scraping');
  
  // Procesar categorías una por una, recargando el batch cada vez
  let batchProcessed = false;
  let categoriesProcessedInBatch = 0;
  
  while (!batchProcessed) {
    // Recargar batch para obtener estados actualizados
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    
    // Determinar categorías pendientes (basado en el estado actual del batch)
    const pendingCategories = batch.categories.filter(cat => 
      cat.status !== 'completed'
    );
    
    if (pendingCategories.length === 0) {
      console.log(`✅ Todas las categorías del batch ${batchNumber} están completadas`);
      updateBatchStatus(batchNumber, 'completed');
      batchProcessed = true;
      break;
    }
    
    // Mostrar resumen cada iteración
    if (categoriesProcessedInBatch === 0) {
      console.log(`📊 Categorías en este batch: ${batch.categories.length}`);
      const totalProducts = batch.categories.reduce((sum, cat) => sum + (cat.expected_products || 0), 0);
      console.log(`📦 Productos esperados: ${totalProducts}`);
    }
    
    const completedCount = batch.categories.length - pendingCategories.length;
    console.log(`✅ Completadas: ${completedCount}/${batch.categories.length}`);
    console.log(`⏳ Pendientes: ${pendingCategories.length}`);
    
    // Procesar la primera categoría pendiente
    const category = pendingCategories[0];
    
    console.log(`\n📂 [${completedCount + 1}/${batch.categories.length}] ${category.name}`);
    console.log(`📊 Productos esperados: ${category.expected_products}`);
    
    try {
      await processCategory(category, progress);
      saveProgress(progress);
      categoriesProcessedInBatch++;
      
      // Pausa entre categorías
      const pauseTime = Math.floor(Math.random() * 3000) + 2000;
      console.log(`⏸️ Pausa antes de siguiente categoría: ${(pauseTime / 1000).toFixed(1)}s`);
      await new Promise(resolve => setTimeout(resolve, pauseTime));
      
    } catch (error) {
      console.error(`❌ Falló ${category.name}: ${error.message}`);
      console.log('⏭️ Continuando con siguiente categoría...');
      saveProgress(progress);
      
      // Pausa más larga después de error
      const pauseTime = Math.floor(Math.random() * 5000) + 3000;
      console.log(`⏸️ Pausa después de error: ${(pauseTime / 1000).toFixed(1)}s`);
      await new Promise(resolve => setTimeout(resolve, pauseTime));
    }
  }
  
  return { success: true, skipped: false };
}

/**
 * Función principal
 */
async function main() {
  console.log('🎯 === PROCESAMIENTO DE BATCH INDIVIDUAL ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  
  // Cargar cookies
  const cookies = loadCookies();
  if (!cookies) return;
  
  // Buscar archivos de batch
  const batchFiles = findBatchFiles();
  
  if (batchFiles.length === 0) {
    console.error('❌ No se encontraron archivos de batch para este vendedor');
    console.log(`📁 Ruta: ${VENDOR_DIR}`);
    console.log(`🔧 Ejecuta primero: node create-plan-batches.js ${SELLER_ID}`);
    process.exit(1);
  }
  
  console.log(`📦 Total batches encontrados: ${batchFiles.length}`);
  
  // Cargar progreso
  const progress = loadProgress();
  
  // Determinar qué batch(es) procesar
  if (BATCH_ARG.toLowerCase() === 'all') {
    // Procesar todos los batches
    console.log(`\n🔄 Procesando TODOS los batches...`);
    
    for (let i = 0; i < batchFiles.length; i++) {
      const batch = batchFiles[i];
      
      console.log(`\n┌${'─'.repeat(58)}┐`);
      console.log(`│ BATCH ${batch.number}/${batchFiles.length}`.padEnd(59) + '│');
      console.log(`└${'─'.repeat(58)}┘`);
      
      await processBatch(batch.path, batch.number, progress);
      
      // Pausa entre batches
      if (i < batchFiles.length - 1) {
        const pauseTime = Math.floor(Math.random() * 5000) + 3000;
        console.log(`\n⏸️ Pausa entre batches: ${(pauseTime / 1000).toFixed(1)}s`);
        await new Promise(resolve => setTimeout(resolve, pauseTime));
      }
    }
    
    console.log(`\n🎉 === TODOS LOS BATCHES COMPLETADOS ===`);
    
  } else {
    // Procesar batch específico
    const batchNumber = parseInt(BATCH_ARG);
    
    if (isNaN(batchNumber)) {
      console.error('❌ Número de batch inválido:', BATCH_ARG);
      console.log('💡 Usa un número (1, 2, 3...) o "all" para procesar todos');
      process.exit(1);
    }
    
    const batch = batchFiles.find(b => b.number === batchNumber);
    
    if (!batch) {
      console.error(`❌ No se encontró batch #${batchNumber}`);
      console.log(`📦 Batches disponibles: ${batchFiles.map(b => b.number).join(', ')}`);
      process.exit(1);
    }
    
    console.log(`\n🎯 Procesando SOLO batch #${batchNumber}`);
    
    await processBatch(batch.path, batch.number, progress);
    
    console.log(`\n✅ === BATCH ${batchNumber} COMPLETADO ===`);
    console.log(`📦 Batches restantes: ${batchFiles.filter(b => b.number !== batchNumber).map(b => b.number).join(', ')}`);
  }
  
  // Resumen final
  console.log(`\n📊 === RESUMEN DE PROGRESO ===`);
  console.log(`✅ Categorías completadas: ${progress.completed_categories.length}`);
  console.log(`❌ Categorías con error: ${progress.failed_categories.length}`);
  console.log(`📦 Total productos encontrados: ${progress.total_products_found}`);
  
  if (progress.failed_categories.length > 0) {
    console.log(`\n⚠️ Categorías con errores:`);
    progress.failed_categories.forEach(cat => {
      console.log(`   - ${cat.name}: ${cat.error}`);
    });
  }
  
  console.log(`\n📁 Datos guardados en: ${VENDOR_DIR}`);
  console.log(`\n🚀 Siguiente paso: Consolidar productos del batch procesado`);
  console.log(`   node consolidate-batch-products.js ${SELLER_ID} ${BATCH_ARG}`);
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
