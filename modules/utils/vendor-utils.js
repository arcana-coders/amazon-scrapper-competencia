/**
 * UTILIDADES DE VENDEDORES
 * 
 * Funciones comunes para gestionar vendedores
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const VENDORS_DIR = path.join(ROOT_DIR, 'data', 'vendors');

/**
 * Obtener ruta del directorio de un vendedor
 */
function getVendorDir(sellerId) {
  return path.join(VENDORS_DIR, sellerId);
}

/**
 * Verificar si existe el directorio del vendedor
 */
function vendorDirExists(sellerId) {
  return fs.existsSync(getVendorDir(sellerId));
}

/**
 * Crear directorio del vendedor
 */
function createVendorDir(sellerId) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Listar archivos del vendedor
 */
function listVendorFiles(sellerId, pattern = null) {
  const dir = getVendorDir(sellerId);
  
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files = fs.readdirSync(dir);
  
  if (pattern) {
    return files.filter(file => file.includes(pattern));
  }
  
  return files;
}

/**
 * Contar productos del vendedor
 */
function countVendorProducts(sellerId) {
  // 1) Contar desde archivos "-products.json" (scraping bruto)
  const files = listVendorFiles(sellerId, '-products.json');
  let totalProducts = 0;
  
  files.forEach(file => {
    try {
      const filePath = path.join(getVendorDir(sellerId), file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.products && Array.isArray(data.products)) {
        totalProducts += data.products.length;
      } else if (data.metadata && data.metadata.total_products) {
        totalProducts += data.metadata.total_products;
      }
    } catch (error) {
      // Ignorar archivos con error
    }
  });
  
  if (totalProducts > 0) {
    return totalProducts;
  }
  
  // 2) Fallback: usar consolidado único si existe
  try {
    const consolidated = path.join(getVendorDir(sellerId), 'all-products-consolidated.json');
    if (fs.existsSync(consolidated)) {
      const content = JSON.parse(fs.readFileSync(consolidated, 'utf8'));
      const arr = Array.isArray(content) ? content : (content.all_products || content.products || []);
      if (Array.isArray(arr)) {
        return arr.length;
      }
    }
  } catch (e) {
    // ignorar
  }
  
  // 3) Fallback: sumar consolidado por batches si existen
  try {
    const batches = getBatchConsolidatedFiles(sellerId);
    if (batches && batches.length > 0) {
      let sum = 0;
      for (const b of batches) {
        if (b.json && fs.existsSync(b.json)) {
          try {
            const data = JSON.parse(fs.readFileSync(b.json, 'utf8'));
            const arr = Array.isArray(data) ? data : (data.all_products || data.products || []);
            if (Array.isArray(arr)) {
              sum += arr.length;
            }
          } catch (_) {
            // continuar
          }
        }
      }
      if (sum > 0) return sum;
    }
  } catch (e) {
    // ignorar
  }
  
  // 4) Último recurso: estimar usando expected_products de los planes de batches
  try {
    const batchFiles = getBatchFiles(sellerId);
    if (batchFiles.length > 0) {
      let expected = 0;
      batchFiles.forEach(batch => {
        try {
          const data = JSON.parse(fs.readFileSync(batch.path, 'utf8'));
          const categories = data.categories || [];
          expected += categories.reduce((sum, cat) => sum + (cat.expected_products || 0), 0);
        } catch (_) {
          // continuar
        }
      });
      if (expected > 0) return expected;
    }
  } catch (e) {
    // ignorar
  }
  
  return 0;
}

/**
 * Obtener archivos de batches
 */
function getBatchFiles(sellerId) {
  const files = listVendorFiles(sellerId, 'plan-batch-');
  
  return files
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/batch-(\d+)/)?.[1] || 0);
      const numB = parseInt(b.match(/batch-(\d+)/)?.[1] || 0);
      return numA - numB;
    })
    .map(file => {
      const num = parseInt(file.match(/batch-(\d+)/)?.[1] || 0);
      return {
        filename: file,
        path: path.join(getVendorDir(sellerId), file),
        number: num
      };
    });
}

/**
 * Obtener estado de batches
 */
