const fs = require('fs');
const path = require('path');

// Validar argumentos
if (process.argv.length < 3) {
  console.log('❌ Uso: node process-all-categories.js SELLER_ID');
  console.log('📋 Ejemplo: node process-all-categories.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const SELLER_ID = process.argv[2];

// Configuración - NUEVA ESTRUCTURA POR VENDEDOR
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const COOKIES_FILE = path.join(__dirname, 'scripts', 'auth', 'amazonmx.json');
const PROGRESS_FILE = path.join(VENDOR_DIR, 'progress.json');
const PROJECTS_FILE = path.join(__dirname, 'data', 'projects.json');

// Buscar plan existente en carpeta del vendedor
function findPlanFile() {
  if (!fs.existsSync(VENDOR_DIR)) {
    return null;
  }
  const files = fs.readdirSync(VENDOR_DIR);
  const planFile = files.find(file => file.includes('plan.json') && !file.includes('batch'));
  return planFile ? path.join(VENDOR_DIR, planFile) : null;
}

// Buscar archivos de batch
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
  return batchFiles.map(file => path.join(VENDOR_DIR, file));
}

const PLAN_FILE = findPlanFile();
const BATCH_FILES = findBatchFiles();

// Crear carpeta del vendedor si no existe
if (!fs.existsSync(VENDOR_DIR)) {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

// Generar fecha actual para nuevos archivos
const now = new Date();
const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/**
 * Cargar cookies de autenticación
 */
function loadCookies() {
  try {
    console.log('🍪 === CARGANDO COOKIES DE AUTENTICACIÓN ===');
    
    if (!fs.existsSync(COOKIES_FILE)) {
      console.error('❌ Archivo de cookies no encontrado:', COOKIES_FILE);
      console.log('🔧 Ejecuta primero: node scripts/a-login.js');
      return null;
    }

    const cookiesData = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    const cookies = cookiesData.cookies || cookiesData;
    
    console.log(`✅ Total cookies cargadas: ${cookies.length}`);
    
    // Verificar cookies esenciales
    const sessionCookie = cookies.find(c => c.name === 'session-id');
    const ubidCookie = cookies.find(c => c.name === 'ubid-acbmx');
    
    if (sessionCookie) {
      console.log('✅ Session cookie: Encontrada');
      const expiry = new Date(sessionCookie.expires * 1000);
      console.log(`✅ Session válida hasta: ${expiry.toLocaleString()}`);
    } else {
      console.log('⚠️ Session cookie: No encontrada');
    }
    
    if (ubidCookie) {
      console.log('✅ UBID cookie: Encontrada');
    } else {
      console.log('⚠️ UBID cookie: No encontrada');
    }
    
    return cookies;
  } catch (error) {
    console.error('❌ Error cargando cookies:', error.message);
    return null;
  }
}

/**
 * Cargar o crear archivo de progreso
 */
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📊 Progreso cargado: ${progress.completed_categories.length} categorías completadas`);
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
 * Actualizar plan con resultado de categoría
 */
function updatePlan(categoryName, result) {
  try {
    const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    const category = plan.categories.find(cat => cat.name === categoryName);
    
    if (category) {
      category.status = 'completed';
      category.completed_at = new Date().toISOString();
      category.file_path = path.basename(result.filePath);
      category.validation_result = {
        total_subcategories: result.subcategories_processed,
        total_products: result.total_products,
        loops_avoided: result.loops_avoided,
        filters_detected: result.filters_avoided,
        expected_vs_found: {
          expected: category.expected_products,
          found: result.total_products
        }
      };
      
      plan.last_updated = new Date().toISOString();
      fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
      console.log(`📋 Plan actualizado para: ${categoryName}`);
    }
  } catch (error) {
    console.error('❌ Error actualizando plan:', error.message);
  }
}

/**
 * Llamar al script category-intelligent.js para procesar una categoría
 */
async function processCategory(category, progress) {
  const categoryName = category.name;
  
  console.log(`\n🚀 === PROCESANDO: ${categoryName} ===`);
  console.log(`📊 Productos esperados: ${category.expected_products}`);
  
  try {
    // Importar y ejecutar la lógica de category-intelligent.js
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      console.log(`⚡ Ejecutando: node category-intelligent.js ${SELLER_ID} "${categoryName}"`);
      
      const child = spawn('node', ['category-intelligent.js', SELLER_ID, categoryName], {
        stdio: 'inherit', // Mostrar output en tiempo real
        cwd: __dirname
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${categoryName} completada exitosamente`);
          
          // Actualizar progreso
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
  
  // Este return nunca debería ejecutarse porque el while se rompe con break
  return { success: true, skipped: false };
}

