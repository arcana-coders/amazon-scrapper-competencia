const fs = require('fs');
const path = require('path');

/**
 * CONSOLIDADOR DE PRODUCTOS POR BATCH
 * 
 * Consolida los productos de un batch específico en un archivo único.
 * Permite trabajar con batches individuales sin mezclar con otros batches.
 * 
 * USO:
 *   node consolidate-batch-products.js SELLER_ID BATCH_NUMBER
 *   node consolidate-batch-products.js SELLER_ID all
 * 
 * EJEMPLO:
 *   node consolidate-batch-products.js A3Q5ASRA7J8Y5E 1
 *   node consolidate-batch-products.js A3Q5ASRA7J8Y5E all
 */

// Validar argumentos
if (process.argv.length < 4) {
  console.log('❌ Uso: node consolidate-batch-products.js SELLER_ID BATCH_NUMBER');
  console.log('📋 Ejemplo: node consolidate-batch-products.js A3Q5ASRA7J8Y5E 1');
  console.log('📋 Ejemplo: node consolidate-batch-products.js A3Q5ASRA7J8Y5E all  (para consolidar todos)');
  process.exit(1);
}

const SELLER_ID = process.argv[2];
const BATCH_ARG = process.argv[3];

// Configuración
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', SELLER_ID);
const CATEGORIES_DIR = path.join(__dirname, 'data', 'categories');

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
 * Buscar archivos de productos de categorías
 */
function findCategoryProductFiles() {
  const files = [];
  
  // Buscar en VENDOR_DIR
  if (fs.existsSync(VENDOR_DIR)) {
    const vendorFiles = fs.readdirSync(VENDOR_DIR);
    vendorFiles
      .filter(file => file.includes('intelligent-') && file.endsWith('.json'))
      .forEach(file => {
        files.push({
          path: path.join(VENDOR_DIR, file),
          filename: file
        });
      });
  }
  
  // Buscar en CATEGORIES_DIR (formato antiguo)
  if (fs.existsSync(CATEGORIES_DIR)) {
    const categoryFiles = fs.readdirSync(CATEGORIES_DIR);
    categoryFiles
      .filter(file => 
        file.includes('intelligent-') && 
        file.includes(SELLER_ID) && 
        file.endsWith('.json')
      )
      .forEach(file => {
        files.push({
          path: path.join(CATEGORIES_DIR, file),
          filename: file
        });
      });
  }
  
  return files;
}

/**
 * Consolidar productos de un batch específico
 */
