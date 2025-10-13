const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * PROCESADOR DE CATEGORÍAS POR VENDEDOR
 * 
 * Toma las categorías de un vendedor desde su carpeta y procesa cada una
 * usando extract-products.js, consolidando al final en un archivo único.
 * 
 * USO:
 *   node process-vendor-categories.js [SELLER_ID]
 * 
 * EJEMPLO:
 *   node process-vendor-categories.js A3Q5ASRA7J8Y5E
 * 
 * FLUJO:
 * 1. Lee categorías desde data/vendors/SELLER_ID/
 * 2. Para cada categoría, ejecuta extract-products.js con URL específica
 * 3. Mantiene progreso en data/vendors/SELLER_ID/categories-progress.json
 * 4. Consolida todo en data/vendors/SELLER_ID/all-products-consolidated.json
 */

// ========== CONFIGURACIÓN ==========
const SELLER_ID = process.argv[2];

if (!SELLER_ID) {
  console.error('❌ Error: Debes proporcionar un SELLER_ID');
  console.log('📋 Uso: node process-vendor-categories.js SELLER_ID');
  console.log('📋 Ejemplo: node process-vendor-categories.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
const VENDOR_DIR = path.join(DATA_DIR, 'vendors', SELLER_ID);
const PROGRESS_FILE = path.join(VENDOR_DIR, 'categories-progress.json');
const CONSOLIDATED_FILE = path.join(VENDOR_DIR, 'all-products-consolidated.json');
const EXTRACT_SCRIPT = path.join(__dirname, 'extract-products.js');

// ========== FUNCIONES DE UTILIDAD ==========

/**
 * Cargar o crear archivo de progreso
 */
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (error) {
      console.log('⚠️ Error cargando progreso, creando nuevo archivo');
    }
  }
  
  return {
    seller_id: SELLER_ID,
    categories_completed: [],
    categories_pending: [],
    last_updated: new Date().toISOString(),
    status: 'not_started'
  };
}

/**
 * Guardar archivo de progreso
 */
