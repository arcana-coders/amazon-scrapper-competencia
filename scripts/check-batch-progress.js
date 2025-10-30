const fs = require('fs');
const path = require('path');

/**
 * VERIFICADOR DE PROGRESO DE BATCH
 * 
 * Muestra el estado de verificación (MX y USA) de un batch.
 * 
 * USO:
 *   node scripts/check-batch-progress.js SELLER_ID BATCH_NUM
 * 
 * EJEMPLO:
 *   node scripts/check-batch-progress.js AE8MUNDUREHX7 1
 */

const SELLER_ID = process.argv[2];
const BATCH_NUMBER = process.argv[3];

if (!SELLER_ID || !BATCH_NUMBER) {
  console.error('❌ Faltan parámetros');
  console.log('📖 Uso: node scripts/check-batch-progress.js SELLER_ID BATCH_NUM');
  console.log('📝 Ejemplo: node scripts/check-batch-progress.js AE8MUNDUREHX7 1');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data', 'vendors', SELLER_ID);
const BATCH_FILE = path.join(DATA_DIR, `batch-${BATCH_NUMBER}-consolidated.json`);

if (!fs.existsSync(BATCH_FILE)) {
  console.error(`❌ No existe el archivo: ${BATCH_FILE}`);
  process.exit(1);
}

console.log(`\n📊 PROGRESO DEL BATCH ${BATCH_NUMBER} - ${SELLER_ID}\n`);

const rawData = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf8'));
const productos = rawData.all_products || rawData.products || rawData;

if (!Array.isArray(productos)) {
  console.error('❌ Formato inesperado en el archivo');
  process.exit(1);
}

const total = productos.length;

// Verificación MX
const conMX = productos.filter(p => p.precio_actual_mx !== null && p.precio_actual_mx !== undefined).length;
const sinMX = total - conMX;
const progresoMX = ((conMX / total) * 100).toFixed(2);

// Verificación USA
const conUSA = productos.filter(p => p.precio_actual_usd !== null && p.precio_actual_usd !== undefined).length;
const sinUSA = total - conUSA;
const progresoUSA = ((conUSA / total) * 100).toFixed(2);

// Barra de progreso
const crearBarra = (porcentaje) => {
  const total = 30;
  const lleno = Math.round((porcentaje / 100) * total);
  const vacio = total - lleno;
  return '█'.repeat(lleno) + '░'.repeat(vacio);
};

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│                   VERIFICACIÓN MX 🇲🇽                    │');
console.log('├─────────────────────────────────────────────────────────┤');
console.log(`│ Total productos:      ${total.toString().padEnd(31)} │`);
console.log(`│ ✅ Verificados:       ${conMX.toString().padEnd(31)} │`);
console.log(`│ ⏳ Pendientes:        ${sinMX.toString().padEnd(31)} │`);
console.log(`│ 📈 Progreso:          ${progresoMX}%`.padEnd(58) + '│');
console.log(`│ ${crearBarra(progresoMX)} │`);
console.log('└─────────────────────────────────────────────────────────┘');

const ejecucionesMX = Math.ceil(sinMX / 20);
if (sinMX > 0) {
  console.log(`\n💡 Ejecuciones restantes (lote 20): ${ejecucionesMX}`);
  console.log(`⏱️  Tiempo estimado: ~${ejecucionesMX * 2} minutos\n`);
  console.log('🚀 Comando para continuar:');
  console.log(`   node scripts/verify-products-mx-batch.js ${SELLER_ID} ${BATCH_NUMBER}\n`);
}

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│                   VERIFICACIÓN USA 🇺🇸                   │');
console.log('├─────────────────────────────────────────────────────────┤');
console.log(`│ Total productos:      ${total.toString().padEnd(31)} │`);
console.log(`│ ✅ Verificados:       ${conUSA.toString().padEnd(31)} │`);
console.log(`│ ⏳ Pendientes:        ${sinUSA.toString().padEnd(31)} │`);
console.log(`│ 📈 Progreso:          ${progresoUSA}%`.padEnd(58) + '│');
console.log(`│ ${crearBarra(progresoUSA)} │`);
console.log('└─────────────────────────────────────────────────────────┘');

const ejecucionesUSA = Math.ceil(sinUSA / 20);
if (sinUSA > 0) {
  console.log(`\n💡 Ejecuciones restantes (lote 20): ${ejecucionesUSA}`);
  console.log(`⏱️  Tiempo estimado: ~${ejecucionesUSA * 2} minutos\n`);
  console.log('🚀 Comando para continuar:');
  console.log(`   node scripts/verify-products-usa-batch.js ${SELLER_ID} ${BATCH_NUMBER}\n`);
}

// Resumen final
console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│                    RESUMEN GENERAL                      │');
console.log('├─────────────────────────────────────────────────────────┤');

if (conMX === total && conUSA === total) {
  console.log('│ 🎉 ¡BATCH COMPLETAMENTE VERIFICADO!                     │');
  console.log('│                                                         │');
  console.log('│ 📌 Siguiente paso:                                      │');
  console.log(`│    node prepare_business_csv.js ${SELLER_ID} ${BATCH_NUMBER}`.padEnd(58) + '│');
} else if (conMX === total && conUSA < total) {
  console.log('│ ✅ Verificación MX completa                             │');
  console.log('│ ⏳ Verificación USA pendiente                           │');
  console.log('│                                                         │');
  console.log('│ 📌 Siguiente paso: Verificar en USA                     │');
} else if (conMX < total) {
  console.log('│ ⏳ Verificación MX pendiente                            │');
  console.log('│                                                         │');
  console.log('│ 📌 Siguiente paso: Verificar en MX                      │');
}

console.log('└─────────────────────────────────────────────────────────┘\n');
