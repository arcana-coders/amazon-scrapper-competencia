#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const ROOT_DIR = __dirname;
const PROJECTS_FILE = path.join(ROOT_DIR, 'data', 'projects.json');
const VENDORS_DIR = path.join(ROOT_DIR, 'data', 'vendors');

const FAST_MODE = ['1', 'true', 'yes'].includes((process.env.FAST_PANEL || '').toLowerCase());
const DEFAULT_CHAR_DELAY = FAST_MODE ? 0 : 30;
const DEFAULT_LINE_DELAY = FAST_MODE ? 0 : 80;
const CARD_WIDTH = 58;

function sleep(ms) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typewrite(text, charDelay = DEFAULT_CHAR_DELAY) {
  if (charDelay <= 0) {
    process.stdout.write(text);
    return;
  }
  for (const char of text) {
    process.stdout.write(char);
    // Pequeña pausa para efecto máquina de escribir
    // eslint-disable-next-line no-await-in-loop
    await sleep(charDelay);
  }
}

async function typewriteLine(text = '', options = {}) {
  const { charDelay = DEFAULT_CHAR_DELAY, lineDelay = DEFAULT_LINE_DELAY, instant = false } = options;
  if (instant || charDelay <= 0) {
    console.log(text);
    if (lineDelay > 0) {
      await sleep(lineDelay);
    }
    return;
  }
  await typewrite(text, charDelay);
  process.stdout.write('\n');
  if (lineDelay > 0) {
    await sleep(lineDelay);
  }
}

function formatValue(value, maxLength = 38) {
  const text = value == null ? '—' : String(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

function buildFieldLine(label, value) {
  const cleanLabel = label.padEnd(16, ' ');
  const cleanValue = formatValue(value);
  return `│ ${cleanLabel}: ${cleanValue}`;
}

const PHASES = [
  { key: 'analysis_completed', label: 'Análisis inicial' },
  { key: 'plan_created', label: 'Plan jerárquico' },
  { key: 'scraping_completed', label: 'Scraping' },
  { key: 'products_extraction_completed', label: 'Consolidación' },
  { key: 'enrichment_completed', label: 'Enriquecimiento MX' },
  { key: 'usa_verification_completed', label: 'Verificación USA' },
  { key: 'business_filtering_completed', label: 'Filtrado de negocio' },
  { key: 'publication_requested', label: 'Publicación solicitada' }
];

const MENU_OPTIONS = {
  DETAILS: '1',
  FILES: '2',
  REFRESH: '3',
  WORKFLOW: '4',
  INCREMENTAL: '6',
  REGISTER: '7',
  PUBLISH: '5',
  EXIT: '0'
};

function readProjectsFile() {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return {
      projects: {},
      last_updated: new Date().toISOString()
    };
  }

  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch (error) {
    console.error('No pude interpretar data/projects.json. Comenzando con estructura vacía.');
    return {
      projects: {},
      last_updated: new Date().toISOString()
    };
  }
}

function saveProjectsFile(data) {
  const payload = {
    projects: data.projects || {},
    last_updated: new Date().toISOString()
  };
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(payload, null, 2));
}

// ==================== FASE 4: PUBLICACIÓN ====================

function detectVendorsWithOpportunities() {
  if (!fs.existsSync(VENDORS_DIR)) {
    return [];
  }

  const vendors = [];
  const sellers = fs.readdirSync(VENDORS_DIR);

  for (const sellerId of sellers) {
    const vendorDir = path.join(VENDORS_DIR, sellerId);
    const stat = fs.statSync(vendorDir);
    
    if (!stat.isDirectory()) {
      continue;
    }

    const files = {
      oportunidades: path.join(vendorDir, 'oportunidades.csv'),
      menos_50: path.join(vendorDir, 'oportunidades_menos_50.csv'),
      menos_100: path.join(vendorDir, 'oportunidades_menos_100.csv')
    };

    const available = {};
    let hasAny = false;

    if (fs.existsSync(files.oportunidades)) {
      available.oportunidades = true;
      hasAny = true;
    }
    if (fs.existsSync(files.menos_50)) {
      available.menos_50 = true;
      hasAny = true;
    }
    if (fs.existsSync(files.menos_100)) {
      available.menos_100 = true;
      hasAny = true;
    }

    if (hasAny) {
      vendors.push({
        sellerId,
        files: available
      });
    }
  }

  return vendors;
}

function getPublicationStatus(sellerId, option) {
  const projectsData = readProjectsFile();
  const project = projectsData.projects?.[sellerId];
  
  if (!project || !project.publication_requests) {
    return null;
  }

  const fileKey = option === '1' ? 'oportunidades' : option === '2' ? 'menos_50' : 'menos_100';
  return project.publication_requests[fileKey] || null;
}

function markPublicationRequested(sellerId, option) {
  const projectsData = readProjectsFile();
  
  if (!projectsData.projects) {
    projectsData.projects = {};
  }
  if (!projectsData.projects[sellerId]) {
    projectsData.projects[sellerId] = {};
  }
  if (!projectsData.projects[sellerId].publication_requests) {
    projectsData.projects[sellerId].publication_requests = {};
  }

  const fileKey = option === '1' ? 'oportunidades' : option === '2' ? 'menos_50' : 'menos_100';
  projectsData.projects[sellerId].publication_requests[fileKey] = {
    requested_at: new Date().toISOString(),
    option: option
  };

  saveProjectsFile(projectsData);
}

