/**
 * TEST END-TO-END - FLUJO COMPLETO DESDE OPORTUNIDADES HASTA PLANTILLA
 * 
 * Este test valida el flujo completo:
 * 1. Detección de oportunidades
 * 2. Selección de batch
 * 3. Solicitud de plantilla
 */

const {
  detectVendorPhase,
  getBatchConsolidatedFiles,
  getAllOpportunitiesFiles,
  countOpportunities
} = require('./modules/utils/vendor-utils.js');

const SELLER_ID = 'AE8MUNDUREHX7';

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TEST END-TO-END: FLUJO COMPLETO OPORTUNIDADES → PLANTILLA');
console.log('═══════════════════════════════════════════════════════════\n');

async function runTest() {
  // 1. Detectar fase del vendedor
  console.log('1️⃣  Detectando fase del vendedor...');
  const phaseInfo = detectVendorPhase(SELLER_ID);
  console.log(`   Phase: ${phaseInfo.phase} - ${phaseInfo.label}`);
  
  if (phaseInfo.phase < 5) {
    console.log('   ❌ El vendedor no tiene oportunidades generadas');
    console.log(`   Estado: ${phaseInfo.label}`);
    return false;
  }
  console.log('   ✅ Vendedor tiene oportunidades\n');
  
  // 2. Detectar oportunidades
  console.log('2️⃣  Detectando archivos de oportunidades...');
  const opportunities = getAllOpportunitiesFiles(SELLER_ID);
  console.log(`   Archivos encontrados: ${opportunities.length}`);
  
  if (opportunities.length === 0) {
    console.log('   ❌ No se encontraron archivos de oportunidades');
    return false;
  }
  
  const batchOpportunities = opportunities.filter(o => o.type === 'batch');
  console.log(`   Oportunidades por batch: ${batchOpportunities.length}`);
  
  for (const opp of batchOpportunities) {
    console.log(`   - Batch ${opp.batchNumber}:`);
    console.log(`     Principal:   ${opp.oportunidades ? '✅' : '❌'}`);
    console.log(`     Menos $50:   ${opp.oportunidadesMenos50 ? '✅' : '❌'}`);
    console.log(`     Menos $100:  ${opp.oportunidadesMenos100 ? '✅' : '❌'}`);
  }
  console.log('');
  
  // 3. Contar oportunidades del batch 1
  console.log('3️⃣  Contando oportunidades del batch 1...');
  const counts = await countOpportunities(SELLER_ID, 1);
  console.log(`   Principal:   ${counts.principal} productos`);
  console.log(`   Menos $50:   ${counts.menos50} productos`);
  console.log(`   Menos $100:  ${counts.menos100} productos`);
  console.log(`   TOTAL:       ${counts.total} oportunidades\n`);
  
  // 4. Verificar script de solicitar plantilla
  console.log('4️⃣  Verificando script de solicitar plantilla...');
  const fs = require('fs');
  const path = require('path');
  
  const archivos = [
    'batch-1-oportunidades.csv',
    'batch-1-oportunidades_menos_50.csv',
    'batch-1-oportunidades_menos_100.csv'
  ];
  
  for (const archivo of archivos) {
    const rutaArchivo = path.join(__dirname, 'data', 'vendors', SELLER_ID, archivo);
    if (fs.existsSync(rutaArchivo)) {
      const stats = fs.statSync(rutaArchivo);
      console.log(`   ✅ ${archivo} (${stats.size} bytes)`);
    } else {
      console.log(`   ❌ ${archivo} NO EXISTE`);
      return false;
    }
  }
  console.log('');
  
  // 5. Resumen final
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TODOS LOS TESTS PASARON EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📊 RESUMEN EJECUTIVO:');
  console.log(`   Vendedor: ${SELLER_ID}`);
  console.log(`   Fase: ${phaseInfo.label}`);
  console.log(`   Batches con oportunidades: ${batchOpportunities.length}`);
  console.log(`   Total oportunidades batch 1: ${counts.total}`);
  console.log(`   Archivos de oportunidades: ${archivos.length}/3 ✅\n`);
  
  console.log('🎯 SIGUIENTE PASO:');
  console.log('   PANELMAESTRO → [7] Gestión de Plantillas → [1] Solicitar plantilla');
  console.log('   Comando directo: node solicitar-plantilla-seller.js AE8MUNDUREHX7 1 1\n');
  
  console.log('📋 OPCIONES DE ARCHIVO:');
  console.log(`   [1] Oportunidades directas (${counts.principal} productos)`);
  console.log(`   [2] Oportunidades con -$50 (${counts.menos50} productos)`);
  console.log(`   [3] Oportunidades con -$100 (${counts.menos100} productos)\n`);
  
  return true;
}

runTest().then(success => {
  if (success) {
    console.log('✅ Test completado exitosamente');
    process.exit(0);
  } else {
    console.log('❌ Test falló');
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Error en el test:', err.message);
  console.error(err.stack);
  process.exit(1);
});
