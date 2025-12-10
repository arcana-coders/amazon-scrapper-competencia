const fs = require('fs');
const path = require('path');
const config = require('../config/pipeline-config');
const manager = require('./pipeline-manager');
const logger = require('./logger');

class ProjectLoader {
  constructor() {
    this.projectsFile = config.paths.projects;
  }

  /**
   * Lee projects.json y sincroniza con la cola del pipeline
   */
  async syncWithPipeline() {
    console.log('🔄 Sincronizando con MENU/projects.json...');
    
    if (!fs.existsSync(this.projectsFile)) {
      console.log('⚠️ No se encontró projects.json. Omitiendo sincronización.');
      return;
    }

    try {
      const rawData = fs.readFileSync(this.projectsFile, 'utf8');
      const data = JSON.parse(rawData);

      // projects.json tiene estructura: { "projects": { "VENDOR_ID": { ... }, "VENDOR_ID2": { ... } } }
      // Detectar si tiene la clave "projects" o si los vendedores están en el root
      const projectsData = data.projects || data;

      const vendors = [];
      Object.keys(projectsData).forEach(key => {
        if (key !== 'last_updated' && typeof projectsData[key] === 'object') {
          // El seller_id puede estar en el objeto o ser la clave misma
          const vendorData = projectsData[key];
          const sellerId = vendorData.seller_id || key;
          vendors.push({ ...vendorData, seller_id: sellerId });
        }
      });

      let addedCount = 0;

      for (const vendor of vendors) {
        const id = vendor.seller_id;
        if (!id) continue;

        // Determinar fases necesarias
        const fases = ['plan', 'scraping', 'consolidation', 'verificar_mx', 'verificar_usa', 'oportunidades'];

        // Verificar si ya está en la cola o historial (para no duplicar)
        const enCola = manager.state.cola.some(v => v.vendedorId === id);
        // Opcional: Si ya está en historial como completado, no volver a agregar
        // A MENOS que el usuario lo fuerce. Por ahora, asumimos "si no está en cola, y no está completado en projects, agregar".
        // Pero projects.json no tiene estado "completado" claro.
        
        // Estrategia: Agregar solo si NO está en cola.
        // El pipeline ejecutará las fases. Si ya están hechas, los scripts saltarán rápido.
        
        if (!enCola) {
           // Validar si realmente necesita proceso
           // Si status es 'discovered' o 'registered', necesita plan.
           // Si 'planned', necesita scraping+.
           
           // Simplemente lo agregamos. La inteligencia de "qué falta" la manejan los scripts (idempotencia)
           // o el historial del pipeline.
           
           // Para evitar re-agregar eternamente lo que ya terminó:
           // Checar si está en historial reciente del pipeline como 'completado'
           const enHistorial = manager.state.historial.some(v => v.vendedorId === id && v.estado === 'completado');
           
           if (!enHistorial) {
             await manager.agregarVendedor(id, fases);
             addedCount++;
           }
        }
      }

      if (addedCount > 0) {
        console.log(`✅ Se agregaron ${addedCount} vendedores desde projects.json`);
        logger.logSync(addedCount);
      } else {
        console.log('✓ No hay nuevos vendedores para agregar.');
        logger.logSync(0);
      }

    } catch (error) {
      console.error('❌ Error leyendo projects.json:', error.message);
      logger.error('Error en sincronización con projects.json', error);
    }
  }
}

module.exports = new ProjectLoader();
