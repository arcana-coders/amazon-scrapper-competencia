const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// ========== CONFIGURACIÓN ==========
const DATA_DIR = path.join(__dirname, 'data');
const VENDORS_DIR = path.join(DATA_DIR, 'vendors');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Crear directorios base si no existen
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

if (!fs.existsSync(VENDORS_DIR)) fs.mkdirSync(VENDORS_DIR);

// ====== FUNCIONES DE UTILIDAD ==========

/**
 * Extraer SELLER_ID de una URL de Amazon
 */
function extractSellerIdFromUrl(url) {
  const match = url.match(/[?&]me=([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

/**
 * Validar SELLER_ID
 */
function isValidSellerId(sellerId) {
  return /^[A-Z0-9]{10,}$/.test(sellerId);
}

/**
 * Cargar o crear archivo de proyectos
 */
function loadProjects() {
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    } catch (error) {
      console.log('⚠️ Error cargando proyectos, creando nuevo archivo');
    }
  }
  
  return {
    projects: {},
    last_updated: new Date().toISOString()
  };
}

/**
 * Guardar archivo de proyectos
 */
function saveProjects(projects) {
  projects.last_updated = new Date().toISOString();
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

/**
 * Encontrar archivo de plan para un vendedor en su carpeta específica
 */
function findPlanFile(sellerId) {
  const vendorDir = path.join(DATA_DIR, 'vendors', sellerId);
  if (!fs.existsSync(vendorDir)) {
    return null;
  }
  const files = fs.readdirSync(vendorDir);
  const planFile = files.find(file => file.includes('plan.json'));
  return planFile ? path.join(vendorDir, planFile) : null;
}

function isProductPendingUsVerification(product) {
  const fecha = product.fecha_verificacion_usa;
  if (!fecha) {
    return true;
  }

  const ahora = new Date();
  const fechaVerificacion = new Date(fecha);
  const dias = (ahora - fechaVerificacion) / (1000 * 60 * 60 * 24);
  if (dias > 7) {
    return true;
  }

  const disponibilidad = (product.disponibilidad_usa || '').toLowerCase();
  const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
  const missingCriticos = (!product.precio_actual_usd && !product.vendedor_actual_usa) && !product.error_verificacion_usa;

  return requiereDatos && missingCriticos;
}

/**
 * Determinar fase actual del proyecto con detalle granular
 */
function determineCurrentPhase(project, sellerId) {
  // Fase 0: No iniciado
  if (!project.analysis_completed) {
    return {
      phase: 0,
      name: 'NO_INICIADO',
      description: 'Proyecto no iniciado',
      next_action: 'ANALYSIS',
      can_continue: false
    };
  }
  
  // Fase 1: Análisis completado, plan pendiente
  if (!project.plan_created) {
    return {
      phase: 1,
      name: 'ANALYSIS_DONE',
      description: 'Análisis completado, crear plan',
      next_action: 'CREATE_PLAN',
      can_continue: true
    };
  }
  
  // Fase 2: Plan creado, scraping pendiente o en progreso
  const planFile = findPlanFile(sellerId);
  if (planFile) {
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    const completed = plan.categories.filter(cat => cat.status === 'completed').length;
    const total = plan.categories.length;
    const pending = plan.categories.filter(cat => cat.status !== 'completed');
    
    if (completed < total) {
      // Encontrar la próxima categoría a procesar
      const nextCategory = pending[0];
      return {
        phase: 2,
        name: 'SCRAPING_IN_PROGRESS',
        description: `Scraping en progreso (${completed}/${total} categorías)`,
        next_action: 'CONTINUE_SCRAPING',
        progress: { 
          completed, 
          total, 
          pending: pending.length,
          next_category: nextCategory ? nextCategory.name : null,
          percentage: Math.round((completed / total) * 100)
        },
        can_continue: true
      };
    } else {
      return {
        phase: 3,
        name: 'SCRAPING_COMPLETED',
        description: 'Scraping completado, iniciando extracción de productos',
        next_action: 'EXTRACT_PRODUCTS',
        progress: { completed, total, percentage: 100 },
        can_continue: true
      };
    }
  }
  
  // Fase 3: Scraping completado, verificar extracción de productos
  if (!project.products_extraction_completed) {
    return {
      phase: 4,
      name: 'EXTRACTING_PRODUCTS',
      description: 'Extrayendo ASINs, títulos y precios de productos',
      next_action: 'CONTINUE_PRODUCT_EXTRACTION',
      can_continue: true
    };
  }
  
  // Fase 4: Extracción completada, verificar enriquecimiento
  if (!project.enrichment_completed) {
    // Verificar si hay productos pendientes de enriquecer
    const consolidatedFile = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.json');
    if (fs.existsSync(consolidatedFile)) {
      try {
        const consolidatedData = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
        const productos = consolidatedData.all_products || consolidatedData.products || consolidatedData;
        
        if (Array.isArray(productos)) {
          const pendientes = productos.filter(p => {
            // Pendiente si nunca ha sido procesado
            if (!p.fecha_enriquecimiento) {
              return true;
            }
            // O si es muy antiguo (más de 7 días)
            const fechaEnriquecimiento = new Date(p.fecha_enriquecimiento);
            const ahora = new Date();
            const diasDiferencia = (ahora - fechaEnriquecimiento) / (1000 * 60 * 60 * 24);
            return diasDiferencia > 7;
          });
          const enriquecidos = productos.length - pendientes.length;
        
          if (pendientes.length > 0) {
            return {
              phase: 5,
              name: 'ENRICHING_PRODUCTS',
              description: `Enriqueciendo productos con datos actuales de Amazon MX (${enriquecidos}/${productos.length})`,
              next_action: 'CONTINUE_ENRICHMENT',
              progress: {
                completed: enriquecidos,
                total: productos.length,
                pending: pendientes.length,
                percentage: Math.round((enriquecidos / productos.length) * 100)
              },
              can_continue: true
            };
          } else {
            // Marcar como completado si no hay pendientes
            project.enrichment_completed = true;
            project.enrichment_date = new Date().toISOString();
            project.last_updated = new Date().toISOString();
            const projects = loadProjects();
            projects.projects[sellerId] = project;
            saveProjects(projects);
          }
        }
      } catch (error) {
        console.error(`❌ Error verificando estado de enriquecimiento: ${error.message}`);
      }
    }
  }
  
  // Fase 5: Verificación en USA
  if (!project.usa_verification_completed) {
    const consolidatedFile = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.json');
    if (fs.existsSync(consolidatedFile)) {
      try {
        const consolidatedData = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
        const productos = consolidatedData.all_products || consolidatedData.products || consolidatedData;

        if (Array.isArray(productos)) {
          const pendientesUSA = productos.filter(isProductPendingUsVerification);

          const verificados = productos.length - pendientesUSA.length;

          if (pendientesUSA.length > 0) {
            return {
              phase: 6,
              name: 'VERIFYING_USA',
              description: `Verificando productos contra Amazon USA (${verificados}/${productos.length})`,
              next_action: 'CONTINUE_USA_VERIFICATION',
              progress: {
                completed: verificados,
                total: productos.length,
                pending: pendientesUSA.length,
                percentage: Math.round((verificados / productos.length) * 100)
              },
              can_continue: true
            };
          }

          // Sin pendientes: marcar finalizado
          project.usa_verification_completed = true;
          project.usa_verification_date = new Date().toISOString();
          project.last_updated = new Date().toISOString();
          const projects = loadProjects();
          projects.projects[sellerId] = project;
          saveProjects(projects);
        }
      } catch (error) {
        console.error(`❌ Error verificando estado de verificación USA: ${error.message}`);
      }
    }
  }

  // Fase 6: Todo completado, listo para filtro de negocio
  return {
    phase: 7,
    name: 'USA_VERIFICATION_COMPLETED',
    description: 'Productos enriquecidos y verificados en Amazon USA, listo para filtrado de negocio',
    next_action: 'BUSINESS_FILTER',
    can_continue: false
  };
  
  // Fallback
  return {
    phase: 1,
    name: 'PLAN_NEEDED',
    description: 'Necesita crear plan',
    next_action: 'CREATE_PLAN',
    can_continue: true
  };
}

/**
 * Ejecutar comando y retornar promesa
 */
function executeCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`⚡ Ejecutando: node ${command} ${args.join(' ')}`);
    
    const child = spawn('node', [command, ...args], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, code });
      } else {
        reject(new Error(`Comando falló con código: ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Obtener input del usuario
 */
function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ========== FUNCIONES PRINCIPALES ==========

/**
 * Ejecutar análisis inicial
 */
async function executeAnalysis(sellerId, projects) {
  console.log(`\n🔍 === EJECUTANDO ANÁLISIS INICIAL ===`);
  
  try {
    await executeCommand('test-seller.js', [sellerId]);
    
    // Marcar análisis como completado
    if (!projects.projects[sellerId]) {
      projects.projects[sellerId] = {};
    }
    
    projects.projects[sellerId].analysis_completed = true;
    projects.projects[sellerId].analysis_date = new Date().toISOString();
    projects.projects[sellerId].last_updated = new Date().toISOString();
    
    saveProjects(projects);
    console.log(`✅ Análisis completado para ${sellerId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error en análisis: ${error.message}`);
    return false;
  }
}

/**
 * Crear plan completo
 */
async function createPlan(sellerId, projects) {
  console.log(`\n📋 === CREANDO PLAN COMPLETO ===`);
  
  try {
    await executeCommand('create-plan.js', [sellerId]);
    
    // Marcar plan como creado
    projects.projects[sellerId].plan_created = true;
    projects.projects[sellerId].plan_date = new Date().toISOString();
    projects.projects[sellerId].last_updated = new Date().toISOString();
    
    saveProjects(projects);
    console.log(`✅ Plan creado para ${sellerId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error creando plan: ${error.message}`);
    return false;
  }
}

/**
 * Ejecutar scraping de todas las categorías
 */
async function executeScraping(sellerId, projects) {
  console.log(`\n🚀 === EJECUTANDO SCRAPING AUTOMÁTICO ===`);
  
  try {
    await executeCommand('process-all-categories.js', [sellerId]);
    
    // Marcar scraping como completado
    projects.projects[sellerId].scraping_completed = true;
    projects.projects[sellerId].scraping_date = new Date().toISOString();
    projects.projects[sellerId].last_updated = new Date().toISOString();
    
    saveProjects(projects);
    console.log(`✅ Scraping completado para ${sellerId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error en scraping: ${error.message}`);
    return false;
  }
}

/**
 * Ejecutar extracción de productos (ASINs, títulos, precios)
 */
async function executeProductExtraction(sellerId, projects) {
  console.log(`\n📦 === EJECUTANDO EXTRACCIÓN DE PRODUCTOS ===`);
  
  try {
    await executeCommand('process-vendor-categories.js', [sellerId]);
    
    // Marcar extracción de productos como completado
    projects.projects[sellerId].products_extraction_completed = true;
    projects.projects[sellerId].products_extraction_date = new Date().toISOString();
    projects.projects[sellerId].last_updated = new Date().toISOString();
    
    saveProjects(projects);
    console.log(`✅ Extracción de productos completada para ${sellerId}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error en extracción de productos: ${error.message}`);
    return false;
  }
}

/**
 * Ejecutar enriquecimiento de productos en lotes
 */
async function executeEnrichment(sellerId, projects) {
  console.log(`\n💎 === EJECUTANDO ENRIQUECIMIENTO DE PRODUCTOS ===`);
  
  const consolidatedFile = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.json');
  
  if (!fs.existsSync(consolidatedFile)) {
    console.error(`❌ No se encontró archivo consolidado: ${consolidatedFile}`);
    return false;
  }
  
  try {
    // Cargar y verificar estructura del archivo
    const consolidatedData = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
    const productos = consolidatedData.all_products || consolidatedData.products || consolidatedData;
    
    if (!Array.isArray(productos)) {
      console.error(`❌ El archivo consolidado no contiene un array válido de productos`);
      return false;
    }
    
    let pendientes = productos.filter(p => {
      // Pendiente si nunca ha sido procesado
      if (!p.fecha_enriquecimiento) {
        return true;
      }
      // O si es muy antiguo (más de 7 días)
      const fechaEnriquecimiento = new Date(p.fecha_enriquecimiento);
      const ahora = new Date();
      const diasDiferencia = (ahora - fechaEnriquecimiento) / (1000 * 60 * 60 * 24);
      return diasDiferencia > 7;
    });
    
    if (pendientes.length === 0) {
      console.log(`✅ Todos los productos ya están enriquecidos`);
      projects.projects[sellerId].enrichment_completed = true;
      projects.projects[sellerId].enrichment_date = new Date().toISOString();
      projects.projects[sellerId].last_updated = new Date().toISOString();
      saveProjects(projects);
      return true;
    }
    
    console.log(`📊 Productos pendientes de enriquecimiento: ${pendientes.length}/${productos.length}`);
    
    // Procesar en lotes hasta completar
    const loteSize = 25; // Lotes más pequeños para evitar interrupciones
    let totalProcesados = 0;
    
    while (pendientes.length > 0) {
      console.log(`\n🔄 Procesando lote de ${Math.min(loteSize, pendientes.length)} productos...`);
      
      try {
        await executeCommand('enrich-products-batch.js', [sellerId, loteSize.toString()]);
        
        // Recargar archivo para verificar progreso
        const reloadedData = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
        const productosActualizados = reloadedData.all_products || reloadedData.products || reloadedData;
        const nuevosPendientes = productosActualizados.filter(p => !p.precio_actual_mx || !p.vendedor_actual_mx);
        const procesadosEnEsteLoop = pendientes.length - nuevosPendientes.length;
        
        totalProcesados += procesadosEnEsteLoop;
        pendientes = nuevosPendientes;
        
        console.log(`✅ Lote completado. Procesados: +${procesadosEnEsteLoop}, Total: ${totalProcesados}, Pendientes: ${pendientes.length}`);
        
        // Si no hay progreso, algo salió mal
        if (procesadosEnEsteLoop === 0) {
          console.warn(`⚠️ No se procesó ningún producto en este lote. Finalizando...`);
          break;
        }
        
      } catch (error) {
        console.error(`❌ Error en lote de enriquecimiento: ${error.message}`);
        // Continuar con el siguiente lote
        console.log(`🔄 Continuando con el siguiente lote...`);
      }
    }
    
    // Marcar como completado si no quedan pendientes
    if (pendientes.length === 0) {
      projects.projects[sellerId].enrichment_completed = true;
      projects.projects[sellerId].enrichment_date = new Date().toISOString();
      projects.projects[sellerId].last_updated = new Date().toISOString();
      saveProjects(projects);
      console.log(`✅ Enriquecimiento completado para ${sellerId}`);
      return true;
    } else {
      console.log(`⏳ Progreso guardado. Quedan ${pendientes.length} productos por enriquecer`);
      console.log(`🔄 Ejecuta cerebro de nuevo para continuar el enriquecimiento`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error en enriquecimiento: ${error.message}`);
    return false;
  }
}

/**
 * Ejecutar verificación de productos en Amazon USA en lotes
 */
async function executeUsVerification(sellerId, projects) {
  console.log(`\n🛫 === EJECUTANDO VERIFICACIÓN EN AMAZON USA ===`);

  const consolidatedFile = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.json');

  if (!fs.existsSync(consolidatedFile)) {
    console.error(`❌ No se encontró archivo consolidado: ${consolidatedFile}`);
    return false;
  }

  try {
    const consolidatedData = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
    const productos = consolidatedData.all_products || consolidatedData.products || consolidatedData;

    if (!Array.isArray(productos)) {
      console.error(`❌ El archivo consolidado no contiene un array válido de productos`);
      return false;
    }

    let pendientesUSA = productos.filter(isProductPendingUsVerification);

    if (pendientesUSA.length === 0) {
      console.log(`✅ Todos los productos ya fueron verificados en Amazon USA recientemente`);
      projects.projects[sellerId].usa_verification_completed = true;
      projects.projects[sellerId].usa_verification_date = new Date().toISOString();
      projects.projects[sellerId].last_updated = new Date().toISOString();
      saveProjects(projects);
      return true;
    }

    console.log(`📊 Productos pendientes de verificación USA: ${pendientesUSA.length}/${productos.length}`);

    const loteSize = 25;
    let totalProcesados = 0;

    while (pendientesUSA.length > 0) {
      console.log(`\n🔄 Procesando lote de ${Math.min(loteSize, pendientesUSA.length)} productos (USA)...`);

      try {
        await executeCommand(path.join('scripts', 'verify-products-usa-batch.js'), [sellerId, loteSize.toString()]);

        const dataActualizada = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
        const productosActualizados = dataActualizada.all_products || dataActualizada.products || dataActualizada;
        const nuevosPendientes = productosActualizados.filter(isProductPendingUsVerification);

        const procesadosLoop = pendientesUSA.length - nuevosPendientes.length;
        totalProcesados += procesadosLoop;
        pendientesUSA = nuevosPendientes;

        console.log(`✅ Lote USA completado. Procesados: +${procesadosLoop}, Total: ${totalProcesados}, Pendientes: ${pendientesUSA.length}`);

        if (procesadosLoop === 0) {
          console.warn(`⚠️ No se detectó progreso en este lote USA. Deteniendo ejecución automática.`);
          break;
        }

      } catch (error) {
        console.error(`❌ Error en lote de verificación USA: ${error.message}`);
        console.log(`🔄 Continuando con el siguiente lote USA...`);
      }
    }

    if (pendientesUSA.length === 0) {
      projects.projects[sellerId].usa_verification_completed = true;
      projects.projects[sellerId].usa_verification_date = new Date().toISOString();
      projects.projects[sellerId].last_updated = new Date().toISOString();
      saveProjects(projects);
      console.log(`✅ Verificación USA completada para ${sellerId}`);
      return true;
    }

    console.log(`⏳ Progreso USA guardado. Quedan ${pendientesUSA.length} productos por verificar`);
    console.log(`🔄 Ejecuta cerebro nuevamente para continuar con la verificación USA`);
    return false;

  } catch (error) {
    console.error(`❌ Error general en verificación USA: ${error.message}`);
    return false;
  }
}

/**
 * Mostrar estado del proyecto con información detallada
 */
function showProjectStatus(sellerId, project, phase) {
  console.log(`\n📊 === ESTADO DEL PROYECTO ===`);
  console.log(`🎯 Vendedor: ${sellerId}`);
  console.log(`📍 Fase actual: ${phase.phase} - ${phase.name}`);
  console.log(`📝 Descripción: ${phase.description}`);
  
  if (project && Object.keys(project).length > 0) {
    console.log(`\n📈 Progreso general:`);
    console.log(`   ${project.analysis_completed ? '✅' : '⏳'} Análisis inicial`);
    console.log(`   ${project.plan_created ? '✅' : '⏳'} Plan de categorías`);
    console.log(`   ${project.scraping_completed ? '✅' : '⏳'} Scraping completo`);
    console.log(`   ${project.products_extraction_completed ? '✅' : '⏳'} Extracción de productos`);
    console.log(`   ${project.enrichment_completed ? '✅' : '⏳'} Enriquecimiento MX`);
    
    if (phase.progress) {
      console.log(`\n📊 Progreso detallado:`);
      console.log(`   � Categorías: ${phase.progress.completed}/${phase.progress.total} completadas (${phase.progress.percentage}%)`);
      
      if (phase.progress.next_category) {
        console.log(`   ⏭️ Próxima categoría: ${phase.progress.next_category}`);
      }
      
      if (phase.progress.pending > 0) {
        console.log(`   ⏳ Pendientes: ${phase.progress.pending} categorías`);
      }
    }
    
    if (project.last_updated) {
      console.log(`\n🕒 Última actualización: ${new Date(project.last_updated).toLocaleString()}`);
    }
    
    // Mostrar fechas de cada fase
    if (project.analysis_date) {
      console.log(`📅 Análisis: ${new Date(project.analysis_date).toLocaleString()}`);
    }
    if (project.plan_date) {
      console.log(`📅 Plan: ${new Date(project.plan_date).toLocaleString()}`);
    }
    if (project.scraping_date) {
      console.log(`📅 Scraping: ${new Date(project.scraping_date).toLocaleString()}`);
    }
    if (project.products_extraction_date) {
      console.log(`📅 Extracción: ${new Date(project.products_extraction_date).toLocaleString()}`);
    }
    if (project.enrichment_date) {
      console.log(`📅 Enriquecimiento: ${new Date(project.enrichment_date).toLocaleString()}`);
    }
  } else {
    console.log(`\n📈 Progreso: Proyecto nuevo`);
  }
  
  console.log(`\n🎯 Acción: ${phase.next_action}`);
  
  if (phase.can_continue) {
    console.log(`🔄 Estado: Puede continuar automáticamente`);
  } else {
    console.log(`🏁 Estado: Fase completada`);
  }
}

// ========== FUNCIÓN PRINCIPAL ==========

async function cerebro() {
  console.log('🧠 === AMAZON SCRAPER CEREBRO ===');
  console.log('Sistema de orquestación inteligente - CICLO COMPLETO\n');
  
  // Obtener input del usuario
  let input;
  if (process.argv.length > 2) {
    input = process.argv[2];
  } else {
    input = await getUserInput('🔗 Ingresa el SELLER_ID o URL del vendedor: ');
  }
  
  if (!input) {
    console.error('❌ Input requerido');
    process.exit(1);
  }
  
  // Determinar SELLER_ID
  let sellerId;
  if (input.includes('amazon.com')) {
    sellerId = extractSellerIdFromUrl(input);
    if (!sellerId) {
      console.error('❌ No se pudo extraer SELLER_ID de la URL');
      process.exit(1);
    }
    console.log(`🔍 SELLER_ID extraído: ${sellerId}`);
  } else {
    sellerId = input.toUpperCase();
  }
  
  // Validar SELLER_ID
  if (!isValidSellerId(sellerId)) {
    console.error('❌ SELLER_ID inválido:', sellerId);
    process.exit(1);
  }
  
  // Cargar proyectos
  let projects = loadProjects();
  let project = projects.projects[sellerId] || {};
  
  console.log(`🎯 === INICIANDO CICLO COMPLETO PARA ${sellerId} ===`);
  
  try {
    // FASE 1: ANÁLISIS INICIAL
    if (!project.analysis_completed) {
      console.log(`\n🔍 === FASE 1: ANÁLISIS INICIAL ===`);
      const analysisSuccess = await executeAnalysis(sellerId, projects);
      if (!analysisSuccess) {
        console.error('❌ Análisis falló, deteniendo proceso');
        return;
      }
      
      // Recargar proyecto actualizado
      projects = loadProjects();
      project = projects.projects[sellerId];
      console.log(`✅ Análisis completado, continuando con plan...`);
    } else {
      console.log(`\n✅ Análisis ya completado anteriormente`);
    }
    
    // FASE 2: CREAR PLAN
    if (!project.plan_created) {
      console.log(`\n📋 === FASE 2: CREACIÓN DE PLAN ===`);
      const planSuccess = await createPlan(sellerId, projects);
      if (!planSuccess) {
        console.error('❌ Creación de plan falló, deteniendo proceso');
        return;
      }
      
      // Recargar proyecto actualizado
      projects = loadProjects();
      project = projects.projects[sellerId];
      console.log(`✅ Plan creado, continuando con scraping...`);
    } else {
      console.log(`\n✅ Plan ya creado anteriormente`);
    }
    
    // FASE 3: SCRAPING COMPLETO
    if (!project.scraping_completed) {
      console.log(`\n🚀 === FASE 3: SCRAPING AUTOMÁTICO COMPLETO ===`);
      
      // Mostrar progreso actual
      const planFile = findPlanFile(sellerId);
      if (planFile) {
        const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
        const completed = plan.categories.filter(cat => cat.status === 'completed').length;
        const total = plan.categories.length;
        console.log(`📊 Progreso actual: ${completed}/${total} categorías completadas`);
        
        if (completed < total) {
          console.log(`� Continuando scraping desde categoría ${completed + 1}...`);
        }
      }
      
      const scrapingSuccess = await executeScraping(sellerId, projects);
      if (!scrapingSuccess) {
        console.error('❌ Scraping falló o se interrumpió');
        console.log('🔄 Puedes ejecutar el comando de nuevo para continuar desde donde se quedó');
        return;
      }
      
      // Recargar proyecto actualizado
      projects = loadProjects();
      project = projects.projects[sellerId];
      console.log(`✅ Scraping completado, continuando con extracción de productos...`);
    } else {
      console.log(`\n✅ Scraping ya completado anteriormente`);
    }
    
    // FASE 4: EXTRACCIÓN DE PRODUCTOS
    if (!project.products_extraction_completed) {
      console.log(`\n📦 === FASE 4: EXTRACCIÓN DE PRODUCTOS ===`);
      
      const extractionSuccess = await executeProductExtraction(sellerId, projects);
      if (!extractionSuccess) {
        console.error('❌ Extracción de productos falló o se interrumpió');
        console.log('🔄 Puedes ejecutar el comando de nuevo para continuar desde donde se quedó');
        return;
      }
      
      // Recargar proyecto actualizado
      projects = loadProjects();
      project = projects.projects[sellerId];
      console.log(`✅ Extracción de productos completada!`);
    } else {
      console.log(`\n✅ Extracción de productos ya completada anteriormente`);
    }

    // FASE 5: ENRIQUECIMIENTO DE PRODUCTOS
    if (!project.enrichment_completed) {
      console.log(`\n💎 === FASE 5: ENRIQUECIMIENTO DE PRODUCTOS ===`);
      console.log(`📋 Esta fase enriquece cada producto con datos actuales de Amazon MX:`);
      console.log(`   • Precio actual`);
      console.log(`   • Vendedor actual`);
      console.log(`   • Estado de disponibilidad`);
      console.log(`   • Fecha de última actualización`);
      
      const enrichmentSuccess = await executeEnrichment(sellerId, projects);
      if (!enrichmentSuccess) {
        console.error('❌ Enriquecimiento falló o se interrumpió');
        console.log('🔄 Puedes ejecutar el comando de nuevo para continuar desde donde se quedó');
        return;
      }
      
      // Recargar proyecto actualizado
      projects = loadProjects();
      project = projects.projects[sellerId];
      console.log(`✅ Enriquecimiento de productos completado!`);
    } else {
      console.log(`\n✅ Enriquecimiento de productos ya completado anteriormente`);
    }

    // FASE 6: VERIFICACIÓN EN AMAZON USA
    if (!project.usa_verification_completed) {
      console.log(`\n🛫 === FASE 6: VERIFICACIÓN EN AMAZON USA ===`);
      console.log(`📋 Esta fase valida cada producto contra Amazon USA para obtener:`);
      console.log(`   • Precio actual en USD`);
      console.log(`   • Vendedor actual USA`);
      console.log(`   • Estado de disponibilidad USA`);
      console.log(`   • Fecha y errores de verificación`);

      const usaVerificationSuccess = await executeUsVerification(sellerId, projects);
      if (!usaVerificationSuccess) {
        console.error('❌ Verificación USA falló o se interrumpió');
        console.log('🔄 Puedes ejecutar el comando de nuevo para continuar desde donde se quedó');
        return;
      }

      // Recargar proyecto actualizado
      projects = loadProjects();
      project = projects.projects[sellerId];
      console.log(`✅ Verificación USA completada!`);
    } else {
      console.log(`\n✅ Verificación USA ya completada anteriormente`);
    }
    
    // === FASE 7: FILTRO DE NEGOCIO (LIMPIEZA Y OPORTUNIDADES) ===

    const consolidatedCsv = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.csv');
    const filtradoCsv = path.join(VENDORS_DIR, sellerId, 'productos-filtrados-sugeridos.csv');
    const prepScript = path.join(__dirname, 'prepare_business_csv.js');
    const busqScript = path.join(__dirname, 'buscando_productos_csv.js');

    // 1 - LIMPIEZA
    if (fs.existsSync(consolidatedCsv) && !fs.existsSync(filtradoCsv)) {
      console.log(`\n🧹 Limpiando archivo consolidado...`);
      try {
        await executeCommand(prepScript, [sellerId]);
        console.log('✅ Archivo limpio generado.\n');
      } catch (error) {
        console.error(`❌ Error durante limpieza: ${error.message}`);
        return;
      }
    } else if (fs.existsSync(filtradoCsv)) {
      console.log('✅ Archivo limpio ya existe. Continuando...');
    } else {
      console.log('⚠️ No existe archivo consolidado CSV. No es posible limpiar.');
      return;
    }

    // 2 - OPORTUNIDADES
    const oportunidadesFiles = [
      path.join(VENDORS_DIR, sellerId, 'oportunidades.csv'),
      path.join(VENDORS_DIR, sellerId, 'oportunidades_menos_50.csv'),
      path.join(VENDORS_DIR, sellerId, 'oportunidades_menos_100.csv')
    ];

    const faltanOportunidades = oportunidadesFiles.some(f=>!fs.existsSync(filtradoCsv) || !fs.existsSync(f));

    if (faltanOportunidades) {
      console.log("🎯 Buscando productos de oportunidad...");
      try {
        await executeCommand(busqScript, [sellerId]);
        console.log('✅ Archivos de oportunidades generados.');
      } catch (error) {
        console.error('❌ Error al generar oportunidades:', error.message);
        return;
      }
    } else {
      console.log('✅ Archivos de oportunidades ya existen.');
    }



    // RESULTADO FINAL
    console.log(`\n🎉 === PROCESO COMPLETO TERMINADO ===`);
    console.log(`🎯 Vendedor: ${sellerId}`);
    console.log(`✅ Todas las fases completadas exitosamente`);
    
    // Mostrar estadísticas finales del archivo de productos enriquecidos
    const enrichedFile = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.json');
    if (fs.existsSync(enrichedFile)) {
      try {
        const rawProductos = JSON.parse(fs.readFileSync(enrichedFile, 'utf8'));
        const productos = rawProductos.all_products || rawProductos.products || rawProductos;
        if (Array.isArray(productos)) {
          const enriquecidos = productos.filter(p => p.precio_actual_mx && p.vendedor_actual_mx).length;
          const verificadosUSA = productos.filter(p => p.precio_actual_usd || p.error_verificacion_usa).length;
          console.log(`📦 Total productos procesados: ${productos.length}`);
          console.log(`💎 Productos enriquecidos MX: ${enriquecidos}/${productos.length}`);
          console.log(`🛫 Productos verificados USA: ${verificadosUSA}/${productos.length}`);
        } else {
          console.log(`⚠️ Formato inesperado al calcular estadísticas finales`);
        }
        console.log(`�💾 Archivo enriquecido: ${enrichedFile}`);
      } catch (error) {
        console.log(`⚠️ Error leyendo archivo enriquecido: ${error.message}`);
      }
    }
    
    // Mostrar también estadísticas del archivo legacy si existe
    const consolidatedFile = path.join(VENDORS_DIR, sellerId, 'all-products-consolidated.json');
    if (fs.existsSync(consolidatedFile)) {
      try {
        const consolidatedData = JSON.parse(fs.readFileSync(consolidatedFile, 'utf8'));
        console.log(`📂 Total categorías procesadas: ${consolidatedData.metadata.total_categories}`);
        console.log(`💾 Archivo legacy: ${consolidatedFile}`);
      } catch (error) {
        // Ignorar errores del archivo legacy
      }
    }
    
    // Mostrar también la ruta del CSV enriquecido si existe
    const enrichedCsv = enrichedFile.replace(/\.json$/, '.csv');
    if (fs.existsSync(enrichedCsv)) {
      console.log(`📄 CSV enriquecido: ${enrichedCsv}`);
    }
    
  console.log(`📁 Todos los archivos en: ${path.join(VENDORS_DIR, sellerId)}`);
  console.log(`\n🚀 Proyecto listo para Fase 7: Filtro de negocio`);
    
  } catch (error) {
    console.error(`\n❌ Error en el proceso: ${error.message}`);
    console.log(`💾 Estado guardado. Puedes ejecutar de nuevo para continuar.`);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  cerebro().catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { cerebro };