const fs = require('fs');
const path = require('path');

console.log('🧹 === LIMPIEZA Y ORGANIZACIÓN DE ARCHIVOS ===\n');

const rootDir = __dirname;

// Obtener todos los archivos JS en el directorio raíz
const jsFiles = fs.readdirSync(rootDir)
  .filter(file => file.endsWith('.js') && !file.includes('node_modules'))
  .sort();

console.log('📁 ARCHIVOS JAVASCRIPT EN EL PROYECTO:\n');

// Clasificar archivos
const functional = [];
const problematic = [];
const utilities = [];

jsFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  const modified = stats.mtime.toLocaleDateString();
  
  // Clasificar según lo documentado
  if (['category-detailed-test.js', 'test-seller.js', 'create-test-plan.js', 'reset-plan.js'].includes(file)) {
    functional.push({ file, sizeKB, modified });
  } else if (['complete-test.js'].includes(file)) {
    problematic.push({ file, sizeKB, modified });
  } else {
    utilities.push({ file, sizeKB, modified });
  }
});

console.log('✅ ARCHIVOS FUNCIONALES (USAR ESTOS):');
functional.forEach(({ file, sizeKB, modified }) => {
  console.log(`   📄 ${file.padEnd(30)} (${sizeKB} KB, ${modified})`);
});

console.log('\n❌ ARCHIVOS PROBLEMÁTICOS (NO USAR):');
problematic.forEach(({ file, sizeKB, modified }) => {
  console.log(`   🚫 ${file.padEnd(30)} (${sizeKB} KB, ${modified})`);
});

console.log('\n⚙️ OTROS ARCHIVOS:');
utilities.forEach(({ file, sizeKB, modified }) => {
  console.log(`   📄 ${file.padEnd(30)} (${sizeKB} KB, ${modified})`);
});

// Verificar archivos archivados
const archiveDir = path.join(rootDir, 'archive');
if (fs.existsSync(archiveDir)) {
  const archivedFiles = fs.readdirSync(archiveDir).filter(file => file.endsWith('.js'));
  console.log('\n📦 ARCHIVOS ARCHIVADOS (MOVIDOS):');
  archivedFiles.forEach(file => {
    const filePath = path.join(archiveDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`   🗃️  ${file.padEnd(30)} (${sizeKB} KB)`);
  });
}

// Contar líneas de código funcional vs problemático
console.log('\n📊 ESTADÍSTICAS:');
console.log(`✅ Archivos funcionales: ${functional.length}`);
console.log(`❌ Archivos problemáticos: ${problematic.length}`);
console.log(`⚙️  Otros archivos: ${utilities.length}`);

// Recomendaciones
console.log('\n🎯 RECOMENDACIONES:');
console.log('1. USAR SIEMPRE: category-detailed-test.js como base');
console.log('2. MEJORAR: Agregar detección incremental a base funcional');
console.log('3. NO CREAR: Nuevos scripts desde cero');
console.log('4. LEER: DOCUMENTACION-FINAL.md antes de programar');

console.log('\n🚀 PRÓXIMO PASO:');
console.log('   node category-detailed-test.js (validar base funcional)');