/**
 * Función principal
 */
async function processAllCategories() {
  console.log('🎯 === PROCESAMIENTO AUTOMÁTICO DE TODAS LAS CATEGORÍAS ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  
  // Cargar cookies primero
  const cookies = loadCookies();
  if (!cookies) return;

  // Detectar modo de operación: BATCH o PLAN ÚNICO
  const useBatchMode = BATCH_FILES.length > 0;
  
  if (useBatchMode) {
    console.log(`\n🔄 === MODO: PROCESAMIENTO POR BATCHES ===`);
    console.log(`📦 Total batches detectados: ${BATCH_FILES.length}`);
    
    // Cargar progreso
    const progress = loadProgress();
    
    try {
      for (let i = 0; i < BATCH_FILES.length; i++) {
        const batchFile = BATCH_FILES[i];
        const batchNumber = parseInt(path.basename(batchFile).match(/batch-(\d+)/)[1]);
        
        console.log(`\n┌${'─'.repeat(58)}┐`);
        console.log(`│ BATCH ${batchNumber}/${BATCH_FILES.length}`.padEnd(59) + '│');
        console.log(`└${'─'.repeat(58)}┘`);
        
        const result = await processBatch(batchFile, batchNumber, progress);
        
        if (!result.skipped) {
          // Pausa entre batches
          if (i < BATCH_FILES.length - 1) {
            const pauseTime = Math.floor(Math.random() * 5000) + 3000;
            console.log(`\n⏸️ Pausa entre batches: ${(pauseTime / 1000).toFixed(1)}s`);
            await new Promise(resolve => setTimeout(resolve, pauseTime));
          }
        }
      }
      
      // Resumen final de batches
      console.log(`\n🎉 === TODOS LOS BATCHES COMPLETADOS ===`);
      console.log(`✅ Batches procesados: ${BATCH_FILES.length}`);
      console.log(`✅ Categorías totales: ${progress.completed_categories.length}`);
      console.log(`❌ Errores: ${progress.failed_categories.length}`);
      console.log(`📦 Total productos: ${progress.total_products_found}`);
      console.log(`📁 Archivos generados en: ${VENDOR_DIR}`);
      
      if (progress.failed_categories.length > 0) {
        console.log(`\n⚠️ Categorías con errores:`);
        progress.failed_categories.forEach(cat => {
          console.log(`   - ${cat.name}: ${cat.error}`);
        });
        console.log(`\n🔄 Para reintentar, vuelve a ejecutar el comando`);
      }
      
      console.log(`\n🎯 ¡Fase 3 (Scraping por Batches) COMPLETAMENTE TERMINADA!`);
      console.log(`🚀 Siguiente paso: node process-vendor-categories.js ${SELLER_ID}`);
      
    } catch (error) {
      console.error('❌ Error en procesamiento de batches:', error.message);
    }
    
    return;
  }
  
  // MODO TRADICIONAL: Plan único
  console.log(`\n📋 === MODO: PLAN ÚNICO ===`);
  
  // Verificar que existe el plan
  if (!PLAN_FILE || !fs.existsSync(PLAN_FILE)) {
    console.error('❌ Plan no encontrado para vendedor:', SELLER_ID);
    console.log('🔧 Ejecuta primero: node create-plan.js', SELLER_ID);
    console.log('🔧 O para vendedores grandes: node create-plan-batches.js', SELLER_ID);
    return;
  }
  
  console.log(`📋 Plan encontrado: ${path.basename(PLAN_FILE)}`);

  // Cargar plan
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  console.log(`📋 Plan cargado: ${plan.total_categories} categorías`);

  // Cargar progreso
  const progress = loadProgress();

  // Determinar categorías pendientes
  const completedNames = progress.completed_categories.map(c => c.name);
  const pendingCategories = plan.categories.filter(cat => 
    !completedNames.includes(cat.name) && cat.status !== 'completed'
  );

  console.log(`✅ Completadas anteriormente: ${completedNames.length}`);
  console.log(`⏳ Pendientes: ${pendingCategories.length}`);

  if (pendingCategories.length === 0) {
    console.log('🎉 ¡Todas las categorías ya están procesadas!');
    
    // Mostrar resumen detallado de lo completado
    const completedInPlan = plan.categories.filter(cat => cat.status === 'completed');
    const totalProductsInPlan = completedInPlan.reduce((sum, cat) => 
      sum + (cat.validation_result?.total_products || cat.expected_products || 0), 0);
    
    console.log(`\n📊 === RESUMEN COMPLETO ===`);
    console.log(`✅ Categorías completadas: ${completedInPlan.length}/${plan.total_categories}`);
    console.log(`📦 Total productos procesados: ${totalProductsInPlan}`);
    
    console.log(`\n📂 Categorías procesadas:`);
    completedInPlan.forEach((cat, i) => {
      const products = cat.validation_result?.total_products || cat.expected_products || 0;
      const subcats = cat.validation_result?.total_subcategories || 1;
      console.log(`   ${i + 1}. ${cat.name}: ${products} productos (${subcats} subcategorías)`);
    });
    
    console.log(`\n📁 Archivos generados en: ${VENDOR_DIR}`);
    completedInPlan.forEach(cat => {
      if (cat.file_path) {
        console.log(`   - ${cat.file_path}`);
      }
    });
    
    console.log(`\n🎯 ¡Fase 1 (Scraping) COMPLETAMENTE TERMINADA!`);
    console.log(`🚀 Listo para Fase 2: Verificación en Amazon USA`);
    
    return;
  }

  try {
    console.log(`\n🔄 Procesando ${pendingCategories.length} categorías pendientes...`);
    
    for (let i = 0; i < pendingCategories.length; i++) {
      const category = pendingCategories[i];
      
      console.log(`\n📂 [${i + 1}/${pendingCategories.length}] ${category.name}`);
      console.log(`📊 Productos esperados: ${category.expected_products}`);
      
      try {
        await processCategory(category, progress);
        saveProgress(progress);
        
        // Pausa entre categorías
        if (i < pendingCategories.length - 1) {
          const pauseTime = Math.floor(Math.random() * 3000) + 2000;
          console.log(`⏸️ Pausa entre categorías: ${(pauseTime / 1000).toFixed(1)}s`);
          await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
        
      } catch (error) {
        console.error(`❌ Falló ${category.name}: ${error.message}`);
        console.log('⏭️ Continuando con siguiente categoría...');
        saveProgress(progress);
      }
    }

    // Resumen final
    console.log(`\n🎉 === PROCESAMIENTO COMPLETADO ===`);
    console.log(`✅ Categorías procesadas: ${progress.completed_categories.length}`);
    console.log(`❌ Errores: ${progress.failed_categories.length}`);
    console.log(`📦 Total productos: ${progress.total_products_found}`);
    console.log(`📁 Archivos generados en: ${VENDOR_DIR}`);
    console.log(`📊 Archivo de progreso: ${path.basename(PROGRESS_FILE)}`);

    if (progress.failed_categories.length > 0) {
      console.log(`\n⚠️ Categorías con errores:`);
      progress.failed_categories.forEach(cat => {
        console.log(`   - ${cat.name}: ${cat.error}`);
      });
      console.log(`\n🔄 Para reintentar solo las fallidas, vuelve a ejecutar el comando`);
    }

  } catch (error) {
    console.error('❌ Error principal:', error.message);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  processAllCategories().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { processAllCategories };