function consolidateBatch(batchNumber) {
  console.log(`\n🔄 === CONSOLIDANDO BATCH ${batchNumber} ===`);
  
  // Cargar plan del batch
  const batchFiles = findBatchFiles();
  const batch = batchFiles.find(b => b.number === batchNumber);
  
  if (!batch) {
    console.error(`❌ No se encontró batch #${batchNumber}`);
    console.log(`📦 Batches disponibles: ${batchFiles.map(b => b.number).join(', ')}`);
    return null;
  }
  
  const batchPlan = JSON.parse(fs.readFileSync(batch.path, 'utf8'));
  const batchCategories = batchPlan.categories.map(cat => cat.name);
  
  console.log(`📦 Batch ${batchNumber}: ${batchCategories.length} categorías`);
  
  // Buscar archivos de productos
  const productFiles = findCategoryProductFiles();
  console.log(`📂 Total archivos de productos encontrados: ${productFiles.length}`);
  
  // Consolidar productos
  const consolidated = {
    metadata: {
      seller_id: SELLER_ID,
      batch_number: batchNumber,
      consolidation_date: new Date().toISOString(),
      categories_in_batch: batchCategories,
      source_files: []
    },
    categories: [],
    all_products: []
  };
  
  let totalProducts = 0;
  let duplicatesFound = 0;
  const uniqueProducts = new Map();
  const duplicatesByCategory = {};
  
  for (const categoryName of batchCategories) {
    // Buscar archivo de productos para esta categoría
    const productFile = productFiles.find(file => {
      const normalized = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      return file.filename.toLowerCase().includes(normalized);
    });
    
    if (!productFile) {
      console.log(`⚠️ No se encontró archivo de productos para: ${categoryName}`);
      continue;
    }
    
    try {
      const categoryData = JSON.parse(fs.readFileSync(productFile.path, 'utf8'));
      
      // Determinar estructura del archivo (intelligent vs products)
      let productsArray = [];
      let productsCount = 0;
      
      if (categoryData.products && Array.isArray(categoryData.products)) {
        // Formato de *-products.json (extract-products.js)
        productsArray = categoryData.products;
        productsCount = categoryData.metadata?.total_products || productsArray.length;
      } else if (categoryData.subcategories && Array.isArray(categoryData.subcategories)) {
        // Formato de intelligent-*.json (category-intelligent.js)
        productsCount = categoryData.subcategories.reduce((sum, sub) => sum + (sub.productCount || 0), 0);
        // Extraer productos de subcategorías si existen
        for (const subcat of categoryData.subcategories) {
          if (subcat.products && Array.isArray(subcat.products)) {
            productsArray.push(...subcat.products);
          }
        }
      }
      
      // Agregar información de categoría
      consolidated.categories.push({
        name: categoryName,
        products_count: productsCount,
        source_file: productFile.filename
      });
      
      consolidated.metadata.source_files.push(productFile.filename);
      
      // Procesar productos
      productsArray.forEach(product => {
        const asin = product.asin;
        
        // Trackear categorías
        if (!duplicatesByCategory[asin]) {
          duplicatesByCategory[asin] = [];
        }
        duplicatesByCategory[asin].push(categoryName);
        
        // Solo mantener primera ocurrencia
        if (!uniqueProducts.has(asin)) {
          uniqueProducts.set(asin, {
            ...product,
            category: categoryName,
            batch_number: batchNumber
          });
          totalProducts++;
        } else {
          duplicatesFound++;
        }
      });
      
      console.log(`✅ ${categoryName}: ${uniqueProducts.size - consolidated.all_products.length} productos`);
      
    } catch (error) {
      console.error(`❌ Error procesando ${categoryName}:`, error.message);
    }
  }
  
  // Agregar productos únicos y categorías donde aparecen
  uniqueProducts.forEach((product, asin) => {
    product.also_appears_in = duplicatesByCategory[asin].filter(cat => cat !== product.category);
    consolidated.all_products.push(product);
  });
  
  // Actualizar metadatos
  consolidated.metadata.total_products = consolidated.all_products.length;
  consolidated.metadata.duplicates_removed = duplicatesFound;
  consolidated.metadata.categories_processed = consolidated.categories.length;
  
  // Guardar consolidado
  const dateStr = new Date().toISOString().split('T')[0];
  const outputFile = path.join(VENDOR_DIR, `batch-${batchNumber}-consolidated.json`);
  fs.writeFileSync(outputFile, JSON.stringify(consolidated, null, 2));
  
  console.log(`\n📊 === RESUMEN BATCH ${batchNumber} ===`);
  console.log(`✅ Productos únicos: ${consolidated.all_products.length}`);
  console.log(`🔄 Duplicados eliminados: ${duplicatesFound}`);
  console.log(`📂 Categorías procesadas: ${consolidated.categories.length}`);
  console.log(`💾 Guardado en: ${outputFile}`);
  
  // Generar CSV espejo
  generateCSV(consolidated, batchNumber);
  
  return consolidated;
}

/**
 * Generar archivo CSV espejo
 */
function generateCSV(consolidated, batchNumber) {
  console.log(`\n📄 Generando CSV...`);
  
  const csvRows = [];
  const headers = ['asin', 'title', 'price', 'url', 'category', 'batch_number'];
  csvRows.push(headers.join(','));
  
  consolidated.all_products.forEach(product => {
    const row = [
      `"${product.asin || ''}"`,
      `"${(product.title || '').replace(/"/g, '""')}"`,
      `"${product.price || ''}"`,
      `"${product.url || ''}"`,
      `"${product.category || ''}"`,
      batchNumber
    ];
    csvRows.push(row.join(','));
  });
  
  const csvPath = path.join(VENDOR_DIR, `batch-${batchNumber}-consolidated.csv`);
  fs.writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`💾 CSV guardado en: ${csvPath}`);
}