async function handlePublishOption(rl) {
  await typewriteLine('');
  await typewriteLine('🚀 FASE 4: PUBLICACIÓN DE OPORTUNIDADES', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('¿Qué acción deseas realizar?', { charDelay: 12 });
  await typewriteLine('[1] 📤 Solicitar plantilla a Amazon', { charDelay: 10 });
  await typewriteLine('[2] 📥 Descargar plantilla generada', { charDelay: 10 });
  await typewriteLine('[3] 📝 Llenar plantilla con precios', { charDelay: 10 });
  await typewriteLine('[4] 📤 Subir plantilla a Amazon', { charDelay: 10 });
  await typewriteLine('[5] 📊 Consultar estado de publicación', { charDelay: 10 });
  await typewriteLine('[0] ← Volver al menú principal', { charDelay: 10 });
  await typewriteLine('');

  const action = await ask('Opción: ', rl);

  if (action === '1') {
    await handleSolicitarPlantilla(rl);
  } else if (action === '2') {
    await handleDescargarPlantilla(rl);
  } else if (action === '3') {
    await handleLlenarPlantilla(rl);
  } else if (action === '4') {
    await handleSubirPlantilla(rl);
  } else if (action === '5') {
    await handleConsultarEstado(rl);
  } else {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
  }
}

async function handleSolicitarPlantilla(rl) {
  await typewriteLine('');
  await typewriteLine('📤 SOLICITAR PLANTILLA A AMAZON', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const vendors = detectVendorsWithOpportunities();

  if (vendors.length === 0) {
    await typewriteLine('⚠️  No encontré vendedores con archivos de oportunidades listos.', { charDelay: 12 });
    await typewriteLine('   Asegúrate de haber ejecutado el filtrado de negocio primero.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine(`✅ Encontré ${vendors.length} vendedor(es) con oportunidades:\n`, { charDelay: 12 });

  // Mostrar vendedores disponibles
  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    await typewriteLine(`[${i + 1}] ${vendor.sellerId}`, { charDelay: 8 });
    
    const fileLabels = [];
    if (vendor.files.oportunidades) fileLabels.push('oportunidades.csv');
    if (vendor.files.menos_50) fileLabels.push('menos_50.csv');
    if (vendor.files.menos_100) fileLabels.push('menos_100.csv');
    
    await typewriteLine(`    Archivos: ${fileLabels.join(', ')}`, { charDelay: 8 });
  }

  await typewriteLine('');
  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);

  const vendorIndex = parseInt(vendorChoice, 10) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const selectedVendor = vendors[vendorIndex];
  await typewriteLine('');
  await typewriteLine(`📦 Vendedor seleccionado: ${selectedVendor.sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('Elige el archivo a solicitar:', { charDelay: 12 });

  const options = [];
  if (selectedVendor.files.oportunidades) {
    options.push({ key: '1', label: 'oportunidades.csv (precio sugerido < MX)' });
  }
  if (selectedVendor.files.menos_50) {
    options.push({ key: '2', label: 'oportunidades_menos_50.csv (sugerido -$50 < MX)' });
  }
  if (selectedVendor.files.menos_100) {
    options.push({ key: '3', label: 'oportunidades_menos_100.csv (sugerido -$100 < MX)' });
  }

  for (const opt of options) {
    const status = getPublicationStatus(selectedVendor.sellerId, opt.key);
    const statusLabel = status ? ` ✅ Ya solicitada (${new Date(status.requested_at).toLocaleString()})` : '';
    await typewriteLine(`[${opt.key}] ${opt.label}${statusLabel}`, { charDelay: 8 });
  }

  await typewriteLine('[0] Cancelar', { charDelay: 8 });
  await typewriteLine('');

  const fileChoice = await ask('Opción: ', rl);

  if (!['1', '2', '3'].includes(fileChoice)) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  // Verificar si ya fue solicitada
  const existingStatus = getPublicationStatus(selectedVendor.sellerId, fileChoice);
  if (existingStatus) {
    await typewriteLine('');
    await typewriteLine('⚠️  Esta plantilla ya fue solicitada anteriormente.', { charDelay: 12 });
    const confirm = await ask('¿Quieres solicitarla de nuevo? (s/n): ', rl);
    
    if (confirm.toLowerCase() !== 's' && confirm.toLowerCase() !== 'si') {
      await typewriteLine('Operación cancelada.', { charDelay: 12 });
      await typewriteLine('');
      return;
    }
  }

  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando solicitar-plantilla-seller.js...', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'solicitar-plantilla-seller.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, selectedVendor.sellerId, fileChoice], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Plantilla solicitada exitosamente.', { charDelay: 12 });
        markPublicationRequested(selectedVendor.sellerId, fileChoice);
        await typewriteLine('✅ Registro guardado en projects.json', { charDelay: 12 });
      } else {
        await typewriteLine(`❌ El script terminó con código de error: ${code}`, { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleDescargarPlantilla(rl) {
  await typewriteLine('');
  await typewriteLine('📥 DESCARGAR PLANTILLA GENERADA', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('⚠️  IMPORTANTE: La plantilla tarda ~30 minutos en generarse', { charDelay: 12 });
  await typewriteLine('   Asegúrate de haber solicitado la plantilla hace al menos 30 minutos.', { charDelay: 12 });
  await typewriteLine('');

  const vendors = detectVendorsWithOpportunities();

  if (vendors.length === 0) {
    await typewriteLine('⚠️  No encontré vendedores con archivos de oportunidades.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('Vendedores disponibles:', { charDelay: 12 });
  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    const status = getPublicationStatus(vendor.sellerId, '1') || 
                   getPublicationStatus(vendor.sellerId, '2') || 
                   getPublicationStatus(vendor.sellerId, '3');
    
    const statusLabel = status ? ' ✅ (plantilla solicitada)' : ' ⚠️ (sin solicitud registrada)';
    await typewriteLine(`[${i + 1}] ${vendor.sellerId}${statusLabel}`, { charDelay: 8 });
  }

  await typewriteLine('');
  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);

  const vendorIndex = parseInt(vendorChoice, 10) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const selectedVendor = vendors[vendorIndex];
  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${selectedVendor.sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando descargar-plantilla-seller.js...', { charDelay: 12 });
  await typewriteLine('   (Se abrirá el navegador para descargar la plantilla)', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'descargar-plantilla-seller.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, selectedVendor.sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Plantilla descargada exitosamente.', { charDelay: 12 });
        await typewriteLine(`📁 Revisa: data/vendors/${selectedVendor.sellerId}/plantillas/`, { charDelay: 12 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
        await typewriteLine('   Si la plantilla aún no está lista, intenta nuevamente en unos minutos.', { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleLlenarPlantilla(rl) {
  await typewriteLine('');
  await typewriteLine('📝 LLENAR PLANTILLA CON PRECIOS', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const vendors = detectVendorsWithOpportunities();

  if (vendors.length === 0) {
    await typewriteLine('⚠️  No encontré vendedores con archivos de oportunidades.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('Vendedores disponibles:', { charDelay: 12 });
  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    await typewriteLine(`[${i + 1}] ${vendor.sellerId}`, { charDelay: 8 });
  }

  await typewriteLine('');
  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);

  const vendorIndex = parseInt(vendorChoice, 10) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const selectedVendor = vendors[vendorIndex];
  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${selectedVendor.sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando llenar-plantilla-seller.js...', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'llenar-plantilla-seller.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, selectedVendor.sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Plantilla llenada exitosamente.', { charDelay: 12 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleSubirPlantilla(rl) {
  await typewriteLine('');
  await typewriteLine('📤 SUBIR PLANTILLA A AMAZON', { charDelay: 12 });
  await typewriteLine('─────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const vendors = detectVendorsWithOpportunities();

  if (vendors.length === 0) {
    await typewriteLine('⚠️  No encontré vendedores con archivos de oportunidades.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('Vendedores disponibles:', { charDelay: 12 });
  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    await typewriteLine(`[${i + 1}] ${vendor.sellerId}`, { charDelay: 8 });
  }

  await typewriteLine('');
  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);

  const vendorIndex = parseInt(vendorChoice, 10) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const selectedVendor = vendors[vendorIndex];
  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${selectedVendor.sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando subir-plantilla-seller.js...', { charDelay: 12 });
  await typewriteLine('   (Se abrirá el navegador para subir la plantilla)', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'subir-plantilla-seller.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, selectedVendor.sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Plantilla subida exitosamente.', { charDelay: 12 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleConsultarEstado(rl) {
  await typewriteLine('');
  await typewriteLine('📊 CONSULTAR ESTADO DE PUBLICACIÓN', { charDelay: 12 });
  await typewriteLine('───────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const vendors = detectVendorsWithOpportunities();

  if (vendors.length === 0) {
    await typewriteLine('⚠️  No encontré vendedores con archivos de oportunidades.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('Vendedores disponibles:', { charDelay: 12 });
  for (let i = 0; i < vendors.length; i++) {
    const vendor = vendors[i];
    await typewriteLine(`[${i + 1}] ${vendor.sellerId}`, { charDelay: 8 });
  }

  await typewriteLine('');
  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);

  const vendorIndex = parseInt(vendorChoice, 10) - 1;
  if (vendorIndex < 0 || vendorIndex >= vendors.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const selectedVendor = vendors[vendorIndex];
  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${selectedVendor.sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  
  // Preguntar si quiere especificar Feed ID
  const usarFeedId = await promptYesNo('¿Tienes un Feed ID específico para consultar?', rl, false);
  
  let feedId = null;
  if (usarFeedId) {
    feedId = await ask('Feed ID: ', rl);
    await typewriteLine('');
  }

  await typewriteLine('🔄 Ejecutando consultar-estado-feed-seller.js...', { charDelay: 12 });
  await typewriteLine('   (Se abrirá el navegador para consultar el estado)', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'consultar-estado-feed-seller.js');
  const args = feedId ? [selectedVendor.sellerId, feedId] : [selectedVendor.sellerId];
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, ...args], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Consulta completada.', { charDelay: 12 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function printBanner() {
  await typewriteLine('', { instant: true });
  await typewriteLine('╔══════════════════════════════════════════════════════╗');
  await typewriteLine('║  🤖  Amazon Scraper · Panel de Control Central       ║');
  await typewriteLine('╠══════════════════════════════════════════════════════╣');
  await typewriteLine('║  Gestiona el flujo completo: desde el scraping hasta ║');
  await typewriteLine('║  la publicación. Controla cada fase, monitorea el    ║');
  await typewriteLine('║  avance y ejecuta acciones con un par de teclas.     ║');
  await typewriteLine('╚══════════════════════════════════════════════════════╝');
  await typewriteLine('');
}

function loadProjects() {
  const data = readProjectsFile();
  return data.projects || {};
}

function ensureProjectEntry(data, sellerId) {
  if (!data.projects) {
    data.projects = {};
  }
  if (!data.projects[sellerId]) {
    data.projects[sellerId] = {};
  }
  return data.projects[sellerId];
}

function loadConsolidatedProducts(sellerId) {
  const vendorDir = path.join(VENDORS_DIR, sellerId);
  const consolidatedPath = path.join(vendorDir, 'all-products-consolidated.json');

  if (!fs.existsSync(consolidatedPath)) {
    return { products: null, path: consolidatedPath };
  }

  try {
    const raw = fs.readFileSync(consolidatedPath, 'utf8');
    const data = JSON.parse(raw);
    const products = Array.isArray(data.all_products)
      ? data.all_products
      : Array.isArray(data.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];
    return { products, data, path: consolidatedPath };
  } catch (error) {
    console.error(`No pude interpretar ${consolidatedPath}: ${error.message}`);
    return { products: null, path: consolidatedPath };
  }
}

function getEnrichmentPending(products) {
  const now = new Date();
  return products.filter((product) => {
    if (!product || typeof product !== 'object') {
      return false;
    }
    if (!product.precio_actual_mx || !product.vendedor_actual_mx) {
      return true;
    }
    if (!product.fecha_enriquecimiento) {
      return true;
    }
    const enrichedAt = new Date(product.fecha_enriquecimiento);
    if (Number.isNaN(enrichedAt.getTime())) {
      return true;
    }
    const days = (now - enrichedAt) / (1000 * 60 * 60 * 24);
    return days > 7;
  });
}

function isProductPendingUsVerification(product) {
  if (!product || typeof product !== 'object') {
    return false;
  }

  const fecha = product.fecha_verificacion_usa;
  if (!fecha) {
    return true;
  }

  const ahora = new Date();
  const fechaVerificacion = new Date(fecha);
  if (Number.isNaN(fechaVerificacion.getTime())) {
    return true;
  }

  const dias = (ahora - fechaVerificacion) / (1000 * 60 * 60 * 24);
  if (dias > 7) {
    return true;
  }

  const disponibilidad = (product.disponibilidad_usa || '').toLowerCase();
  const requiereDatos = disponibilidad === '' || disponibilidad === 'disponible';
  const missingCriticos = (!product.precio_actual_usd && !product.vendedor_actual_usa) && !product.error_verificacion_usa;

  return requiereDatos && missingCriticos;
}

function getUsPending(products) {
  return products.filter(isProductPendingUsVerification);
}

async function runCommand(command, args = []) {
  await typewriteLine('', { instant: true });
  await typewriteLine(`⚡ Ejecutando: node ${command} ${args.join(' ')}`.trim(), { charDelay: 10 });
  return new Promise((resolve) => {
    const child = spawn('node', [command, ...args], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`El comando finalizó con código ${code}.`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error(`No se pudo iniciar el comando: ${error.message}`);
      resolve(false);
    });
  });
}

async function promptYesNo(question, rl, defaultYes = true) {
  const suffix = defaultYes ? ' (Enter = Sí / n = No): ' : ' (s = Sí / Enter = No): ';
  const answer = (await ask(question + suffix, rl)).toLowerCase();
  if (!answer) {
    return defaultYes;
  }
  return ['s', 'si', 'sí', 'y', 'yes'].includes(answer);
}

function listVendorIds(projects) {
  const projectIds = Object.keys(projects);
  if (fs.existsSync(VENDORS_DIR)) {
    const diskIds = fs.readdirSync(VENDORS_DIR).filter((name) => fs.statSync(path.join(VENDORS_DIR, name)).isDirectory());
    const merged = new Set([...projectIds, ...diskIds]);
    return Array.from(merged).sort();
  }
  return projectIds.sort();
}

function formatDate(isoString) {
  if (!isoString) {
    return '—';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const formattedDate = date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  const formattedTime = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${formattedDate} ${formattedTime}`;
}

function resolvePhaseInfo(project) {
  if (!project) {
    return { progressText: '0/8', currentLabel: 'Sin iniciar', nextLabel: PHASES[0].label };
  }

  let completed = 0;
  let currentLabel = 'Sin iniciar';
  let nextLabel = PHASES[0].label;

  // Detectar fase de filtrado de negocio (archivos de oportunidades existen)
  if (project.seller_id) {
    const vendorDir = path.join(VENDORS_DIR, project.seller_id);
    const opportunitiesFile = path.join(vendorDir, 'oportunidades.csv');
    if (fs.existsSync(opportunitiesFile)) {
      project.business_filtering_completed = true;
    }
  }

  // Detectar fase de publicación solicitada
  if (project.publication_requests && Object.keys(project.publication_requests).length > 0) {
    project.publication_requested = true;
  }

  for (let i = 0; i < PHASES.length; i += 1) {
    const phase = PHASES[i];
    if (project[phase.key]) {
      completed = i + 1;
      currentLabel = phase.label;
      nextLabel = i + 1 < PHASES.length ? PHASES[i + 1].label : '¡Proyecto completo!';
    } else {
      nextLabel = phase.label;
      break;
    }
  }

  if (completed === PHASES.length) {
    nextLabel = '¡Proyecto completo!';
  }

  return {
    progressText: `${completed}/${PHASES.length}`,
    currentLabel,
    nextLabel
  };
}

function computeVendorMetrics(sellerId) {
  const vendorDir = path.join(VENDORS_DIR, sellerId);
  const consolidatedPath = path.join(vendorDir, 'all-products-consolidated.json');
  const filteredCsvPath = path.join(vendorDir, 'productos-filtrados-sugeridos.csv');

  const metrics = {
    totalProducts: 0,
    withMxPrice: 0,
    withUsPrice: 0,
    usaErrors: 0,
    lastVerificationDate: null,
    filteredCount: null,
    topCategories: []
  };

  if (fs.existsSync(consolidatedPath)) {
    try {
      const raw = fs.readFileSync(consolidatedPath, 'utf8');
      const data = JSON.parse(raw);
      const products = Array.isArray(data.all_products) ? data.all_products : [];
      metrics.totalProducts = products.length;

      let lastVerification = null;
      const categoryCounts = Array.isArray(data.categories) ? data.categories.slice() : [];

      for (const product of products) {
        if (product && typeof product === 'object') {
          if (typeof product.precio_actual_mx === 'number' && Number.isFinite(product.precio_actual_mx)) {
            metrics.withMxPrice += 1;
          }
          if (typeof product.precio_actual_usd === 'number' && Number.isFinite(product.precio_actual_usd)) {
            metrics.withUsPrice += 1;
          }
          if (product.error_verificacion_usa) {
            metrics.usaErrors += 1;
          }
          if (product.fecha_verificacion_usa) {
            const candidate = new Date(product.fecha_verificacion_usa);
            if (!Number.isNaN(candidate.getTime())) {
              if (!lastVerification || candidate > lastVerification) {
                lastVerification = candidate;
              }
            }
          }
        }
      }

      metrics.lastVerificationDate = lastVerification ? formatDate(lastVerification.toISOString()) : '—';

      categoryCounts.sort((a, b) => (b.products_count || 0) - (a.products_count || 0));
      metrics.topCategories = categoryCounts.slice(0, 3).map((cat) => ({
        name: cat.name,
        count: cat.products_count
      }));
    } catch (error) {
      console.error(`No pude procesar ${consolidatedPath}: ${error.message}`);
    }
  }

  if (fs.existsSync(filteredCsvPath)) {
    try {
      const csvContent = fs.readFileSync(filteredCsvPath, 'utf8');
      const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
      metrics.filteredCount = lines.length > 1 ? lines.length - 1 : 0;
    } catch (error) {
      console.error(`No pude leer ${filteredCsvPath}: ${error.message}`);
    }
  }

  return metrics;
}

async function renderProjectsSummary(projectsMap) {
  const sellerIds = listVendorIds(projectsMap);
  if (sellerIds.length === 0) {
    await typewriteLine('Aún no hay proyectos registrados. Ejecuta cerebro.js para comenzar.');
    await typewriteLine('');
    return;
  }

  // Estadísticas por fase
  const statsByPhase = {};
  let totalProducts = 0;
  let totalWithMxPrice = 0;
  let totalWithUsPrice = 0;

  for (const sellerId of sellerIds) {
    const project = projectsMap[sellerId] || {};
    project.seller_id = sellerId;
    const phaseInfo = resolvePhaseInfo(project);
    const metrics = computeVendorMetrics(sellerId);

    // Contar por fase
    const phaseName = phaseInfo.currentLabel;
    if (!statsByPhase[phaseName]) {
      statsByPhase[phaseName] = [];
    }
    const storeName = project.store_name || sellerId;
    statsByPhase[phaseName].push({
      name: storeName,
      sellerId: sellerId,
      progress: phaseInfo.progressText
    });

    // Sumar totales
    totalProducts += metrics.totalProducts || 0;
    totalWithMxPrice += metrics.withMxPrice || 0;
    totalWithUsPrice += metrics.withUsPrice || 0;
  }

  // Mostrar resumen compacto
  await typewriteLine(`📊 Resumen de ${sellerIds.length} vendedor(es) registrado(s):`, { instant: true });
  await typewriteLine('');

  // Mostrar por fase
  for (const [phaseName, vendors] of Object.entries(statsByPhase)) {
    await typewriteLine(`📍 ${phaseName}: ${vendors.length} vendedor(es)`, { charDelay: 5, lineDelay: 20 });
    for (const vendor of vendors) {
      await typewriteLine(`   • ${vendor.name} (${vendor.progress})`, { charDelay: 3, lineDelay: 15 });
    }
  }

  await typewriteLine('');
  await typewriteLine(`📦 Productos totales: ${totalProducts} | MX: ${totalWithMxPrice} | USA: ${totalWithUsPrice}`, { charDelay: 5, lineDelay: 20 });
  await typewriteLine('');
}

async function explainPurpose() {
  await typewriteLine('Panel central que gestiona el flujo completo del proyecto:');
  await typewriteLine('- Fases 1-2: Scraping y consolidación de productos', { charDelay: 12 });
  await typewriteLine('- Fase 3: Filtrado de negocio y detección de oportunidades', { charDelay: 12 });
  await typewriteLine('- Fase 4: Publicación en Amazon Seller Central', { charDelay: 12 });
  await typewriteLine('- Monitorea el avance, detecta pendientes y ejecuta acciones fácilmente', { charDelay: 12 });
  await typewriteLine('');
}

async function showMenu() {
  await typewriteLine('¿Qué te gustaría hacer ahora?');
  await typewriteLine(`[${MENU_OPTIONS.DETAILS}] Revisar un vendedor en detalle`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.FILES}] Mostrar rutas y comandos útiles`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.REFRESH}] Refrescar resumen`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.WORKFLOW}] Iniciar o continuar trabajo por fases`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.PUBLISH}] 🚀 Publicar oportunidades (Fase 4)`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.INCREMENTAL}] 🔄 Sistema Incremental por Lotes`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.REGISTER}] 📝 Registrar nuevos vendedores (análisis inicial)`, { charDelay: 10 });
  await typewriteLine(`[${MENU_OPTIONS.EXIT}] Salir`, { charDelay: 10 });
}

