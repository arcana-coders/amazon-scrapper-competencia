/**
 * Test del flujo completo de generación de oportunidades
 * Simula el comportamiento del PANELMAESTRO-v2
 */

const {
  detectVendorPhase,
  getBatchConsolidatedFiles,
  countOpportunities,
  getAllOpportunitiesFiles
} = require('./modules/utils/vendor-utils.js');

const SELLER_ID = 'AE8MUNDUREHX7';
const BATCH_NUMBER = 1;

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TEST: Flujo completo de generación de oportunidades');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Detectar fase del vendedor
console.log('1️⃣  Detectando fase del vendedor...');
const phaseInfo = detectVendorPhase(SELLER_ID);
console.log(`   Phase: ${phaseInfo.phase}`);
console.log(`   Label: ${phaseInfo.label}`);
console.log(`   Ready: ${phaseInfo.ready}`);
if (phaseInfo.stats) {
  console.log(`   Stats: ${phaseInfo.stats.mx}/${phaseInfo.stats.total} MX, ${phaseInfo.stats.usa}/${phaseInfo.stats.total} USA`);
}
console.log('');

// 2. Detectar batches
console.log('2️⃣  Detectando batches consolidados...');
const batches = getBatchConsolidatedFiles(SELLER_ID);
console.log(`   Batches encontrados: ${batches.length}`);
batches.forEach(b => {
  console.log(`   - Batch ${b.number}`);
  console.log(`     JSON: ${b.json ? '✅' : '❌'}`);
  console.log(`     CSV:  ${b.csv ? '✅' : '❌'}`);
});
console.log('');

// 3. Verificar archivos de oportunidades
console.log('3️⃣  Verificando archivos de oportunidades...');
const opportunityFiles = getAllOpportunitiesFiles(SELLER_ID);
console.log(`   Archivos encontrados: ${opportunityFiles.length}`);
opportunityFiles.forEach(f => {
  console.log(`   - ${f.batchNumber ? 'Batch ' + f.batchNumber : 'Vendedor completo'}`);
  console.log(`     Filtrados:   ${f.filtradosSugeridos ? '✅' : '❌'}`);
  console.log(`     Principal:   ${f.oportunidades ? '✅' : '❌'}`);
  console.log(`     Menos $50:   ${f.oportunidadesMenos50 ? '✅' : '❌'}`);
  console.log(`     Menos $100:  ${f.oportunidadesMenos100 ? '✅' : '❌'}`);
});
console.log('');

// 4. Contar oportunidades
console.log('4️⃣  Contando oportunidades del batch 1...');
countOpportunities(SELLER_ID, BATCH_NUMBER).then(counts => {
  console.log(`   Principal:   ${counts.principal} productos`);
  console.log(`   Menos $50:   ${counts.menos50} productos`);
  console.log(`   Menos $100:  ${counts.menos100} productos`);
  console.log(`   TOTAL:       ${counts.total} oportunidades`);
  console.log('');
  
  // 5. Resumen final
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TEST COMPLETADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📊 RESUMEN:');
  console.log(`   Vendedor: ${SELLER_ID}`);
  console.log(`   Fase: ${phaseInfo.label}`);
  console.log(`   Batches: ${batches.length}`);
  console.log(`   Verificaciones: ${phaseInfo.stats.mx}/${phaseInfo.stats.total} MX, ${phaseInfo.stats.usa}/${phaseInfo.stats.total} USA`);
  console.log(`   Oportunidades: ${counts.total} encontradas`);
  console.log('');
  
  if (phaseInfo.phase === 5) {
    console.log('🎯 SIGUIENTE PASO: Menú [7] Gestión de Plantillas');
  } else if (phaseInfo.phase === 4) {
    console.log('🎯 SIGUIENTE PASO: Generar oportunidades (ya ejecutado manualmente)');
  } else {
    console.log('⚠️  PENDIENTE: Completar verificaciones MX y USA');
  }
  console.log('');
}).catch(err => {
  console.error('❌ Error al contar oportunidades:', err.message);
  process.exit(1);
});