/**
 * Consolidar todos los batches
 */
function consolidateAllBatches() {
  console.log('\n🔄 === CONSOLIDANDO TODOS LOS BATCHES ===');
  
  const batchFiles = findBatchFiles();
  
  if (batchFiles.length === 0) {
    console.error('❌ No se encontraron batches');
    return;
  }
  
  console.log(`📦 Total batches encontrados: ${batchFiles.length}\n`);
  
  const allConsolidated = [];
  
  for (const batch of batchFiles) {
    const consolidated = consolidateBatch(batch.number);
    if (consolidated) {
      allConsolidated.push(consolidated);
    }
  }
  
  // Crear consolidado general (fusión de todos los batches)
  console.log(`\n🔄 === CREANDO CONSOLIDADO GENERAL ===`);
  
  const general = {
    metadata: {
      seller_id: SELLER_ID,
      consolidation_date: new Date().toISOString(),
      total_batches: allConsolidated.length,
      batches: allConsolidated.map(c => c.metadata.batch_number)
    },
    categories: [],
    all_products: []
  };
  
  const uniqueProducts = new Map();
  
  allConsolidated.forEach(batchData => {
    // Agregar categorías
    general.categories.push(...batchData.categories);
    
    // Agregar productos únicos
    batchData.all_products.forEach(product => {
      if (!uniqueProducts.has(product.asin)) {
        uniqueProducts.set(product.asin, product);
      }
    });
  });
  
  general.all_products = Array.from(uniqueProducts.values());
  general.metadata.total_products = general.all_products.length;
  general.metadata.total_categories = general.categories.length;
  
  // Guardar consolidado general
  const generalFile = path.join(VENDOR_DIR, 'all-products-consolidated.json');
  fs.writeFileSync(generalFile, JSON.stringify(general, null, 2));
  
  console.log(`\n📊 === RESUMEN GENERAL ===`);
  console.log(`📦 Batches procesados: ${allConsolidated.length}`);
  console.log(`✅ Productos únicos totales: ${general.all_products.length}`);
  console.log(`📂 Categorías totales: ${general.categories.length}`);
  console.log(`💾 Guardado en: ${generalFile}`);
  
  // Generar CSV general
  console.log(`\n📄 Generando CSV general...`);
  const csvRows = [];
  const headers = ['asin', 'title', 'price', 'url', 'category'];
  csvRows.push(headers.join(','));
  
  general.all_products.forEach(product => {
    const row = [
      `"${product.asin || ''}"`,
      `"${(product.title || '').replace(/"/g, '""')}"`,
      `"${product.price || ''}"`,
      `"${product.url || ''}"`,
      `"${product.category || ''}"`
    ];
    csvRows.push(row.join(','));
  });
  
  const csvPath = path.join(VENDOR_DIR, 'all-products-consolidated.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'));
  console.log(`💾 CSV general guardado en: ${csvPath}`);
}

/**
 * Función principal
 */
function main() {
  console.log('🎯 === CONSOLIDACIÓN DE PRODUCTOS POR BATCH ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  
  if (BATCH_ARG.toLowerCase() === 'all') {
    consolidateAllBatches();
  } else {
    const batchNumber = parseInt(BATCH_ARG);
    
    if (isNaN(batchNumber)) {
      console.error('❌ Número de batch inválido:', BATCH_ARG);
      console.log('💡 Usa un número (1, 2, 3...) o "all" para consolidar todos');
      process.exit(1);
    }
    
    consolidateBatch(batchNumber);
  }
  
  console.log(`\n✅ === CONSOLIDACIÓN COMPLETADA ===`);
  console.log(`📁 Archivos guardados en: ${VENDOR_DIR}`);
  console.log(`\n🚀 Siguiente paso: Verificación en USA para este batch`);
  console.log(`   node verify-batch-usa.js ${SELLER_ID} ${BATCH_ARG}`);
}

// Ejecutar
main();
