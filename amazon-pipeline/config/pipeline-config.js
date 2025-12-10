const path = require('path');

module.exports = {
  delays: {
    entreFases: 5000,          // 5 segundos
    entreVendedores: 300000,   // 5 minutos
    entreReintentos: 60000,    // 1 minuto (reducido de 10 min)
    actualizarProgreso: 5000   // 5 segundos
  },
  
  reintentos: {
    maxIntentos: 3,
    fasesRetry: ['verificar_mx', 'verificar_usa', 'scraping']
  },
  
  // Mapeo de Fases a Scripts
  // args: Argumentos adicionales fijos (el ID del vendedor siempre va primero)
  // 
  // 🔥 NOTA IMPORTANTE: plan-batches-firefox-fixed.js ES EL SCRIPT QUE FUNCIONA
  // Este es el único script validado y probado para generar planes correctamente.
  // Ver: SCRIPT-PLAN-CORRECTO.md en la raíz del proyecto.
  scripts: {
    plan: {
      path: '../plan-batches-firefox-fixed.js',
      args: []
    },
    scraping: {
      path: '../extract-batch-products.js',
      args: ['all'] // Procesar todos los batches
    },
    consolidation: {
      path: '../consolidate-batch-products.js',
      args: ['all']
    },
    verificar_mx: {
      path: '../scripts/verify-products-mx-batch.js',
      args: [null, '20'] // Lote de 20 productos (igual que MENU)
    },
    verificar_usa: {
      path: '../scripts/verify-products-usa-batch.js',
      args: [null, '20'] // Lote de 20 productos (igual que MENU)
    },
    oportunidades: {
      path: '../generar-oportunidades-consolidadas.js',
      args: [] // Genera oportunidades consolidadas (MENU Opción [3])
    }
  },
  
  paths: {
    logs: path.join(__dirname, '..', '..', 'logs'),
    state: path.join(__dirname, '..', 'pipeline-state.json'),
    vendors: path.join(__dirname, '..', '..', 'data', 'vendors'),
    projects: path.join(__dirname, '..', '..', 'data', 'projects.json')
  },

  // Errores que causan salto inmediato (no reintentar)
  erroresCriticos: [
    'ECONNREFUSED',
    'COOKIES_EXPIRED',
    'AMAZON_BLOCKED',
    'EACCES'
  ],

  // Errores que NO vale la pena reintentar (saltar vendedor)
  erroresNoRetry: [
    'No se encontraron archivos de batch',
    'Vendedor no existe',
    'No hay batches',
    'sin plan',
    'No se encontró el directorio del vendedor'
  ]
};
