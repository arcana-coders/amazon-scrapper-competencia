const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * EXTRACTOR DE PRODUCTOS POR BATCH
 * 
 * Extrae productos de las categorías de un batch específico que ya fue analizado.
 * Lee el plan del batch y ejecuta extract-products.js para cada categoría.
 * 
 * USO:
 *   node extract-batch-products.js SELLER_ID BATCH_NUMBER
 *   node extract-batch-products.js SELLER_ID all
 * 
 * EJEMPLO:
 *   node extract-batch-products.js AE8MUNDUREHX7 1
 *   node extract-batch-products.js AE8MUNDUREHX7 all
 */

// Validar argumentos
if (process.argv.length < 4) {
  console.log('❌ Uso: node extract-batch-products.js SELLER_ID BATCH_NUMBER');
  console.log('📋 Ejemplo: node extract-batch-products.js AE8MUNDUREHX7 1');
  console.log('📋 Ejemplo: node extract-batch-products.js AE8MUNDUREHX7 all');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const BATCH_ARG = process.argv[3];

// Configuración
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const EXTRACT_SCRIPT = path.join(__dirname, 'extract-products.js');

// Validar que existe la carpeta del vendedor
if (!fs.existsSync(VENDOR_DIR)) {
  console.error(`❌ No existe carpeta para vendedor ${SELLER_ID}`);
  console.log(`📁 Ruta esperada: ${VENDOR_DIR}`);
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
 * Ejecutar extract-products.js para una categoría específica
 */
function executeExtractProducts(categoryUrl, categoryName) {
  return new Promise((resolve, reject) => {
    console.log(`\n⚡ Extrayendo productos: ${categoryName}`);
    console.log(`🔗 URL: ${categoryUrl}`);
    
    const args = [
      EXTRACT_SCRIPT,
      SELLER_ID,
      'null', // Sin límite de páginas - extraer todo
      categoryUrl,
      categoryName
    ];

    const child = spawn('node', args, {
      stdio: 'pipe',
      cwd: __dirname
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Mostrar solo líneas importantes
      const lines = text.split('\n');
      lines.forEach(line => {
        if (line.includes('===') || line.includes('✅') || line.includes('📦') || 
            line.includes('❌') || line.includes('💾') || line.includes('🎉')) {
          console.log(line.trim());
        }
      });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error(text.trim());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${categoryName} extraída exitosamente`);
        resolve({ success: true, output });
      } else {
        console.error(`❌ Error extrayendo ${categoryName} (código: ${code})`);
        reject(new Error(`Proceso falló con código ${code}: ${errorOutput}`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error ejecutando proceso: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Extraer productos de un batch específico
 */
async function extractBatchProducts(batchNumber) {
  console.log(`\n🔄 === EXTRACCIÓN DE PRODUCTOS - BATCH ${batchNumber} ===`);
  
  // Cargar plan del batch
  const batchFiles = findBatchFiles();
  const batch = batchFiles.find(b => b.number === batchNumber);
  
  if (!batch) {
    console.error(`❌ No se encontró batch #${batchNumber}`);
    console.log(`📦 Batches disponibles: ${batchFiles.map(b => b.number).join(', ')}`);
    return { success: false };
  }
  
  const batchPlan = JSON.parse(fs.readFileSync(batch.path, 'utf8'));
  const categories = batchPlan.categories || [];
  
  console.log(`📦 Batch ${batchNumber}: ${categories.length} categorías`);
  console.log(`📊 Productos esperados: ${categories.reduce((sum, cat) => sum + (cat.expected_products || 0), 0)}`);
  
  // Verificar qué categorías ya tienen productos extraídos
  const categoriesNeedingExtraction = [];
  
  for (const category of categories) {
    const categoryFileName = category.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const productFile = path.join(VENDOR_DIR, `${categoryFileName}-products.json`);
    
    if (fs.existsSync(productFile)) {
      console.log(`✓ ${category.name} - Ya tiene productos extraídos`);
    } else {
      categoriesNeedingExtraction.push(category);
    }
  }
  
  if (categoriesNeedingExtraction.length === 0) {
    console.log(`\n✅ Todas las categorías del batch ${batchNumber} ya tienen productos extraídos`);
    return { success: true, skipped: true };
  }
  
  console.log(`\n📋 Categorías pendientes de extracción: ${categoriesNeedingExtraction.length}`);
  console.log(`⏳ Esto puede tardar varios minutos...`);
  
  // Extraer productos de cada categoría
  let successCount = 0;
  let errorCount = 0;
  let totalSubcategoriesProcessed = 0;
  
  for (let i = 0; i < categoriesNeedingExtraction.length; i++) {
    const category = categoriesNeedingExtraction[i];
    
    console.log(`\n📂 [${i + 1}/${categoriesNeedingExtraction.length}] ${category.name}`);
    console.log(`📊 Productos esperados: ${category.expected_products}`);
    
    // Buscar archivo intelligent para obtener subcategorías
    const categoryFileName = category.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const intelligentFile = path.join(VENDOR_DIR, `2025-10-13-intelligent-${categoryFileName}.json`);
    
    if (!fs.existsSync(intelligentFile)) {
      console.error(`❌ No se encontró archivo de análisis: ${intelligentFile}`);
      console.log(`⚠️ Extrayendo de URL principal como fallback...`);
      
      try {
        await executeExtractProducts(category.url, category.name);
        successCount++;
      } catch (error) {
        console.error(`❌ Falló ${category.name}: ${error.message}`);
        errorCount++;
      }
      continue;
    }
    
    // Leer subcategorías del archivo intelligent
    const intelligentData = JSON.parse(fs.readFileSync(intelligentFile, 'utf8'));
    const subcategories = intelligentData.subcategories || [];
    const leafSubcategories = subcategories.filter(sub => sub.isLeaf);
    
    console.log(`🌳 Subcategorías hoja encontradas: ${leafSubcategories.length}`);
    
    if (leafSubcategories.length === 0) {
      console.log(`⚠️ No hay subcategorías, extrayendo de URL principal...`);
      try {
        await executeExtractProducts(category.url, category.name);
        successCount++;
      } catch (error) {
        console.error(`❌ Falló ${category.name}: ${error.message}`);
        errorCount++;
      }
      continue;
    }
    
    // Extraer productos de cada subcategoría hoja
    const allProducts = [];
    let subcategoryErrors = 0;
    
    for (let j = 0; j < leafSubcategories.length; j++) {
      const subcat = leafSubcategories[j];
      
      console.log(`\n   📁 [${j + 1}/${leafSubcategories.length}] ${subcat.name}`);
      console.log(`   📊 ${subcat.productCount} productos`);
      console.log(`   🔗 ${subcat.url.substring(0, 80)}...`);
      
      try {
        // Crear nombre temporal para subcategoría
        const subcatFileName = `${categoryFileName}-${subcat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        
        await executeExtractProducts(subcat.url, subcatFileName);
        totalSubcategoriesProcessed++;
        
        // Leer productos extraídos
        const subcatProductFile = path.join(VENDOR_DIR, `${subcatFileName}-products.json`);
        if (fs.existsSync(subcatProductFile)) {
          const subcatData = JSON.parse(fs.readFileSync(subcatProductFile, 'utf8'));
          if (subcatData.products && Array.isArray(subcatData.products)) {
            allProducts.push(...subcatData.products);
            console.log(`   ✅ ${subcatData.products.length} productos extraídos`);
          }
        }
        
        // Pausa entre subcategorías
        if (j < leafSubcategories.length - 1) {
          const pauseTime = Math.floor(Math.random() * 3000) + 2000;
          console.log(`   ⏸️ Pausa: ${(pauseTime / 1000).toFixed(1)}s`);
          await new Promise(resolve => setTimeout(resolve, pauseTime));
        }
        
      } catch (error) {
        console.error(`   ❌ Error en subcategoría: ${error.message}`);
        subcategoryErrors++;
      }
    }
    
    // Consolidar productos de todas las subcategorías en un solo archivo
    const categoryProductFile = path.join(VENDOR_DIR, `${categoryFileName}-products.json`);
    const consolidatedData = {
      metadata: {
        seller_id: SELLER_ID,
        category_name: category.name,
        total_products: allProducts.length,
        subcategories_processed: leafSubcategories.length,
        subcategories_with_errors: subcategoryErrors,
        extraction_date: new Date().toISOString(),
        extraction_method: 'subcategory_extraction_v2'
      },
      products: allProducts
    };
    
    fs.writeFileSync(categoryProductFile, JSON.stringify(consolidatedData, null, 2));
    console.log(`\n💾 Consolidado: ${allProducts.length} productos guardados en ${categoryFileName}-products.json`);
    
    if (subcategoryErrors === 0) {
      successCount++;
    } else if (allProducts.length > 0) {
      console.log(`⚠️ Completado con ${subcategoryErrors} errores en subcategorías`);
      successCount++;
    } else {
      errorCount++;
    }
    
    // Pausa entre categorías principales
    if (i < categoriesNeedingExtraction.length - 1) {
      const pauseTime = Math.floor(Math.random() * 5000) + 3000;
      console.log(`⏸️ Pausa entre categorías: ${(pauseTime / 1000).toFixed(1)}s`);
      await new Promise(resolve => setTimeout(resolve, pauseTime));
    }
  }
  
  console.log(`\n📊 === RESUMEN BATCH ${batchNumber} ===`);
  console.log(`✅ Categorías completadas: ${successCount}`);
  console.log(`❌ Con errores: ${errorCount}`);
  console.log(`🌳 Subcategorías procesadas: ${totalSubcategoriesProcessed}`);
  console.log(`📁 Archivos guardados en: ${VENDOR_DIR}`);
  
  return { success: true, successCount, errorCount, totalSubcategoriesProcessed };
}

/**
 * Extraer productos de todos los batches
 */
async function extractAllBatches() {
  console.log('\n🔄 === EXTRACCIÓN DE PRODUCTOS - TODOS LOS BATCHES ===');
  
  const batchFiles = findBatchFiles();
  
  if (batchFiles.length === 0) {
    console.error('❌ No se encontraron batches');
    return;
  }
  
  console.log(`📦 Total batches encontrados: ${batchFiles.length}\n`);
  
  for (const batch of batchFiles) {
    await extractBatchProducts(batch.number);
    
    // Pausa entre batches
    if (batch.number < batchFiles.length) {
      const pauseTime = Math.floor(Math.random() * 5000) + 3000;
      console.log(`\n⏸️ Pausa entre batches: ${(pauseTime / 1000).toFixed(1)}s\n`);
      await new Promise(resolve => setTimeout(resolve, pauseTime));
    }
  }
  
  console.log(`\n🎉 === EXTRACCIÓN COMPLETA ===`);
  console.log(`✅ Todos los batches procesados`);
}

/**
 * Función principal
 */
async function main() {
  console.log('🎯 === EXTRACCIÓN DE PRODUCTOS POR BATCH ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  
  // Buscar archivos de batch
  const batchFiles = findBatchFiles();
  
  if (batchFiles.length === 0) {
    console.error('❌ No se encontraron archivos de batch para este vendedor');
    console.log(`📁 Ruta: ${VENDOR_DIR}`);
    console.log(`🔧 Ejecuta primero: node create-plan-batches.js ${SELLER_ID}`);
    process.exit(1);
  }
  
  console.log(`📦 Total batches encontrados: ${batchFiles.length}`);
  
  // Determinar qué batch(es) procesar
  if (BATCH_ARG.toLowerCase() === 'all') {
    await extractAllBatches();
  } else {
    const batchNumber = parseInt(BATCH_ARG);
    
    if (isNaN(batchNumber)) {
      console.error('❌ Número de batch inválido:', BATCH_ARG);
      console.log('💡 Usa un número (1, 2, 3...) o "all" para extraer de todos');
      process.exit(1);
    }
    
    await extractBatchProducts(batchNumber);
  }
  
  console.log(`\n✅ === EXTRACCIÓN COMPLETADA ===`);
  console.log(`📁 Archivos guardados en: ${VENDOR_DIR}`);
  console.log(`\n🚀 Siguiente paso: Consolidar productos del batch`);
  console.log(`   node consolidate-batch-products.js ${SELLER_ID} ${BATCH_ARG}`);
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
