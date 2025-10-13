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
  
  return totalProducts;
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

module.exports = {
  getVendorDir,
  vendorDirExists,
  createVendorDir,
  listVendorFiles,
  countVendorProducts,
  getBatchFiles,
  getBatchesStatus,
  hasBatchPlan,
  isLargeVendor,
  getProgressFile,
  getVendorSummary,
  ROOT_DIR,
  VENDORS_DIR
};
