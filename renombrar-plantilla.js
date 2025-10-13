import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🔄 RENOMBRAR PLANTILLA - .xlsm → .xlsx (SIMPLE)');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('⚠️  ADVERTENCIA: Este script solo COPIA y RENOMBRA el archivo.');
console.log('   Las macros seguirán dentro, pero Excel puede abrirlo como .xlsx');
console.log('');

// 🧠 Argumento: SELLER_ID
const sellerId = process.argv[2];
if (!sellerId) {
  console.error('❌ Debes proporcionar el SELLER_ID como argumento');
  console.error('');
  console.error('Uso: node renombrar-plantilla.js SELLER_ID');
  console.error('Ejemplo: node renombrar-plantilla.js A3Q5ASRA7J8Y5E');
  console.error('');
  process.exit(1);
}

console.log(`📦 Vendedor: ${sellerId}`);
console.log('');

// 📁 Rutas
const vendorDir = path.join(__dirname, 'data', 'vendors', sellerId);
const plantillasDir = path.join(vendorDir, 'plantillas');

if (!fs.existsSync(vendorDir)) {
  console.error(`❌ No existe el directorio del vendedor: ${vendorDir}`);
  process.exit(1);
}

if (!fs.existsSync(plantillasDir)) {
  console.error(`❌ No existe el directorio de plantillas: ${plantillasDir}`);
  process.exit(1);
}

// 🔍 Buscar plantilla .xlsm más reciente
const plantillas = fs.readdirSync(plantillasDir)
  .filter(f => f.startsWith('plantilla_') && f.endsWith('.xlsm'))
  .map(f => ({
    archivo: f,
    fecha: fs.statSync(path.join(plantillasDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.fecha - a.fecha);

if (plantillas.length === 0) {
  console.log('⚠️  No se encontró ninguna plantilla .xlsm');
  console.log('');
  
  // Buscar .xlsx
  const plantillasXlsx = fs.readdirSync(plantillasDir)
    .filter(f => f.startsWith('plantilla_') && f.endsWith('.xlsx'));
  
  if (plantillasXlsx.length > 0) {
    console.log('✅ Ya tienes plantillas .xlsx:');
    plantillasXlsx.forEach(f => console.log(`   - ${f}`));
    console.log('');
    console.log('💡 Puedes usar directamente:');
    console.log(`   node llenar-plantilla-seller.js ${sellerId}`);
  }
  
  process.exit(0);
}

const archivoOrigen = plantillas[0].archivo;
const rutaOrigen = path.join(plantillasDir, archivoOrigen);
const archivoDestino = archivoOrigen.replace('.xlsm', '.xlsx');
const rutaDestino = path.join(plantillasDir, archivoDestino);

console.log(`📄 Archivo origen: ${archivoOrigen}`);
console.log(`📄 Archivo destino: ${archivoDestino}`);
console.log('');

// Verificar si ya existe
if (fs.existsSync(rutaDestino)) {
  console.log(`⚠️  Ya existe: ${archivoDestino}`);
  console.log('   Se sobrescribirá...');
  console.log('');
}

// Copiar archivo
console.log('📋 Copiando archivo...');
fs.copyFileSync(rutaOrigen, rutaDestino);

const tamaño = fs.statSync(rutaDestino).size;
console.log(`✅ Archivo copiado (${(tamaño / 1024).toFixed(2)} KB)`);
console.log('');

console.log('═══════════════════════════════════════════════════════════');
console.log('✅ ARCHIVO RENOMBRADO');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log(`📄 Nuevo archivo: ${archivoDestino}`);
console.log(`📁 Ubicación: ${plantillasDir}`);
console.log('');
console.log('⚠️  IMPORTANTE:');
console.log('   - El archivo sigue conteniendo macros internamente');
console.log('   - Pero Excel lo abrirá como .xlsx');
console.log('   - Esto puede funcionar con exceljs');
console.log('');
console.log('⏭️  Siguiente paso:');
console.log(`   node llenar-plantilla-seller.js ${sellerId}`);
console.log('');