function getBatchesStatus(sellerId) {
  const batchFiles = getBatchFiles(sellerId);
  
  return batchFiles.map(batch => {
    try {
      const data = JSON.parse(fs.readFileSync(batch.path, 'utf8'));
      
      const categories = data.categories || [];
      const completed = categories.filter(cat => cat.status === 'completed').length;
      const total = categories.length;
      const expectedProducts = categories.reduce((sum, cat) => sum + (cat.expected_products || 0), 0);
      
      return {
        number: batch.number,
        filename: batch.filename,
        total_categories: total,
        completed_categories: completed,
        expected_products: expectedProducts,
        status: completed === total ? 'completed' : 'pending',
        progress: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    } catch (error) {
      return {
        number: batch.number,
        filename: batch.filename,
        status: 'error',
        error: error.message
      };
    }
  });
}

/**
 * Verificar si vendedor tiene plan de batches
 */
function hasBatchPlan(sellerId) {
  return getBatchFiles(sellerId).length > 0;
}

/**
 * Contar batches extraídos (batch-N-products.json existentes)
 */
function countExtractedBatches(sellerId) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) return 0;
  const batchFiles = getBatchFiles(sellerId);
  let extracted = 0;
  for (const b of batchFiles) {
    const productsPath = path.join(dir, `batch-${b.number}-products.json`);
    if (fs.existsSync(productsPath)) extracted++;
  }
  return extracted;
}

/**
 * Contar batches consolidados (batch-N-consolidated.json existentes)
 */
function countConsolidatedBatches(sellerId) {
  const batches = getBatchConsolidatedFiles(sellerId);
  if (!batches || batches.length === 0) return 0;
  return batches.filter(b => b.json && fs.existsSync(b.json)).length;
}

/**
 * Verificar si vendedor tiene plan simple (YYYY-MM-DD-plan.json)
 */
function hasSimplePlan(sellerId) {
  const files = listVendorFiles(sellerId);
  return files.some(f => /^\d{4}-\d{2}-\d{2}-plan\.json$/.test(f));
}

/**
 * Verificar si vendedor tiene cualquier tipo de plan (simple o batches)
 */
function hasAnyPlan(sellerId) {
  return hasBatchPlan(sellerId) || hasSimplePlan(sellerId);
}

/**
 * Verificar si vendedor es "grande" (> 1000 productos esperados)
 */
function isLargeVendor(sellerId) {
  const batchFiles = getBatchFiles(sellerId);
  
  if (batchFiles.length === 0) {
    return false;
  }
  
  let totalExpected = 0;
  
  batchFiles.forEach(batch => {
    try {
      const data = JSON.parse(fs.readFileSync(batch.path, 'utf8'));
      const categories = data.categories || [];
      totalExpected += categories.reduce((sum, cat) => sum + (cat.expected_products || 0), 0);
    } catch (error) {
      // Ignorar
    }
  });
  
  return totalExpected > 1000;
}

/**
 * Obtener archivo de progreso
 */
function getProgressFile(sellerId) {
  const progressPath = path.join(getVendorDir(sellerId), 'progress.json');
  
  if (!fs.existsSync(progressPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

/**
 * Obtener resumen del vendedor
 */
function getVendorSummary(sellerId) {
  const dir = getVendorDir(sellerId);
  const exists = fs.existsSync(dir);
  
  if (!exists) {
    return {
      sellerId,
      exists: false
    };
  }
  
  const progress = getProgressFile(sellerId);
  const batches = getBatchesStatus(sellerId);
  const hasBatches = batches.length > 0;
  const productsCount = countVendorProducts(sellerId);
  
  return {
    sellerId,
    exists: true,
    has_batches: hasBatches,
    is_large: isLargeVendor(sellerId),
    batches_count: batches.length,
    batches_status: batches,
    products_count: productsCount,
    progress: progress,
    files: {
      total: listVendorFiles(sellerId).length,
      products: listVendorFiles(sellerId, '-products.json').length,
      intelligent: listVendorFiles(sellerId, 'intelligent-').length,
      batches: listVendorFiles(sellerId, 'plan-batch-').length
    }
  };
}

/**
 * Obtener archivos consolidados de batches
 * Retorna lista de archivos batch-N-consolidated.csv
 */
function getBatchConsolidatedFiles(sellerId) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files = fs.readdirSync(dir);
  const batchFiles = files
    .filter(f => f.match(/^batch-\d+-consolidated\.(json|csv)$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/batch-(\d+)-/)[1]);
      const numB = parseInt(b.match(/batch-(\d+)-/)[1]);
      return numA - numB;
    });
  
  // Agrupar por batch number
  const batches = {};
  batchFiles.forEach(file => {
    const match = file.match(/batch-(\d+)-consolidated\.(json|csv)$/);
    if (match) {
      const batchNum = match[1];
      const ext = match[2];
      if (!batches[batchNum]) {
        batches[batchNum] = { number: batchNum, json: null, csv: null };
      }
      batches[batchNum][ext] = path.join(dir, file);
    }
  });
  
  return Object.values(batches);
}

/**
 * Obtener archivos de oportunidades de un batch específico
 */