function ask(question, rl) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function buildFileShortcuts() {
  return [
    {
      title: 'Documentación maestra',
      path: 'DOCUMENTACION-FINAL.md'
    },
    {
      title: 'Datos del proyecto',
      path: 'data/projects.json'
    },
    {
      title: 'Scripts de filtrado (fase 3)',
      path: 'prepare_business_csv.js'
    },
    {
      title: 'Detección de oportunidades',
      path: 'buscando_productos_csv.js'
    },
    {
      title: 'Orquestador completo',
      path: 'cerebro.js'
    }
  ];
}

async function printShortcuts() {
  await typewriteLine('Accesos rápidos para continuar trabajando:');
  const shortcuts = buildFileShortcuts();
  for (const [idx, item] of shortcuts.entries()) {
    // eslint-disable-next-line no-await-in-loop
  await typewriteLine(` ${idx + 1}. ${item.title} → ${item.path}`, { charDelay: 10, lineDelay: 35 });
  }
  await typewriteLine('');
  await typewriteLine('Comandos sugeridos para preparar Fase 3:');
  await typewriteLine('  node prepare_business_csv.js <SELLER_ID>', { charDelay: 10 });
  await typewriteLine('  node buscando_productos_csv.js <SELLER_ID>', { charDelay: 10 });
  await typewriteLine('');
}

