const fs = require('fs');
const path = require('path');
const config = require('./config/pipeline-config');

console.log('🔍 Verificando que todo esté listo para el pipeline...\n');

let errores = 0;
let warnings = 0;

// 1. Verificar scripts
console.log('📝 Verificando scripts:');
for (const [fase, faseConfig] of Object.entries(config.scripts)) {
  const scriptRelativePath = typeof faseConfig === 'object' ? faseConfig.path : faseConfig;
  const scriptPath = path.resolve(__dirname, scriptRelativePath);

  if (!fs.existsSync(scriptPath)) {
    console.log(`  ❌ ${fase}: ${scriptPath} NO ENCONTRADO`);
    errores++;
  } else {
    console.log(`  ✅ ${fase}: ${path.basename(scriptPath)}`);
  }
}

// 2. Verificar projects.json
console.log('\n📊 Verificando projects.json:');
const projectsPath = config.paths.projects;
if (!fs.existsSync(projectsPath)) {
  console.log(`  ❌ projects.json NO ENCONTRADO en: ${projectsPath}`);
  errores++;
} else {
  try {
    const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    const projectsData = data.projects || data;
    const vendors = [];

    Object.keys(projectsData).forEach(key => {
      if (key !== 'last_updated' && typeof projectsData[key] === 'object') {
        const vendorData = projectsData[key];
        const sellerId = vendorData.seller_id || key;
        vendors.push({ seller_id: sellerId, ...vendorData });
      }
    });

    console.log(`  ✅ projects.json encontrado`);
    console.log(`  📦 ${vendors.length} vendedores disponibles`);

    // Mostrar estado de los vendedores
    const sinPlan = vendors.filter(v => !v.plan_created).length;
    const sinScraping = vendors.filter(v => !v.scraping_completed).length;
    const sinVerificacionUSA = vendors.filter(v => !v.usa_verification_completed).length;

    console.log(`\n  Estado de los vendedores:`);
    console.log(`    - Sin plan: ${sinPlan}`);
    console.log(`    - Sin scraping: ${sinScraping}`);
    console.log(`    - Sin verificación USA: ${sinVerificacionUSA}`);

    if (vendors.length === 0) {
      console.log(`  ⚠️  No hay vendedores para procesar`);
      warnings++;
    }

  } catch (error) {
    console.log(`  ❌ Error leyendo projects.json: ${error.message}`);
    errores++;
  }
}

// 3. Verificar carpeta de logs
console.log('\n📁 Verificando carpetas:');
const logsPath = path.join(__dirname, '..', 'logs', 'pipeline');
if (!fs.existsSync(logsPath)) {
  console.log(`  ℹ️  Carpeta de logs no existe, se creará automáticamente`);
  console.log(`     ${logsPath}`);
} else {
  console.log(`  ✅ Carpeta de logs existe: ${logsPath}`);
}

// 4. Verificar cookies de Amazon
console.log('\n🍪 Verificando cookies de Amazon:');
const authPath = path.join(__dirname, '..', 'scripts', 'auth');
const cookieFiles = {
  'Amazon MX (Firefox)': 'amazonmx-firefox.json',
  'Amazon MX (Chrome)': 'amazonmx.json',
  'Amazon Seller': 'amazonseller.json'
};

for (const [nombre, archivo] of Object.entries(cookieFiles)) {
  const cookiePath = path.join(authPath, archivo);

  if (!fs.existsSync(cookiePath)) {
    console.log(`  ⚠️  ${nombre}: NO ENCONTRADO`);
    console.log(`     Ejecuta: node scripts/save-amazon-cookies-firefox.js`);
    warnings++;
  } else {
    const stats = fs.statSync(cookiePath);
    const ahora = new Date();
    const antiguedad = Math.floor((ahora - stats.mtime) / (1000 * 60 * 60 * 24)); // días

    let icono = '✅';
    let mensaje = '';

    if (antiguedad > 14) {
      icono = '❌';
      mensaje = ' - CRÍTICO: Muy antiguas, refrescar YA';
      warnings++;
    } else if (antiguedad > 7) {
      icono = '⚠️ ';
      mensaje = ' - Considera refrescar pronto';
      warnings++;
    } else if (antiguedad > 3) {
      icono = '⚡';
      mensaje = ' - OK, pero monitorear';
    }

    console.log(`  ${icono} ${nombre}: ${antiguedad} día(s)${mensaje}`);
  }
}

// 5. Verificar estado del pipeline
console.log('\n⚙️  Verificando estado del pipeline:');
const statePath = config.paths.state;
if (fs.existsSync(statePath)) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  console.log(`  ✅ Estado del pipeline encontrado`);
  console.log(`     - Cola: ${state.cola.length} vendedores`);
  console.log(`     - Historial: ${state.historial.length} vendedores`);
  console.log(`     - Completados: ${state.estadisticas.vendedoresProcesados}`);
  console.log(`     - Errores: ${state.estadisticas.vendedoresConError}`);
  console.log(`     - Estado: ${state.pausado ? 'PAUSADO' : (state.activo ? 'ACTIVO' : 'INACTIVO')}`);

  if (state.pausado) {
    console.log(`\n  ⚠️  El pipeline está PAUSADO`);
    console.log(`     Ejecuta: node pipeline-orchestrator.js resume`);
    warnings++;
  }
} else {
  console.log(`  ℹ️  No hay estado previo, se creará uno nuevo`);
}

// Resumen
console.log('\n' + '═'.repeat(70));
if (errores > 0) {
  console.log(`❌ VERIFICACIÓN FALLIDA - ${errores} error(es) encontrado(s)`);
  console.log('   No se puede iniciar el pipeline hasta resolver los errores.');
  process.exit(1);
} else if (warnings > 0) {
  console.log(`⚠️  VERIFICACIÓN COMPLETADA - ${warnings} advertencia(s)`);
  console.log('   El pipeline puede iniciarse pero revisa las advertencias.');
} else {
  console.log(`✅ TODO LISTO - El pipeline está listo para iniciarse`);
}
console.log('═'.repeat(70));

if (errores === 0) {
  console.log('\nPara iniciar el pipeline:');
  console.log('  node pipeline-orchestrator.js start');
  console.log('\nO simplemente ejecuta:');
  console.log('  start-pipeline.bat');
}