function getBatchOpportunitiesFiles(sellerId, batchNum) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) {
    return null;
  }
  
  const result = {
    batchNumber: batchNum,
    filtradosSugeridos: null,
    oportunidades: null,
    oportunidadesMenos50: null,
    oportunidadesMenos100: null
  };
  
  const prefix = batchNum ? `batch-${batchNum}-` : '';
  
  const filtrados = path.join(dir, `${prefix}productos-filtrados-sugeridos.csv`);
  const opor1 = path.join(dir, `${prefix}oportunidades.csv`);
  const opor2 = path.join(dir, `${prefix}oportunidades_menos_50.csv`);
  const opor3 = path.join(dir, `${prefix}oportunidades_menos_100.csv`);
  
  if (fs.existsSync(filtrados)) result.filtradosSugeridos = filtrados;
  if (fs.existsSync(opor1)) result.oportunidades = opor1;
  if (fs.existsSync(opor2)) result.oportunidadesMenos50 = opor2;
  if (fs.existsSync(opor3)) result.oportunidadesMenos100 = opor3;
  
  return result;
}

/**
 * Obtener TODOS los archivos de oportunidades (todos los batches + vendedor pequeño)
 */
function getAllOpportunitiesFiles(sellerId) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  const files = fs.readdirSync(dir);
  const opportunities = [];
  
  // Buscar archivos sin prefijo de batch (vendedor pequeño)
  const smallVendor = getBatchOpportunitiesFiles(sellerId, null);
  if (smallVendor.oportunidades || smallVendor.oportunidadesMenos50 || smallVendor.oportunidadesMenos100) {
    opportunities.push({
      type: 'small-vendor',
      batchNumber: null,
      ...smallVendor
    });
  }
  
  // Buscar archivos con prefijo batch-N-
  const batchNums = new Set();
  files.forEach(file => {
    const match = file.match(/^batch-(\d+)-oportunidades/);
    if (match) {
      batchNums.add(match[1]);
    }
  });
  
  batchNums.forEach(batchNum => {
    const batchOpportunities = getBatchOpportunitiesFiles(sellerId, batchNum);
    if (batchOpportunities.oportunidades || batchOpportunities.oportunidadesMenos50 || batchOpportunities.oportunidadesMenos100) {
      opportunities.push({
        type: 'batch',
        ...batchOpportunities
      });
    }
  });
  
  return opportunities;
}

/**
 * Obtener estado de verificación USA de un batch
 */
function getVerificationStatus(sellerId, batchNum = null) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) {
    return null;
  }
  
  const fileName = batchNum 
    ? `batch-${batchNum}-consolidated.json`
    : 'all-products-consolidated.json';
  
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const products = data.all_products || data.products || data;
    
    if (!Array.isArray(products)) {
      return null;
    }
    
    const total = products.length;
    const verified = products.filter(p => p.fecha_verificacion_usa).length;
    const withPrice = products.filter(p => p.precio_actual_usd).length;
    const withSeller = products.filter(p => p.vendedor_actual_usa).length;
    const withErrors = products.filter(p => p.error_verificacion_usa).length;
    const disponible = products.filter(p => p.disponibilidad_usa === 'disponible').length;
    const noDisponible = products.filter(p => p.disponibilidad_usa === 'no disponible').length;
    const noListado = products.filter(p => p.disponibilidad_usa === 'no listado').length;
    
    // Productos pendientes de verificación (lógica del script)
    const pendientes = products.filter(p => {
      const fecha = p.fecha_verificacion_usa;
      if (!fecha) return true;
      
      const dias = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24);
      if (dias > 7) return true;
      
      const disponibilidad = (p.disponibilidad_usa || '').toLowerCase();
      const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
      const missingCriticos = (!p.precio_actual_usd && !p.vendedor_actual_usa) && !p.error_verificacion_usa;
      
      return requiereDatos && missingCriticos;
    }).length;
    
    return {
      batchNumber: batchNum,
      total,
      verified,
      pending: pendientes,
      withPrice,
      withSeller,
      withErrors,
      disponible,
      noDisponible,
      noListado,
      percentage: total > 0 ? Math.round((verified / total) * 100) : 0
    };
  } catch (err) {
    return null;
  }
}

/**
 * Contar productos en archivos de oportunidades
 */
function countOpportunities(sellerId, batchNum = null) {
  const csv = require('csv-parser');
  const opportunities = getBatchOpportunitiesFiles(sellerId, batchNum);
  
  if (!opportunities) {
    return null;
  }
  
  const counts = {
    batchNumber: batchNum,
    principal: 0,
    menos50: 0,
    menos100: 0,
    total: 0
  };
  
  // Función helper para contar líneas de un CSV
  const countCsvLines = (filePath) => {
    return new Promise((resolve, reject) => {
      if (!filePath || !fs.existsSync(filePath)) {
        resolve(0);
        return;
      }
      
      let count = 0;
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', () => count++)
        .on('end', () => resolve(count))
        .on('error', () => resolve(0));
    });
  };
  
  // Retornar una promesa que cuenta todos los archivos
  return Promise.all([
    countCsvLines(opportunities.oportunidades),
    countCsvLines(opportunities.oportunidadesMenos50),
    countCsvLines(opportunities.oportunidadesMenos100)
  ]).then(([principal, menos50, menos100]) => {
    counts.principal = principal;
    counts.menos50 = menos50;
    counts.menos100 = menos100;
    counts.total = principal + menos50 + menos100;
    return counts;
  });
}

