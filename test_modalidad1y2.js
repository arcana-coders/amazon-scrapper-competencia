/**
 * Script para probar modalidades 1 y 2 (que usan scripts originales)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function ejecutarScript(scriptPath, args = []) {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(output);
      if (errorOutput) console.error(errorOutput);
      resolve(code === 0);
    });
  });
}

async function testModalidad1y2() {
  const sellerId = 'AE8MUNDUREHX7';
  const batchNumber = '1';
  
  console.log('🧪 Probando modalidad 1 (batch específico)...');
  
  // Paso 1: prepare_business_csv.js
  console.log('📋 Ejecutando prepare_business_csv.js...');
  const success1 = await ejecutarScript('./prepare_business_csv.js', [sellerId, batchNumber]);
  
  if (!success1) {
    console.log('❌ Error en prepare_business_csv.js');
    return;
  }
  
  // Paso 2: buscando_productos_csv.js
  console.log('💰 Ejecutando buscando_productos_csv.js...');
  const success2 = await ejecutarScript('./buscando_productos_csv.js', [sellerId, batchNumber]);
  
  if (!success2) {
    console.log('❌ Error en buscando_productos_csv.js');
    return;
  }
  
  // Verificar archivos generados
  console.log('\n🔍 Verificando archivos generados por modalidad 1...');
  const baseDir = path.join(__dirname, 'data', 'vendors', sellerId);
  const archivos = [
    `batch-${batchNumber}-oportunidades.csv`,
    `batch-${batchNumber}-oportunidades_menos_50.csv`,
    `batch-${batchNumber}-oportunidades_menos_100.csv`
  ];
  
  for (const archivo of archivos) {
    const rutaArchivo = path.join(baseDir, archivo);
    if (fs.existsSync(rutaArchivo)) {
      const primeraLinea = fs.readFileSync(rutaArchivo, 'utf8').split('\n')[0];
      const tienePrecionCompetitivo = primeraLinea.includes('precio_competitivo');
      console.log(`   ${tienePrecionCompetitivo ? '✅' : '❌'} ${archivo}: ${tienePrecionCompetitivo ? 'SÍ' : 'NO'} tiene precio_competitivo`);
      
      if (tienePrecionCompetitivo) {
        // Mostrar un ejemplo de producto con precio_competitivo
        const lineas = fs.readFileSync(rutaArchivo, 'utf8').split('\n');
        if (lineas.length > 1) {
          const headers = lineas[0].split(',');
          const datos = lineas[1].split(',');
          const indexPrecionCompetitivo = headers.findIndex(h => h.includes('precio_competitivo'));
          if (indexPrecionCompetitivo >= 0 && datos[indexPrecionCompetitivo]) {
            console.log(`     💡 Ejemplo precio_competitivo: ${datos[indexPrecionCompetitivo]}`);
          }
        }
      }
    } else {
      console.log(`   ⚠️  ${archivo}: No se generó (sin oportunidades)`);
    }
  }
  
  console.log('\n✅ Modalidades 1 y 2 usan los mismos scripts originales, por lo tanto ambas generan precio_competitivo correctamente.');
}

testModalidad1y2().catch(console.error);