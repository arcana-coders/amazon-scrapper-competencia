/**
 * UTILIDADES DE PROJECTS
 * 
 * Funciones para gestionar projects.json
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_FILE = path.join(__dirname, '..', '..', 'data', 'projects.json');

/**
 * Cargar archivo projects.json
 */
function loadProjects() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: {} };
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    return data.projects ? data : { projects: data };
  } catch (error) {
    console.error('Error cargando projects.json:', error.message);
    return { projects: {} };
  }
}

/**
 * Guardar archivo projects.json
 */
function saveProjects(data) {
  try {
    const dir = path.dirname(PROJECTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error guardando projects.json:', error.message);
    return false;
  }
}

/**
 * Obtener lista de IDs de vendedores
 */
function listVendorIds(projectsData = null) {
  const data = projectsData || loadProjects();
  const projects = data.projects || data;
  return Object.keys(projects);
}

/**
 * Obtener información de un vendedor específico
 */
function getVendorInfo(sellerId) {
  const data = loadProjects();
  const projects = data.projects || data;
  return projects[sellerId] || null;
}

/**
 * Actualizar información de un vendedor
 */
function updateVendorInfo(sellerId, info) {
  const data = loadProjects();
  const projects = data.projects || data;
  
  projects[sellerId] = {
    ...projects[sellerId],
    ...info
  };
  
  return saveProjects({ projects });
}

/**
 * Agregar nuevo vendedor
 */
function addVendor(sellerId, info = {}) {
  const data = loadProjects();
  const projects = data.projects || data;
  
  if (projects[sellerId]) {
    return { success: false, error: 'Vendedor ya existe' };
  }
  
  projects[sellerId] = {
    seller_id: sellerId,
    registered_date: new Date().toISOString(),
    ...info
  };
  
  const saved = saveProjects({ projects });
  return { success: saved };
}

/**
 * Borrar vendedor
 */
function deleteVendor(sellerId) {
  const data = loadProjects();
  const projects = data.projects || data;
  
  if (!projects[sellerId]) {
    return { success: false, error: 'Vendedor no existe' };
  }
  
  delete projects[sellerId];
  
  const saved = saveProjects({ projects });
  return { success: saved };
}

/**
 * Contar vendedores por fase
 */
function countVendorsByPhase() {
  const data = loadProjects();
  const projects = data.projects || data;
  
  const counts = {
    total: 0,
    registered: 0,
    planned: 0,
    scraping: 0,
    scraped: 0,
    verified_usa: 0,
    opportunities: 0,
    published: 0
  };
  
  // Importar vendor-utils para detectar archivos
  const { getBatchFiles, vendorDirExists, countVendorProducts } = require('./vendor-utils');
  
  Object.keys(projects).forEach(sellerId => {
    counts.total++;
    counts.registered++;
    
    // Verificar si tiene plan (archivos de batch o productos extraídos)
    if (vendorDirExists(sellerId)) {
      const batchFiles = getBatchFiles(sellerId);
      const productCount = countVendorProducts(sellerId);
      
      if (batchFiles.length > 0 || productCount > 0) {
        counts.planned++;
        
        // Verificar si está en scraping o ya scrapeó
        if (batchFiles.length > 0) {
          // Vendedor con batches
          let completados = 0;
          for (const batchFile of batchFiles) {
            const batchNum = batchFile.number;
            const vendorDir = path.join(__dirname, '..', '..', 'data', 'vendors', sellerId);
            const consolidatedFile = path.join(vendorDir, `batch-${batchNum}-consolidated.json`);
            
            if (fs.existsSync(consolidatedFile)) {
              completados++;
            }
          }
          
          if (completados === batchFiles.length) {
            counts.scraped++;
          } else if (completados > 0) {
            counts.scraping++;
          }
        } else if (productCount > 0) {
          // Vendedor pequeño ya scrapeado
          counts.scraped++;
        }
      }
    }
  });
  
  return counts;
}

/**
 * Filtrar vendedores por criterio
 */
function filterVendors(criteria) {
  const data = loadProjects();
  const projects = data.projects || data;
  
  return Object.entries(projects)
    .filter(([id, info]) => {
      if (criteria.phase && info.phase !== criteria.phase) return false;
      if (criteria.hasBatches !== undefined && !!info.batches !== criteria.hasBatches) return false;
      if (criteria.minProducts && (info.total_products || 0) < criteria.minProducts) return false;
      if (criteria.maxProducts && (info.total_products || 0) > criteria.maxProducts) return false;
      return true;
    })
    .map(([id, info]) => ({ id, ...info }));
}

module.exports = {
  loadProjects,
  saveProjects,
  listVendorIds,
  getVendorInfo,
  updateVendorInfo,
  addVendor,
  deleteVendor,
  countVendorsByPhase,
  filterVendors,
  PROJECTS_FILE
};