/**
 * Detectar fase actual del vendedor basándose en archivos existentes
 */
function detectVendorPhase(sellerId) {
  const dir = getVendorDir(sellerId);
  if (!fs.existsSync(dir)) {
    return { phase: 0, label: '📋 Registrado', ready: false };
  }
  
  // Verificar si tiene batches consolidados
  const batches = getBatchConsolidatedFiles(sellerId);
  
  if (batches.length === 0) {
    // Verificar si tiene all-products-consolidated
    const allProductsFile = path.join(dir, 'all-products-consolidated.json');
    if (!fs.existsSync(allProductsFile)) {
      return { phase: 1, label: '📋 Registrado', ready: false };
    }
  }
  
  // Verificar estado de verificaciones
  const consolidatedFiles = batches.length > 0 
    ? batches.map(b => b.json).filter(f => f !== null)
    : [path.join(dir, 'all-products-consolidated.json')];
  
  let totalProductos = 0;
  let verificadosMX = 0;
  let verificadosUSA = 0;
  let conOportunidades = 0;
  
  for (const file of consolidatedFiles) {
    if (fs.existsSync(file)) {
      try {
        const fileContent = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const data = Array.isArray(fileContent) ? fileContent : fileContent.all_products;
        
        if (Array.isArray(data)) {
          totalProductos += data.length;
          
          // MX: cuenta como verificado si tiene disponibilidad_mx (el campo que realmente se usa)
          verificadosMX += data.filter(p => p.disponibilidad_mx).length;
          
          // USA: cuenta como verificado si tiene fecha_verificacion_usa (snapshot único)
          // No se requiere re-verificación - una vez verificado, siempre verificado
          verificadosUSA += data.filter(p => p.fecha_verificacion_usa).length;
        }
      } catch (e) {
        // Ignorar errores de lectura
      }
    }
  }
  
  // Verificar archivos de oportunidades
  const opportunitiesFiles = getAllOpportunitiesFiles(sellerId);
  const hasOpportunities = opportunitiesFiles.length > 0;
  
  if (totalProductos === 0) {
    return { phase: 1, label: '📦 Sin productos', ready: false };
  }
  
  // Determinar fase según verificaciones
  const mxComplete = verificadosMX === totalProductos;
  const usaComplete = verificadosUSA === totalProductos;
  
  if (hasOpportunities) {
    return { 
      phase: 5, 
      label: '✅ Con oportunidades',
      ready: true,
      stats: { total: totalProductos, mx: verificadosMX, usa: verificadosUSA }
    };
  } else if (usaComplete) {
    return { 
      phase: 4, 
      label: '🇺🇸 Listo para oportunidades',
      ready: true,
      stats: { total: totalProductos, mx: verificadosMX, usa: verificadosUSA }
    };
  } else if (mxComplete) {
    return { 
      phase: 3, 
      label: '🇲🇽 Verificado MX', 
      ready: false,
      stats: { total: totalProductos, mx: verificadosMX, usa: verificadosUSA }
    };
  } else if (verificadosMX > 0) {
    return { 
      phase: 3, 
      label: `🔄 Verificando MX (${verificadosMX}/${totalProductos})`, 
      ready: false,
      stats: { total: totalProductos, mx: verificadosMX, usa: verificadosUSA }
    };
  } else {
    return { 
      phase: 2, 
      label: '📦 Consolidado',
      ready: false,
      stats: { total: totalProductos, mx: verificadosMX, usa: verificadosUSA }
    };
  }
}

module.exports = {
  getVendorDir,
  vendorDirExists,
  createVendorDir,
  listVendorFiles,
  countVendorProducts,
  getBatchFiles,
  getBatchesStatus,
  hasBatchPlan,
  countExtractedBatches,
  countConsolidatedBatches,
  hasSimplePlan,
  hasAnyPlan,
  isLargeVendor,
  getProgressFile,
  getVendorSummary,
  getBatchConsolidatedFiles,
  getBatchOpportunitiesFiles,
  getAllOpportunitiesFiles,
  getVerificationStatus,
  countOpportunities,
  detectVendorPhase,
  ROOT_DIR,
  VENDORS_DIR
};