function saveProgress(progress) {
  progress.last_updated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Leer categorías desde los archivos del vendedor
 */
function loadVendorCategories() {
  if (!fs.existsSync(VENDOR_DIR)) {
    console.error(`❌ Carpeta del vendedor no encontrada: ${VENDOR_DIR}`);
    console.log('💡 Ejecuta primero el análisis con cerebro.js');
    process.exit(1);
  }

  const files = fs.readdirSync(VENDOR_DIR);
  const categoryFiles = files.filter(file => 
    file.includes('intelligent-') && file.endsWith('.json')
  );

  if (categoryFiles.length === 0) {
    console.error(`❌ No se encontraron archivos de categorías en: ${VENDOR_DIR}`);
    console.log('💡 Ejecuta primero el análisis jerárquico con cerebro.js');
    process.exit(1);
  }

  console.log(`📂 Archivos de categorías encontrados: ${categoryFiles.length}`);
  
  const categories = [];
  
  for (const file of categoryFiles) {
    try {
      const filePath = path.join(VENDOR_DIR, file);
      const categoryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Extraer información de cada subcategoría
      if (categoryData.subcategories && Array.isArray(categoryData.subcategories)) {
        for (const subcat of categoryData.subcategories) {
          if (subcat.url && subcat.name) {
            categories.push({
              name: subcat.name,
              full_path: subcat.full_path || subcat.name,
              url: subcat.url,
              expected_products: subcat.productCount || 0,
              source_file: file,
              isLeaf: subcat.isLeaf || true
            });
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error procesando archivo ${file}: ${error.message}`);
    }
  }

  console.log(`📋 Total categorías procesables: ${categories.length}`);
  return categories;
}

/**
 * Ejecutar extract-products.js para una categoría específica
 */
function executeExtractProducts(categoryUrl, categoryName) {
  return new Promise((resolve, reject) => {
    console.log(`\n⚡ Ejecutando extracción para: ${categoryName}`);
    console.log(`🔗 URL: ${categoryUrl}`);
    
    // Ejecutar extract-products.js con parámetros específicos
    // Parámetros: SELLER_ID, MAX_PAGES, CUSTOM_URL, CATEGORY_NAME
    const args = [
      EXTRACT_SCRIPT,
      SELLER_ID,
      '10', // Límite de 10 páginas por categoría
      categoryUrl,
      categoryName
    ];

    const process = spawn('node', args, {
      stdio: 'pipe',
      cwd: __dirname
    });

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Mostrar solo líneas importantes para no saturar
      const lines = text.split('\n');
      lines.forEach(line => {
        if (line.includes('===') || line.includes('✅') || line.includes('📦') || 
            line.includes('❌') || line.includes('💾') || line.includes('🎉')) {
          console.log(line.trim());
        }
      });
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error(text.trim());
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${categoryName} completada exitosamente`);
        resolve({ success: true, output });
      } else {
        console.error(`❌ Error procesando ${categoryName} (código: ${code})`);
        reject(new Error(`Proceso falló con código ${code}: ${errorOutput}`));
      }
    });

    process.on('error', (error) => {
      console.error(`❌ Error ejecutando proceso: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Consolidar todos los archivos de productos en uno solo (sin duplicados)
 */
function consolidateProducts() {
  console.log('\n🔄 === CONSOLIDANDO PRODUCTOS ===');
  
  const files = fs.readdirSync(VENDOR_DIR);
  const productFiles = files.filter(file => 
    file.includes('-products.json') && file !== 'all-products-consolidated.json'
  );

  if (productFiles.length === 0) {
    console.log('⚠️ No se encontraron archivos de productos para consolidar');
    return;
  }

  console.log(`📂 Archivos a consolidar: ${productFiles.length}`);

  const consolidated = {
    metadata: {
      seller_id: SELLER_ID,
      total_categories: productFiles.length,
      consolidation_date: new Date().toISOString(),
      source_files: productFiles
    },
    categories: [],
    all_products: []
  };

  let totalProducts = 0;
  let duplicatesFound = 0;
  const uniqueProducts = new Map(); // Para eliminar duplicados por ASIN
  const duplicatesByCategory = {}; // Para trackear en qué categorías aparece cada ASIN

  for (const file of productFiles) {
    try {
      const filePath = path.join(VENDOR_DIR, file);
      const categoryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Agregar categoría
      consolidated.categories.push({
        name: categoryData.metadata.category_name,
        products_count: categoryData.metadata.total_products,
        source_file: file
      });

      // Procesar productos eliminando duplicados por ASIN
      if (categoryData.products && Array.isArray(categoryData.products)) {
        categoryData.products.forEach(product => {
          const asin = product.asin;
          
          // Trackear categorías donde aparece este ASIN
          if (!duplicatesByCategory[asin]) {
            duplicatesByCategory[asin] = [];
          }
          duplicatesByCategory[asin].push(categoryData.metadata.category_name);

          // Solo mantener la primera ocurrencia de cada ASIN
          if (!uniqueProducts.has(asin)) {
            uniqueProducts.set(asin, {
              ...product,
              category: categoryData.metadata.category_name,
              also_appears_in: [] // Se llenará después
            });
          } else {
            duplicatesFound++;
          }
          
          totalProducts++;
        });
      }

    } catch (error) {
      console.warn(`⚠️ Error consolidando ${file}: ${error.message}`);
    }
  }

  // Agregar información de categorías múltiples a cada producto
  uniqueProducts.forEach((product, asin) => {
    const categories = duplicatesByCategory[asin];
    if (categories.length > 1) {
      // Mantener la primera categoría como principal, las demás como alternativas
      product.also_appears_in = categories.filter(cat => cat !== product.category);
    }
  });

  // Convertir Map a array
  consolidated.all_products = Array.from(uniqueProducts.values());

  // Actualizar metadatos con información de deduplicación
  consolidated.metadata.total_products_before_deduplication = totalProducts;
  consolidated.metadata.unique_products = consolidated.all_products.length;
  consolidated.metadata.duplicates_removed = duplicatesFound;
  consolidated.metadata.deduplication_stats = {
    total_extracted: totalProducts,
    unique_asins: consolidated.all_products.length,
    duplicates_eliminated: duplicatesFound,
    deduplication_rate: `${((duplicatesFound / totalProducts) * 100).toFixed(1)}%`
  };

  fs.writeFileSync(CONSOLIDATED_FILE, JSON.stringify(consolidated, null, 2));

  // === GENERAR CSV ===
  const CONSOLIDATED_CSV = CONSOLIDATED_FILE.replace(/\.json$/, '.csv');
  const csvHeaders = [
    'asin',
    'title',
    'price',
    'category',
    'also_appears_in',
    'extracted_at'
  ];
  const escapeCsv = (val) => {
    if (val == null) return '';
    const s = String(val).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const csvRows = [csvHeaders.join(',')];
  consolidated.all_products.forEach(prod => {
    csvRows.push([
      escapeCsv(prod.asin),
      escapeCsv(prod.title),
      escapeCsv(prod.price),
      escapeCsv(prod.category),
      escapeCsv((prod.also_appears_in || []).join('|')),
      escapeCsv(prod.extracted_at)
    ].join(','));
  });
  fs.writeFileSync(CONSOLIDATED_CSV, csvRows.join('\n'), 'utf8');

  console.log(`✅ Consolidación completada:`);
  console.log(`📦 Total productos extraídos: ${totalProducts}`);
  console.log(`🎯 Productos únicos (sin duplicados): ${consolidated.all_products.length}`);
  console.log(`🔄 Duplicados eliminados: ${duplicatesFound}`);
  console.log(`📊 Tasa de deduplicación: ${((duplicatesFound / totalProducts) * 100).toFixed(1)}%`);
  console.log(`📂 Total categorías: ${consolidated.categories.length}`);
  console.log(`💾 Archivo consolidado: ${CONSOLIDATED_FILE}`);
  console.log(`📄 CSV generado: ${CONSOLIDATED_CSV}`);
}

/**
 * Función principal
 */
async function processVendorCategories() {
  console.log('🏭 === PROCESADOR DE CATEGORÍAS POR VENDEDOR ===');
  console.log(`🎯 Vendedor: ${SELLER_ID}`);
  console.log(`📁 Directorio: ${VENDOR_DIR}`);

  // Cargar progreso existente
  let progress = loadProgress();
  console.log(`📊 Estado actual: ${progress.status}`);
  console.log(`✅ Categorías completadas: ${progress.categories_completed.length}`);

  // Cargar categorías del vendedor
  const categories = loadVendorCategories();
  
  // Determinar categorías pendientes
  const completedNames = progress.categories_completed.map(c => c.name);
  const pendingCategories = categories.filter(cat => 
    !completedNames.includes(cat.name)
  );

  console.log(`⏳ Categorías pendientes: ${pendingCategories.length}`);

  if (pendingCategories.length === 0) {
    console.log('🎉 Todas las categorías ya están procesadas');
    consolidateProducts();
    return;
  }

  // Procesar categorías pendientes
  progress.status = 'processing';
  progress.categories_pending = pendingCategories.map(c => c.name);
  saveProgress(progress);

  for (let i = 0; i < pendingCategories.length; i++) {
    const category = pendingCategories[i];
    console.log(`\n📂 [${i + 1}/${pendingCategories.length}] Procesando: ${category.name}`);
    console.log(`📊 Productos esperados: ${category.expected_products}`);

    try {
      await executeExtractProducts(category.url, category.name);
      
      // Marcar como completada
      progress.categories_completed.push({
        name: category.name,
        completed_at: new Date().toISOString(),
        expected_products: category.expected_products
      });

      // Actualizar pendientes
      progress.categories_pending = progress.categories_pending.filter(name => name !== category.name);
      saveProgress(progress);

      console.log(`✅ ${category.name} marcada como completada`);

      // Pausa entre categorías
      if (i < pendingCategories.length - 1) {
        const waitTime = 2000 + Math.random() * 3000;
        console.log(`⏸️ Pausa entre categorías: ${Math.round(waitTime)}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

    } catch (error) {
      console.error(`❌ Error procesando ${category.name}: ${error.message}`);
      progress.status = 'error';
      progress.last_error = {
        category: category.name,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      saveProgress(progress);
      
      console.log('💾 Progreso guardado. Puedes reanudar ejecutando el mismo comando.');
      process.exit(1);
    }
  }

  // Todas las categorías completadas
  progress.status = 'completed';
  progress.categories_pending = [];
  saveProgress(progress);

  console.log('\n🎉 === TODAS LAS CATEGORÍAS COMPLETADAS ===');
  
  // Consolidar productos
  consolidateProducts();
  
  console.log(`\n🚀 Vendedor ${SELLER_ID} listo para la siguiente fase`);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  processVendorCategories().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { processVendorCategories };