async function renderVendorDetail(sellerId, projectsMap) {
  const project = projectsMap[sellerId] || {};
  project.seller_id = sellerId;
  const phaseInfo = resolvePhaseInfo(project);
  const metrics = computeVendorMetrics(sellerId);
  const vendorDir = path.join(VENDORS_DIR, sellerId);
  const filteredCsvPath = path.join(vendorDir, 'productos-filtrados-sugeridos.csv');
  const opportunitiesPath = path.join(vendorDir, 'oportunidades.csv');
  const opportunities50Path = path.join(vendorDir, 'oportunidades_menos_50.csv');
  const opportunities100Path = path.join(vendorDir, 'oportunidades_menos_100.csv');

  const storeName = project.store_name || sellerId;
  
  await typewriteLine('');
  await typewriteLine(`┏━━━━━━━━━━━━━━━━━━━━━ ${storeName} ━━━━━━━━━━━━━━━━━━━━━`);
  await typewriteLine(buildFieldLine('Seller ID', sellerId));
  await typewriteLine(buildFieldLine('Avance', `${phaseInfo.progressText} (${phaseInfo.currentLabel})`));
  await typewriteLine(buildFieldLine('Siguiente', phaseInfo.nextLabel));
  await typewriteLine(buildFieldLine('Última act.', project && project.last_updated ? formatDate(project.last_updated) : '—'));
  await typewriteLine('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await typewriteLine('┃ Dataset consolidado');
  await typewriteLine(buildFieldLine('Totales', metrics.totalProducts));
  await typewriteLine(buildFieldLine('Precio MX', metrics.withMxPrice));
  await typewriteLine(buildFieldLine('Precio USA', metrics.withUsPrice));
  await typewriteLine(buildFieldLine('Errores USA', metrics.usaErrors));
  await typewriteLine(buildFieldLine('Última verif.', metrics.lastVerificationDate));
  if (metrics.topCategories.length > 0) {
    await typewriteLine('┃ Top categorías');
    for (const [idx, cat] of metrics.topCategories.entries()) {
      // eslint-disable-next-line no-await-in-loop
  await typewriteLine(`│   ${idx + 1}. ${formatValue(cat.name, 32)} (${cat.count || 0})`, { charDelay: 10, lineDelay: 30 });
    }
  }

  await typewriteLine('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (metrics.filteredCount !== null) {
    await typewriteLine(`┃ productos-filtrados-sugeridos.csv → ${metrics.filteredCount} productos con precio sugerido.`);
  } else {
    await typewriteLine('┃ Aún no existe productos-filtrados-sugeridos.csv. Ejecuta la preparación de negocio.');
  }

  const opportunityFiles = [
    { label: 'oportunidades.csv', path: opportunitiesPath },
    { label: 'oportunidades_menos_50.csv', path: opportunities50Path },
    { label: 'oportunidades_menos_100.csv', path: opportunities100Path }
  ];

  let foundOpportunities = false;
  for (const item of opportunityFiles) {
    if (fs.existsSync(item.path)) {
      if (!foundOpportunities) {
        await typewriteLine('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        await typewriteLine('┃ Archivos de oportunidad detectados:');
        foundOpportunities = true;
      }
      const content = fs.readFileSync(item.path, 'utf8');
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const count = lines.length > 1 ? lines.length - 1 : 0;
      // eslint-disable-next-line no-await-in-loop
  await typewriteLine(`│   ${item.label} → ${count} productos.`, { charDelay: 10, lineDelay: 30 });
    }
  }

  if (!foundOpportunities) {
    await typewriteLine('┃ Aún no generas archivos de oportunidades. Usa buscando_productos_csv.js para crearlos.');
  }

  // Mostrar solicitudes de publicación si existen
  if (project && project.publication_requests && Object.keys(project.publication_requests).length > 0) {
    await typewriteLine('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await typewriteLine('┃ 📤 Solicitudes de publicación:');
    
    const fileMap = {
      'oportunidades': 'oportunidades.csv',
      'menos_50': 'oportunidades_menos_50.csv',
      'menos_100': 'oportunidades_menos_100.csv'
    };
    
    for (const [key, request] of Object.entries(project.publication_requests)) {
      const fileName = fileMap[key] || key;
      const requestDate = formatDate(request.requested_at);
      // eslint-disable-next-line no-await-in-loop
      await typewriteLine(`│   ✅ ${fileName} - Solicitada: ${requestDate}`, { charDelay: 10, lineDelay: 30 });
    }
    
    // Verificar si ya pasaron 30 minutos
    const firstRequest = Object.values(project.publication_requests)[0];
    const requestTime = new Date(firstRequest.requested_at);
    const now = new Date();
    const minutesPassed = Math.floor((now - requestTime) / 1000 / 60);
    
    if (minutesPassed >= 30) {
      await typewriteLine(`│   ⏰ Han pasado ${minutesPassed} minutos. ¡Ya puedes descargar la plantilla!`, { charDelay: 10, lineDelay: 30 });
    } else {
      const minutesLeft = 30 - minutesPassed;
      await typewriteLine(`│   ⏳ Faltan ~${minutesLeft} minutos para poder descargar`, { charDelay: 10, lineDelay: 30 });
    }
  }

  await typewriteLine('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await typewriteLine('┃ Próximas acciones sugeridas');
  
  // Sugerencias dinámicas según el estado
  if (!foundOpportunities) {
    await typewriteLine(`│   1. node prepare_business_csv.js ${sellerId}`, { charDelay: 10, lineDelay: 30 });
    await typewriteLine(`│   2. node buscando_productos_csv.js ${sellerId}`, { charDelay: 10, lineDelay: 30 });
    await typewriteLine('│   3. Revisa los CSV generados y valida reglas adicionales.', { charDelay: 10, lineDelay: 30 });
  } else if (!project || !project.publication_requests || Object.keys(project.publication_requests).length === 0) {
    await typewriteLine('│   1. Usa opción [5] → [1] para solicitar plantilla', { charDelay: 10, lineDelay: 30 });
    await typewriteLine('│   2. Espera ~30 minutos', { charDelay: 10, lineDelay: 30 });
    await typewriteLine('│   3. Usa opción [5] → [2] para descargar plantilla', { charDelay: 10, lineDelay: 30 });
  } else {
    await typewriteLine('│   1. Usa opción [5] → [2] para descargar plantilla', { charDelay: 10, lineDelay: 30 });
    await typewriteLine('│   2. Llena la plantilla con precios', { charDelay: 10, lineDelay: 30 });
    await typewriteLine('│   3. Sube la plantilla a Seller Central', { charDelay: 10, lineDelay: 30 });
  }
  
  await typewriteLine('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await typewriteLine('');
}

async function runAutomaticWorkflow(sellerId) {
  await typewriteLine('');
  await typewriteLine(`🚀 Modo automático seleccionado para ${sellerId}.`, { charDelay: 12 });
  await typewriteLine('El cerebro tomará control y continuará desde donde se quedó.', { charDelay: 12 });
  const success = await runCommand('cerebro.js', [sellerId]);
  if (success) {
  await typewriteLine('✅ Ejecución automática finalizada. Revisa el resumen para validar el estado.', { charDelay: 12 });
  } else {
  await typewriteLine('⚠️ La ejecución automática se detuvo. Puedes reintentarlo cuando quieras.', { charDelay: 12 });
  }
}

async function runStepByStep(sellerId, rl) {
  await typewriteLine('');
  await typewriteLine(`🧭 Modo paso a paso para ${sellerId}. Puedes detenerte entre fases.`, { charDelay: 12 });

  let projectsData = readProjectsFile();
  let project = ensureProjectEntry(projectsData, sellerId);

  const refreshProject = () => {
    projectsData = readProjectsFile();
    project = ensureProjectEntry(projectsData, sellerId);
  };

  const basicPhases = [
    {
      key: 'analysis_completed',
      label: 'Fase 1 · Análisis inicial',
      question: '¿Ejecutamos test-seller.js para analizar al vendedor?',
      command: 'test-seller.js',
      dateKey: 'analysis_date'
    },
    {
      key: 'plan_created',
      label: 'Fase 2 · Plan jerárquico',
      question: '¿Generamos el plan jerárquico con create-plan.js?',
      command: 'create-plan.js',
      dateKey: 'plan_date'
    },
    {
      key: 'scraping_completed',
      label: 'Fase 3 · Scraping de categorías',
      question: '¿Procesamos todas las categorías con process-all-categories.js?',
      command: 'process-all-categories.js',
      dateKey: 'scraping_date'
    },
    {
      key: 'products_extraction_completed',
      label: 'Fase 4 · Consolidación de productos',
      question: '¿Consolidamos los productos con process-vendor-categories.js?',
      command: 'process-vendor-categories.js',
      dateKey: 'products_extraction_date'
    }
  ];

  const runBasicPhase = async (phase) => {
    if (project[phase.key]) {
  await typewriteLine(`✔️  ${phase.label} ya está completada.`, { charDelay: 12, lineDelay: 30 });
      return true;
    }

    await typewriteLine('');
  await typewriteLine(phase.label, { charDelay: 12 });
    const proceed = await promptYesNo(`${phase.question}`, rl, true);
    if (!proceed) {
  await typewriteLine(`Deteniendo el flujo antes de ${phase.label}.`, { charDelay: 12 });
      return false;
    }

    const args = [sellerId];

    while (true) {
      const success = await runCommand(phase.command, args);
      if (success) {
        const updated = readProjectsFile();
        const record = ensureProjectEntry(updated, sellerId);
        record[phase.key] = true;
        if (phase.dateKey) {
          record[phase.dateKey] = new Date().toISOString();
        }
        record.last_updated = new Date().toISOString();
        saveProjectsFile(updated);
        refreshProject();
  await typewriteLine(`✔️  ${phase.label} finalizada.`, { charDelay: 12, lineDelay: 30 });
        return true;
      }

      const retry = await promptYesNo('El comando no terminó bien. ¿Intentar de nuevo?', rl, false);
      if (!retry) {
  await typewriteLine(`Deteniendo el flujo durante ${phase.label}.`, { charDelay: 12 });
        return false;
      }
    }
  };

  const enrichmentPhase = async () => {
    if (project.enrichment_completed) {
  await typewriteLine('✔️  Fase 5 · Enriquecimiento MX ya completada.', { charDelay: 12, lineDelay: 30 });
      return true;
    }

    const { products } = loadConsolidatedProducts(sellerId);
    if (!products) {
  await typewriteLine('❌ No encontré el archivo consolidado. Ejecuta primero la consolidación de productos.', { charDelay: 12 });
      return false;
    }

    let pendientes = getEnrichmentPending(products);
    if (pendientes.length === 0) {
      const updated = readProjectsFile();
      const record = ensureProjectEntry(updated, sellerId);
      record.enrichment_completed = true;
      record.enrichment_date = new Date().toISOString();
      record.last_updated = new Date().toISOString();
      saveProjectsFile(updated);
      refreshProject();
  await typewriteLine('✔️  Enriquecimiento MX ya estaba al día.', { charDelay: 12, lineDelay: 30 });
      return true;
    }

    await typewriteLine('');
  await typewriteLine(`Fase 5 · Enriquecimiento MX — pendientes: ${pendientes.length}`, { charDelay: 12 });
    let loteSize = 25;

    while (pendientes.length > 0) {
      const input = await ask(`Procesar un lote de ${loteSize}? (Enter = Sí, n = salir, número = nuevo tamaño): `, rl);
      const trimmed = input.trim().toLowerCase();

      if (!trimmed) {
        // usar lote actual
      } else if (trimmed === 'n' || trimmed === 'no') {
  await typewriteLine('Deteniendo enriquecimiento por solicitud.', { charDelay: 12 });
        break;
      } else {
        const parsed = parseInt(trimmed, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          await typewriteLine('Cantidad no válida. Intenta de nuevo.', { charDelay: 12 });
          continue;
        }
        loteSize = parsed;
      }

      const success = await runCommand('enrich-products-batch.js', [sellerId, loteSize.toString()]);
      if (!success) {
        const retry = await promptYesNo('El lote falló. ¿Intentar otro lote?', rl, false);
        if (!retry) {
          await typewriteLine('Deteniendo fase de enriquecimiento.', { charDelay: 12 });
          break;
        }
        continue;
      }

      const refreshed = loadConsolidatedProducts(sellerId);
      if (!refreshed.products) {
        console.log('No pude recargar el consolidado después del lote.');
        return false;
      }
      pendientes = getEnrichmentPending(refreshed.products);
  await typewriteLine(`📊 Pendientes restantes de enriquecimiento: ${pendientes.length}`, { charDelay: 12 });
    }

    if (pendientes.length === 0) {
      const updated = readProjectsFile();
      const record = ensureProjectEntry(updated, sellerId);
      record.enrichment_completed = true;
      record.enrichment_date = new Date().toISOString();
      record.last_updated = new Date().toISOString();
      saveProjectsFile(updated);
      refreshProject();
  await typewriteLine('✔️  Enriquecimiento MX completado.', { charDelay: 12, lineDelay: 30 });
      return true;
    }

  await typewriteLine('La fase de enriquecimiento quedó pendiente. Puedes retomarla más adelante.', { charDelay: 12 });
    return false;
  };

  const usaPhase = async () => {
    if (project.usa_verification_completed) {
  await typewriteLine('✔️  Fase 6 · Verificación USA ya completada.', { charDelay: 12, lineDelay: 30 });
      return true;
    }

    const { products } = loadConsolidatedProducts(sellerId);
    if (!products) {
  await typewriteLine('❌ No encontré el archivo consolidado. Asegúrate de completar las fases anteriores.', { charDelay: 12 });
      return false;
    }

    let pendientesUSA = getUsPending(products);
    if (pendientesUSA.length === 0) {
      const updated = readProjectsFile();
      const record = ensureProjectEntry(updated, sellerId);
      record.usa_verification_completed = true;
      record.usa_verification_date = new Date().toISOString();
      record.last_updated = new Date().toISOString();
      saveProjectsFile(updated);
      refreshProject();
  await typewriteLine('✔️  Verificación USA ya estaba completa.', { charDelay: 12, lineDelay: 30 });
      return true;
    }

    await typewriteLine('');
  await typewriteLine(`Fase 6 · Verificación USA — pendientes: ${pendientesUSA.length}`, { charDelay: 12 });
    let loteSize = 25;

    while (pendientesUSA.length > 0) {
      const input = await ask(`Procesar lote USA de ${loteSize}? (Enter = Sí, n = salir, número = nuevo tamaño): `, rl);
      const trimmed = input.trim().toLowerCase();

      if (!trimmed) {
        // usar lote actual
      } else if (trimmed === 'n' || trimmed === 'no') {
  await typewriteLine('Deteniendo verificación USA por solicitud.', { charDelay: 12 });
        break;
      } else {
        const parsed = parseInt(trimmed, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          await typewriteLine('Cantidad no válida. Intenta de nuevo.', { charDelay: 12 });
          continue;
        }
        loteSize = parsed;
      }

      const success = await runCommand(path.join('scripts', 'verify-products-usa-batch.js'), [sellerId, loteSize.toString()]);
      if (!success) {
        const retry = await promptYesNo('El lote USA falló. ¿Intentar otro?', rl, false);
        if (!retry) {
          await typewriteLine('Deteniendo fase USA.', { charDelay: 12 });
          break;
        }
        continue;
      }

      const refreshed = loadConsolidatedProducts(sellerId);
      if (!refreshed.products) {
        console.log('No pude recargar el consolidado después del lote USA.');
        return false;
      }
      pendientesUSA = getUsPending(refreshed.products);
  await typewriteLine(`📊 Pendientes restantes de verificación USA: ${pendientesUSA.length}`, { charDelay: 12 });
    }

    if (pendientesUSA.length === 0) {
      const updated = readProjectsFile();
      const record = ensureProjectEntry(updated, sellerId);
      record.usa_verification_completed = true;
      record.usa_verification_date = new Date().toISOString();
      record.last_updated = new Date().toISOString();
      saveProjectsFile(updated);
      refreshProject();
  await typewriteLine('✔️  Verificación USA completada.', { charDelay: 12, lineDelay: 30 });
      return true;
    }

  await typewriteLine('La verificación USA quedó pendiente. Reanúdala cuando quieras.', { charDelay: 12 });
    return false;
  };

  for (const phase of basicPhases) {
    const shouldContinue = await runBasicPhase(phase);
    if (!shouldContinue) {
      return;
    }
  }

  const enrichmentDone = await enrichmentPhase();
  if (!enrichmentDone) {
    return;
  }

  const usaDone = await usaPhase();
  if (!usaDone) {
    return;
  }

  await typewriteLine('');
  await typewriteLine('🎉 Todas las fases críticas están listas. Ya puedes pasar al filtrado de negocio.', { charDelay: 12 });
}

async function handleWorkflowOption(rl) {
  const projects = loadProjects();
  const sellerIds = listVendorIds(projects);
  
  await typewriteLine('');
  await typewriteLine('📦 SELECCIÓN DE VENDEDOR PARA WORKFLOW:', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('[0] 🆕 Nuevo vendedor (proporcionar SELLER_ID)', { charDelay: 10 });
  
  if (sellerIds.length > 0) {
    await typewriteLine('', { instant: true });
    await typewriteLine('Vendedores existentes:', { charDelay: 10 });
    for (let i = 0; i < sellerIds.length; i++) {
      const sellerId = sellerIds[i];
      const project = projects[sellerId] || {};
      project.seller_id = sellerId;
      const storeName = project.store_name || sellerId;
      const phaseInfo = resolvePhaseInfo(project);
      await typewriteLine(`[${i + 1}] ${storeName} (${sellerId}) - ${phaseInfo.currentLabel}`, { charDelay: 8 });
    }
  }
  
  await typewriteLine('');
  const vendorChoice = await ask('Elige una opción: ', rl);
  const vendorIndex = parseInt(vendorChoice, 10);
  
  let sellerId;
  
  if (vendorIndex === 0) {
    const sellerIdInput = await ask('Escribe el SELLER_ID del nuevo vendedor: ', rl);
    sellerId = sellerIdInput.trim();
    if (!sellerId) {
      await typewriteLine('Necesito un SELLER_ID para continuar.', { charDelay: 12 });
      await typewriteLine('');
      return;
    }
  } else if (vendorIndex > 0 && vendorIndex <= sellerIds.length) {
    sellerId = sellerIds[vendorIndex - 1];
  } else {
    await typewriteLine('Opción inválida. Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const projectsBefore = loadProjects();
  await renderVendorDetail(sellerId, projectsBefore);

  await typewriteLine('');
  await typewriteLine('Elige cómo quieres avanzar:');
  await typewriteLine(' [1] Paso a paso (script por script)', { charDelay: 12 });
  await typewriteLine(' [2] Automático (cerebro.js se encarga)', { charDelay: 12 });
  await typewriteLine(' [0] Cancelar', { charDelay: 12 });
  await typewriteLine('');
  const mode = await ask('Modo: ', rl);

  if (mode === '1') {
    await runStepByStep(sellerId, rl);
  } else if (mode === '2') {
    await runAutomaticWorkflow(sellerId);
  } else {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const projectsAfter = loadProjects();
  await renderVendorDetail(sellerId, projectsAfter);
}

async function handleIncrementalOption(rl) {
  await typewriteLine('');
  await typewriteLine('🔄 SISTEMA INCREMENTAL POR LOTES', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('Este sistema permite trabajar con vendedores grandes', { charDelay: 10 });
  await typewriteLine('en lotes de ~1000 productos, con reanudación automática.', { charDelay: 10 });
  await typewriteLine('');
  await typewriteLine('¿Qué acción deseas realizar?', { charDelay: 12 });
  await typewriteLine('[1] 📋 Registrar nuevo vendedor (test-seller.js)', { charDelay: 10 });
  await typewriteLine('[2] 📦 Crear planes por lotes (create-plan-batches.js)', { charDelay: 10 });
  await typewriteLine('[3] 🚀 Extraer productos de batch (extrae + consolida)', { charDelay: 10 });
  await typewriteLine('[4] 🔄 Procesar TODOS los batches (automático)', { charDelay: 10 });
  await typewriteLine('[5] 📊 Ver estado de batches de un vendedor', { charDelay: 10 });
  await typewriteLine('[6] 🔧 Gestionar categorías (saltar/ver loops)', { charDelay: 10 });
  await typewriteLine('[7] 📖 Ver documentación del sistema incremental', { charDelay: 10 });
  await typewriteLine('[0] ← Volver al menú principal', { charDelay: 10 });
  await typewriteLine('');

  const action = await ask('Opción: ', rl);

  if (action === '1') {
    await handleRegistrarVendedor(rl);
  } else if (action === '2') {
    await handleCrearPlanesLotes(rl);
  } else if (action === '3') {
    await handleProcesarBatchIndividual(rl);
  } else if (action === '4') {
    await handleProcesarTodosLosBatches(rl);
  } else if (action === '5') {
    await handleVerEstadoBatches(rl);
  } else if (action === '6') {
    await handleGestionarCategorias(rl);
  } else if (action === '7') {
    await handleVerDocumentacionIncremental(rl);
  } else {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
  }
}

async function handleRegistrarVendedor(rl) {
  await typewriteLine('');
  await typewriteLine('📋 REGISTRAR NUEVO VENDEDOR', { charDelay: 12 });
  await typewriteLine('────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('Este script hace un análisis rápido del vendedor:', { charDelay: 10 });
  await typewriteLine('• Extrae total de productos', { charDelay: 8 });
  await typewriteLine('• Extrae categorías principales', { charDelay: 8 });
  await typewriteLine('• Guarda info en projects.json', { charDelay: 8 });
  await typewriteLine('• NO inicia scraping automáticamente', { charDelay: 8 });
  await typewriteLine('');

  const sellerId = await ask('SELLER_ID del vendedor a registrar [0 para cancelar]: ', rl);

  if (!sellerId || sellerId === '0') {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('');
  await typewriteLine(`📦 Registrando vendedor: ${sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando test-seller.js...', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'test-seller.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Vendedor registrado exitosamente.', { charDelay: 12 });
        await typewriteLine('');
        await typewriteLine('📊 Puedes revisar el detalle en [1] Ver detalle de vendedor', { charDelay: 10 });
        await typewriteLine('📦 O crear planes por lotes desde esta opción [2]', { charDelay: 10 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleCrearPlanesLotes(rl) {
  await typewriteLine('');
  await typewriteLine('📦 CREAR PLANES POR LOTES', { charDelay: 12 });
  await typewriteLine('─────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const projectsData = loadProjects();
  const sellerIds = listVendorIds(projectsData);

  if (sellerIds.length === 0) {
    await typewriteLine('⚠️  No hay vendedores registrados.', { charDelay: 12 });
    await typewriteLine('   Primero registra un vendedor con la opción [1].', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('📋 Vendedores registrados:', { charDelay: 12 });
  await typewriteLine('');

  for (let i = 0; i < sellerIds.length; i++) {
    const sellerId = sellerIds[i];
    const project = projectsData[sellerId] || {};
    const status = project.status || 'unknown';
    const totalProducts = project.total_products || 0;
    const batches = project.batches || [];

    await typewriteLine(`[${i + 1}] ${sellerId}`, { charDelay: 8 });
    await typewriteLine(`    Status: ${status} | Productos: ${totalProducts}`, { charDelay: 8 });
    
    if (batches.length > 0) {
      const completed = batches.filter(b => b.status === 'completed').length;
      await typewriteLine(`    Batches: ${completed}/${batches.length} completados`, { charDelay: 8 });
    }
    await typewriteLine('');
  }

  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);
  const vendorIndex = parseInt(vendorChoice, 10) - 1;

  if (vendorIndex < 0 || vendorIndex >= sellerIds.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const sellerId = sellerIds[vendorIndex];
  const project = projectsData[sellerId] || {};

  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${sellerId}`, { charDelay: 12 });
  await typewriteLine(`📊 Total productos: ${project.total_products || 0}`, { charDelay: 12 });
  
  if (project.batches && project.batches.length > 0) {
    await typewriteLine('');
    await typewriteLine('⚠️  Este vendedor ya tiene batches creados.', { charDelay: 12 });
    await typewriteLine('   El script reanudará automáticamente desde el último batch.', { charDelay: 12 });
  }

  await typewriteLine('');
  const confirm = await promptYesNo('¿Crear/continuar planes por lotes?', rl, true);

  if (!confirm) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando create-plan-batches.js...', { charDelay: 12 });
  await typewriteLine('   (Este proceso es resumible, puedes interrumpirlo)', { charDelay: 10 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'create-plan-batches.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Planes por lotes creados exitosamente.', { charDelay: 12 });
        await typewriteLine('');
        await typewriteLine('📊 Puedes ver el estado de batches en opción [3]', { charDelay: 10 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
        await typewriteLine('');
        await typewriteLine('💡 Si interrumpiste el proceso, puedes reanudarlo', { charDelay: 10 });
        await typewriteLine('   ejecutando el mismo comando de nuevo.', { charDelay: 10 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleProcesarBatches(rl) {
  await typewriteLine('');
  await typewriteLine('🚀 PROCESAR BATCHES', { charDelay: 12 });
  await typewriteLine('────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const projectsData = loadProjects();
  const sellerIds = listVendorIds(projectsData);

  if (sellerIds.length === 0) {
    await typewriteLine('⚠️  No hay vendedores registrados.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  // Filtrar solo vendedores con batches
  const vendorsWithBatches = sellerIds.filter(id => {
    const project = projectsData[id] || {};
    return project.batches && project.batches.length > 0;
  });

  if (vendorsWithBatches.length === 0) {
    await typewriteLine('⚠️  No hay vendedores con batches creados.', { charDelay: 12 });
    await typewriteLine('   Primero crea planes por lotes con la opción [2].', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('📋 Vendedores con batches:', { charDelay: 12 });
  await typewriteLine('');

  for (let i = 0; i < vendorsWithBatches.length; i++) {
    const sellerId = vendorsWithBatches[i];
    const project = projectsData[sellerId] || {};
    const storeName = project.store_name || sellerId;
    const batches = project.batches || [];
    const completed = batches.filter(b => b.status === 'completed').length;
    const inProgress = batches.filter(b => b.status === 'scraping').length;
    const pending = batches.filter(b => b.status === 'plan_created').length;

    await typewriteLine(`[${i + 1}] ${storeName}`, { charDelay: 8 });
    await typewriteLine(`    ID: ${sellerId}`, { charDelay: 8 });
    await typewriteLine(`    Batches: ${completed} completados, ${inProgress} en proceso, ${pending} pendientes`, { charDelay: 8 });
    await typewriteLine('');
  }

  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);
  const vendorIndex = parseInt(vendorChoice, 10) - 1;

  if (vendorIndex < 0 || vendorIndex >= vendorsWithBatches.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const sellerId = vendorsWithBatches[vendorIndex];
  const project = projectsData[sellerId] || {};
  const storeName = project.store_name || sellerId;

  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${storeName} (${sellerId})`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando process-all-categories.js...', { charDelay: 12 });
  await typewriteLine('   (Este proceso detectará automáticamente los batches)', { charDelay: 10 });
  await typewriteLine('   (Es resumible, puedes interrumpirlo con Ctrl+C)', { charDelay: 10 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'process-all-categories.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Procesamiento de batches completado.', { charDelay: 12 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
        await typewriteLine('');
        await typewriteLine('💡 Si interrumpiste el proceso, puedes reanudarlo', { charDelay: 10 });
        await typewriteLine('   ejecutando el mismo comando de nuevo.', { charDelay: 10 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleProcesarBatchIndividual(rl) {
  await typewriteLine('');
  await typewriteLine('🚀 PROCESAR BATCH INDIVIDUAL', { charDelay: 12 });
  await typewriteLine('─────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('Escrapea y consolida un batch específico.', { charDelay: 10 });
  await typewriteLine('Perfecto para procesar batch por batch e ir publicando.', { charDelay: 10 });
  await typewriteLine('');

  const projectsData = loadProjects();
  const sellerIds = listVendorIds(projectsData);

  if (sellerIds.length === 0) {
    await typewriteLine('⚠️  No hay vendedores registrados.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  // Filtrar vendedores con batches
  const vendorsWithBatches = sellerIds.filter(id => {
    const project = projectsData[id] || {};
    return project.batches && project.batches.length > 0;
  });

  if (vendorsWithBatches.length === 0) {
    await typewriteLine('⚠️  No hay vendedores con batches creados.', { charDelay: 12 });
    await typewriteLine('   Primero crea planes por lotes con la opción [2].', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('📋 Vendedores con batches:', { charDelay: 12 });
  await typewriteLine('');

  for (let i = 0; i < vendorsWithBatches.length; i++) {
    const sellerId = vendorsWithBatches[i];
    const project = projectsData[sellerId] || {};
    const storeName = project.store_name || sellerId;
    const batches = project.batches || [];

    await typewriteLine(`[${i + 1}] ${storeName}`, { charDelay: 8 });
    await typewriteLine(`    ID: ${sellerId}`, { charDelay: 8 });
    await typewriteLine(`    Batches totales: ${batches.length}`, { charDelay: 8 });
    await typewriteLine('');
  }

  const vendorChoice = await ask('Elige el vendedor [0 para cancelar]: ', rl);
  const vendorIndex = parseInt(vendorChoice, 10) - 1;

  if (vendorIndex < 0 || vendorIndex >= vendorsWithBatches.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const sellerId = vendorsWithBatches[vendorIndex];
  const project = projectsData[sellerId] || {};
  const storeName = project.store_name || sellerId;
  const batches = project.batches || [];

  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${storeName} (${sellerId})`, { charDelay: 12 });
  await typewriteLine(`📦 Batches disponibles: ${batches.length}`, { charDelay: 12 });
  await typewriteLine('');

  // Mostrar estado de cada batch
  for (const batch of batches) {
    const statusIcon = batch.status === 'completed' ? '✅' : 
                      batch.status === 'scraping' ? '🔄' : '⏳';
    await typewriteLine(`   ${statusIcon} Batch ${batch.batch}: ${batch.status} (${batch.products} productos, ${batch.categories?.length || 0} categorías)`, { charDelay: 8 });
  }

  await typewriteLine('');
  const batchChoice = await ask('¿Qué batch procesar? (número o "all") [0 para cancelar]: ', rl);

  if (batchChoice === '0') {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('');
  await typewriteLine(`🎯 Procesando batch: ${batchChoice}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('📋 PASO 1: Extrayendo productos del batch', { charDelay: 10 });
  await typewriteLine('🔄 Ejecutando extract-batch-products.js...', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'extract-batch-products.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, sellerId, batchChoice], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Extracción de productos completada.', { charDelay: 12 });
        await typewriteLine('');
        await typewriteLine('📋 PASO 2: Consolidando productos del batch', { charDelay: 10 });
        await typewriteLine('🔄 Ejecutando consolidate-batch-products.js...', { charDelay: 12 });
        await typewriteLine('');

        const consolidateScript = path.join(ROOT_DIR, 'consolidate-batch-products.js');
        const child2 = spawn('node', [consolidateScript, sellerId, batchChoice], {
          cwd: ROOT_DIR,
          stdio: 'inherit'
        });

        child2.on('close', async (code2) => {
          await typewriteLine('');
          if (code2 === 0) {
            await typewriteLine('✅ Consolidación completada.', { charDelay: 12 });
            await typewriteLine('');
            await typewriteLine('📊 Archivos generados:', { charDelay: 10 });
            if (batchChoice.toLowerCase() === 'all') {
              await typewriteLine(`   • all-products-consolidated.json (todos los batches)`, { charDelay: 8 });
              await typewriteLine(`   • all-products-consolidated.csv`, { charDelay: 8 });
            } else {
              await typewriteLine(`   • batch-${batchChoice}-consolidated.json`, { charDelay: 8 });
              await typewriteLine(`   • batch-${batchChoice}-consolidated.csv`, { charDelay: 8 });
            }
            await typewriteLine('');
            await typewriteLine('🚀 Siguiente paso: Verificar en USA y filtrar oportunidades', { charDelay: 10 });
            await typewriteLine(`   Puedes usar las opciones del flujo normal (Fase 2 y 3)`, { charDelay: 10 });
          } else {
            await typewriteLine(`⚠️  Consolidación terminó con código: ${code2}`, { charDelay: 12 });
          }
          await typewriteLine('');
          resolve();
        });

        child2.on('error', async (err) => {
          await typewriteLine(`❌ Error en consolidación: ${err.message}`, { charDelay: 12 });
          await typewriteLine('');
          resolve();
        });
      } else {
        await typewriteLine(`⚠️  Scraping terminó con código: ${code}`, { charDelay: 12 });
        await typewriteLine('');
        resolve();
      }
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar scraping: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function handleProcesarTodosLosBatches(rl) {
  await typewriteLine('');
  await typewriteLine('🔄 PROCESAR TODOS LOS BATCHES', { charDelay: 12 });
  await typewriteLine('───────────────────────────────', { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('⚠️  ATENCIÓN: Este proceso puede tardar varias horas.', { charDelay: 10 });
  await typewriteLine('   Es resumible, puedes interrumpir con Ctrl+C.', { charDelay: 10 });
  await typewriteLine('');

  await handleProcesarBatches(rl);
}

async function handleVerEstadoBatches(rl) {
  await typewriteLine('');
  await typewriteLine('📊 ESTADO DE BATCHES', { charDelay: 12 });
  await typewriteLine('─────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const projectsData = loadProjects();
  const sellerIds = listVendorIds(projectsData);

  if (sellerIds.length === 0) {
    await typewriteLine('⚠️  No hay vendedores registrados.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('📋 Vendedores con batches:', { charDelay: 12 });
  await typewriteLine('');

  const vendorsWithBatches = [];
  for (const sellerId of sellerIds) {
    const project = projectsData[sellerId] || {};
    if (project.batches && project.batches.length > 0) {
      vendorsWithBatches.push({ sellerId, batches: project.batches });
    }
  }

  if (vendorsWithBatches.length === 0) {
    await typewriteLine('⚠️  Ningún vendedor tiene batches creados aún.', { charDelay: 12 });
    await typewriteLine('   Usa la opción [2] para crear planes por lotes.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  for (let i = 0; i < vendorsWithBatches.length; i++) {
    const vendor = vendorsWithBatches[i];
    await typewriteLine(`[${i + 1}] ${vendor.sellerId}`, { charDelay: 8 });
    await typewriteLine(`    Total batches: ${vendor.batches.length}`, { charDelay: 8 });
    
    const completed = vendor.batches.filter(b => b.status === 'completed').length;
    const inProgress = vendor.batches.filter(b => b.status === 'in_progress').length;
    const pending = vendor.batches.filter(b => b.status === 'plan_created').length;
    
    await typewriteLine(`    ✅ Completados: ${completed} | 🔄 En progreso: ${inProgress} | ⏳ Pendientes: ${pending}`, { charDelay: 8 });
    await typewriteLine('');
  }

  const vendorChoice = await ask('Elige el número del vendedor para ver detalle [0 para cancelar]: ', rl);
  const vendorIndex = parseInt(vendorChoice, 10) - 1;

  if (vendorIndex < 0 || vendorIndex >= vendorsWithBatches.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const vendor = vendorsWithBatches[vendorIndex];
  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${vendor.sellerId}`, { charDelay: 12 });
  await typewriteLine('─────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  for (const batch of vendor.batches) {
    const statusIcon = batch.status === 'completed' ? '✅' : 
                       batch.status === 'in_progress' ? '🔄' : '⏳';
    
    await typewriteLine(`${statusIcon} Batch ${batch.batch}:`, { charDelay: 8 });
    await typewriteLine(`   Productos: ${batch.products}`, { charDelay: 8 });
    await typewriteLine(`   Categorías: ${batch.categories ? batch.categories.join(', ') : 'N/A'}`, { charDelay: 8 });
    await typewriteLine(`   Status: ${batch.status}`, { charDelay: 8 });
    await typewriteLine(`   Creado: ${new Date(batch.created_at).toLocaleString()}`, { charDelay: 8 });
    await typewriteLine('');
  }

  // Mostrar archivos de batch en disco
  const vendorDir = path.join(VENDORS_DIR, vendor.sellerId);
  if (fs.existsSync(vendorDir)) {
    const files = fs.readdirSync(vendorDir).filter(f => f.includes('plan-batch-'));
    if (files.length > 0) {
      await typewriteLine('📁 Archivos de batch en disco:', { charDelay: 10 });
      for (const file of files) {
        await typewriteLine(`   • ${file}`, { charDelay: 8 });
      }
      await typewriteLine('');
    }
  }
}

async function handleVerDocumentacionIncremental(rl) {
  await typewriteLine('');
  await typewriteLine('📖 DOCUMENTACIÓN DEL SISTEMA INCREMENTAL', { charDelay: 12 });
  await typewriteLine('─────────────────────────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const docPath = path.join(ROOT_DIR, 'GUIA-SISTEMA-INCREMENTAL.md');

  if (fs.existsSync(docPath)) {
    await typewriteLine('✅ Documentación disponible en:', { charDelay: 10 });
    await typewriteLine(`   ${docPath}`, { charDelay: 8 });
    await typewriteLine('');
    await typewriteLine('📋 RESUMEN DEL SISTEMA:', { charDelay: 10 });
    await typewriteLine('');
    await typewriteLine('1️⃣  REGISTRO (test-seller.js)', { charDelay: 8 });
    await typewriteLine('   • Análisis rápido del vendedor', { charDelay: 8 });
    await typewriteLine('   • Extrae total productos y categorías', { charDelay: 8 });
    await typewriteLine('   • Guarda en projects.json', { charDelay: 8 });
    await typewriteLine('   • NO inicia scraping', { charDelay: 8 });
    await typewriteLine('');
    await typewriteLine('2️⃣  PLANIFICACIÓN (create-plan-batches.js)', { charDelay: 8 });
    await typewriteLine('   • Agrupa categorías en lotes de ~1000 productos', { charDelay: 8 });
    await typewriteLine('   • Guarda plan-batch-1.json, plan-batch-2.json, etc.', { charDelay: 8 });
    await typewriteLine('   • Reanudable automáticamente', { charDelay: 8 });
    await typewriteLine('   • Actualiza projects.json con cada batch', { charDelay: 8 });
    await typewriteLine('');
    await typewriteLine('3️⃣  PROCESAMIENTO (próximamente)', { charDelay: 8 });
    await typewriteLine('   • Procesa cada batch secuencialmente', { charDelay: 8 });
    await typewriteLine('   • Extrae productos de categorías del batch', { charDelay: 8 });
    await typewriteLine('   • Consolida datos por batch', { charDelay: 8 });
    await typewriteLine('');
    await typewriteLine('💡 VENTAJAS:', { charDelay: 10 });
    await typewriteLine('   • Sesiones cortas y manejables', { charDelay: 8 });
    await typewriteLine('   • Reanudación automática', { charDelay: 8 });
    await typewriteLine('   • Fácil detección de errores', { charDelay: 8 });
    await typewriteLine('   • Ideal para vendedores grandes (10,000+ productos)', { charDelay: 8 });
    await typewriteLine('');
  } else {
    await typewriteLine('⚠️  No se encontró el archivo de documentación.', { charDelay: 12 });
    await typewriteLine('   Se esperaba en: GUIA-SISTEMA-INCREMENTAL.md', { charDelay: 10 });
    await typewriteLine('');
  }
}

async function handleRegistrarVendedoresMenu(rl) {
  let continuar = true;

  while (continuar) {
    await typewriteLine('');
    await typewriteLine('📝 REGISTRAR NUEVOS VENDEDORES', { charDelay: 12 });
    await typewriteLine('────────────────────────────────', { charDelay: 12 });
    await typewriteLine('');
    await typewriteLine('Este proceso hace un análisis inicial del vendedor:', { charDelay: 10 });
    await typewriteLine('• Extrae nombre de la tienda', { charDelay: 8 });
    await typewriteLine('• Extrae total de productos', { charDelay: 8 });
    await typewriteLine('• Extrae categorías principales', { charDelay: 8 });
    await typewriteLine('• Guarda info en projects.json', { charDelay: 8 });
    await typewriteLine('• NO inicia scraping automáticamente', { charDelay: 8 });
    await typewriteLine('');

    const sellerId = await ask('SELLER_ID del vendedor a registrar [0 para volver al menú]: ', rl);

    if (!sellerId || sellerId === '0') {
      await typewriteLine('Regresando al menú principal...', { charDelay: 12 });
      await typewriteLine('');
      return;
    }

    await typewriteLine('');
    await typewriteLine(`📦 Registrando vendedor: ${sellerId}`, { charDelay: 12 });
    await typewriteLine('');
    await typewriteLine('🔄 Ejecutando test-seller.js...', { charDelay: 12 });
    await typewriteLine('');

    const scriptPath = path.join(ROOT_DIR, 'test-seller.js');
    
    await new Promise((resolve) => {
      const child = spawn('node', [scriptPath, sellerId], {
        cwd: ROOT_DIR,
        stdio: 'inherit'
      });

      child.on('close', async (code) => {
        await typewriteLine('');
        if (code === 0) {
          await typewriteLine('✅ Vendedor registrado exitosamente.', { charDelay: 12 });
        } else {
          await typewriteLine(`⚠️  El registro terminó con código: ${code}`, { charDelay: 12 });
        }
        await typewriteLine('');
        resolve();
      });

      child.on('error', async (err) => {
        await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
        await typewriteLine('');
        resolve();
      });
    });

    // Preguntar si quiere registrar otro
    await typewriteLine('¿Qué deseas hacer?', { charDelay: 12 });
    await typewriteLine('[1] Registrar otro vendedor', { charDelay: 10 });
    await typewriteLine('[0] Volver al menú principal', { charDelay: 10 });
    await typewriteLine('');
    
    const opcion = await ask('Opción: ', rl);
    
    if (opcion !== '1') {
      continuar = false;
      await typewriteLine('Regresando al menú principal...', { charDelay: 12 });
      await typewriteLine('');
    }
  }
}

async function handleGestionarCategorias(rl) {
  await typewriteLine('');
  await typewriteLine('🔧 GESTIONAR CATEGORÍAS', { charDelay: 12 });
  await typewriteLine('───────────────────────', { charDelay: 12 });
  await typewriteLine('');

  const projectsData = loadProjects();
  const sellerIds = listVendorIds(projectsData);

  if (sellerIds.length === 0) {
    await typewriteLine('⚠️  No hay vendedores registrados.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  await typewriteLine('📋 Vendedores disponibles:', { charDelay: 12 });
  await typewriteLine('');

  for (let i = 0; i < sellerIds.length; i++) {
    const sellerId = sellerIds[i];
    const project = projectsData[sellerId] || {};
    const storeName = project.store_name || sellerId;
    const totalCategories = (project.main_categories || []).length;
    
    await typewriteLine(`[${i + 1}] ${storeName}`, { charDelay: 8 });
    await typewriteLine(`    ID: ${sellerId}`, { charDelay: 8 });
    await typewriteLine(`    Categorías: ${totalCategories}`, { charDelay: 8 });
    await typewriteLine('');
  }

  const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);
  const vendorIndex = parseInt(vendorChoice, 10) - 1;

  if (vendorIndex < 0 || vendorIndex >= sellerIds.length) {
    await typewriteLine('Operación cancelada.', { charDelay: 12 });
    await typewriteLine('');
    return;
  }

  const sellerId = sellerIds[vendorIndex];

  await typewriteLine('');
  await typewriteLine(`📦 Vendedor: ${sellerId}`, { charDelay: 12 });
  await typewriteLine('');
  await typewriteLine('🔄 Ejecutando manage-batch-categories.js...', { charDelay: 12 });
  await typewriteLine('');

  const scriptPath = path.join(ROOT_DIR, 'manage-batch-categories.js');
  
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, sellerId], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      await typewriteLine('');
      if (code === 0) {
        await typewriteLine('✅ Gestión completada.', { charDelay: 12 });
      } else {
        await typewriteLine(`⚠️  El script terminó con código: ${code}`, { charDelay: 12 });
      }
      await typewriteLine('');
      resolve();
    });

    child.on('error', async (err) => {
      await typewriteLine(`❌ Error al ejecutar el script: ${err.message}`, { charDelay: 12 });
      await typewriteLine('');
      resolve();
    });
  });
}

async function main() {
  await printBanner();
  await explainPurpose();

  let projectsMap = loadProjects();
  await renderProjectsSummary(projectsMap);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let exitRequested = false;

  while (!exitRequested) {
    await showMenu();
    const choice = await ask('Selecciona una opción: ', rl);

    switch (choice) {
      case MENU_OPTIONS.DETAILS: {
        const projects = loadProjects();
        const sellerIds = listVendorIds(projects);
        
        if (sellerIds.length === 0) {
          await typewriteLine('⚠️  Aún no hay vendedores registrados.', { charDelay: 12 });
          await typewriteLine('   Ejecuta cerebro.js con un SELLER_ID para comenzar.', { charDelay: 12 });
          await typewriteLine('');
          break;
        }
        
        await typewriteLine('');
        await typewriteLine('📦 VENDEDORES DISPONIBLES:', { charDelay: 12 });
        await typewriteLine('─────────────────────────────', { charDelay: 12 });
        
        for (let i = 0; i < sellerIds.length; i++) {
          const sellerId = sellerIds[i];
          const project = projects[sellerId] || {};
          project.seller_id = sellerId;
          const storeName = project.store_name || sellerId;
          const phaseInfo = resolvePhaseInfo(project);
          await typewriteLine(`[${i + 1}] ${storeName} (${sellerId}) - ${phaseInfo.currentLabel}`, { charDelay: 8 });
        }
        
        await typewriteLine('');
        const vendorChoice = await ask('Elige el número del vendedor [0 para cancelar]: ', rl);
        const vendorIndex = parseInt(vendorChoice, 10) - 1;
        
        if (vendorIndex < 0 || vendorIndex >= sellerIds.length) {
          await typewriteLine('Operación cancelada.', { charDelay: 12 });
          await typewriteLine('');
          break;
        }
        
        const selectedSellerId = sellerIds[vendorIndex];
        await renderVendorDetail(selectedSellerId, projects);
        await typewriteLine('');
        break;
      }
      case MENU_OPTIONS.FILES: {
        await printShortcuts();
        break;
      }
      case MENU_OPTIONS.REFRESH: {
        projectsMap = loadProjects();
        await renderProjectsSummary(projectsMap);
        break;
      }
      case MENU_OPTIONS.WORKFLOW: {
        await handleWorkflowOption(rl);
        projectsMap = loadProjects();
        await renderProjectsSummary(projectsMap);
        break;
      }
      case MENU_OPTIONS.PUBLISH: {
        await handlePublishOption(rl);
        projectsMap = loadProjects();
        break;
      }
      case MENU_OPTIONS.INCREMENTAL: {
        await handleIncrementalOption(rl);
        projectsMap = loadProjects();
        await renderProjectsSummary(projectsMap);
        break;
      }
      case MENU_OPTIONS.REGISTER: {
        await handleRegistrarVendedoresMenu(rl);
        projectsMap = loadProjects();
        await renderProjectsSummary(projectsMap);
        break;
      }
      case MENU_OPTIONS.EXIT: {
        exitRequested = true;
        break;
      }
      default: {
  await typewriteLine('Opción no reconocida. Intenta de nuevo.', { charDelay: 12 });
        await typewriteLine('');
      }
    }
  }

  rl.close();
  await typewriteLine('Gracias por usar el buscador de oportunidades. ¡Hasta la próxima!', { charDelay: 12 });
}

main().catch((error) => {
  console.error('Ocurrió un error inesperado:', error);
  process.exit(1);
});
