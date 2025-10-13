import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  🔄 CONVERTIDOR DE PLANTILLA - .xlsm a .xlsx');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// 🧠 Argumento: SELLER_ID
const sellerId = process.argv[2];
if (!sellerId) {
  console.error('❌ Debes proporcionar el SELLER_ID como argumento');
  console.error('');
  console.error('Uso: node convertir-plantilla.js SELLER_ID');
  console.error('Ejemplo: node convertir-plantilla.js A3Q5ASRA7J8Y5E');
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
  console.error('   Asegúrate de haber descargado la plantilla primero.');
  console.error('');
  process.exit(1);
}

// 🔍 Buscar plantilla más reciente .xlsm
const plantillas = fs.readdirSync(plantillasDir)
  .filter(f => f.startsWith('plantilla_') && f.endsWith('.xlsm'))
  .map(f => ({
    archivo: f,
    fecha: fs.statSync(path.join(plantillasDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.fecha - a.fecha);

if (plantillas.length === 0) {
  console.log('⚠️  No se encontró ninguna plantilla .xlsm en el directorio');
  console.log(`   ${plantillasDir}`);
  console.log('');
  
  // Buscar si ya existe .xlsx
  const plantillasXlsx = fs.readdirSync(plantillasDir)
    .filter(f => f.startsWith('plantilla_') && f.endsWith('.xlsx'));
  
  if (plantillasXlsx.length > 0) {
    console.log('✅ Sin embargo, encontré estas plantillas .xlsx ya convertidas:');
    plantillasXlsx.forEach(f => console.log(`   - ${f}`));
    console.log('');
    console.log('💡 Puedes usar directamente el script llenar-plantilla-seller.js');
    console.log('');
  } else {
    console.log('💡 Asegúrate de haber descargado la plantilla primero.');
  }
  
  process.exit(0);
}

const plantillaFile = plantillas[0].archivo;
const plantillaPath = path.join(plantillasDir, plantillaFile);

console.log(`📄 Plantilla encontrada: ${plantillaFile}`);
console.log(`   Tamaño: ${(fs.statSync(plantillaPath).size / 1024).toFixed(2)} KB`);
console.log('');

// Generar nombre del archivo de salida
const archivoSalida = plantillaFile.replace('.xlsm', '.xlsx');
const rutaSalida = path.join(plantillasDir, archivoSalida);

console.log('🔄 Convirtiendo plantilla...');
console.log('   (Eliminando macros y guardando como .xlsx)');
console.log('');

async function convertirPlantilla() {
  // Verificar si ya existe
  if (fs.existsSync(rutaSalida)) {
    console.log(`⚠️  Ya existe un archivo convertido: ${archivoSalida}`);
    console.log('');
    console.log('¿Qué deseas hacer?');
    console.log('   Se sobrescribirá automáticamente en 5 segundos...');
    console.log('   O presiona Ctrl+C para cancelar');
    console.log('');
    
    // Esperar 5 segundos
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    console.log('📖 Paso 1: Leyendo archivo .xlsm...');
    console.log('   ⏱️  Timeout: 15 segundos máximo...');
    console.log('');
    
    // Timeout más corto de 15 segundos
    const workbook = new ExcelJS.Workbook();
    
    let timeoutReached = false;
    const timeout = new Promise((_, reject) => {
      setTimeout(() => {
        timeoutReached = true;
        reject(new Error('TIMEOUT'));
      }, 15000);
    });
    
    // Mostrar progreso cada 3 segundos
    const progressInterval = setInterval(() => {
      if (!timeoutReached) {
        console.log('   ⏳ Todavía leyendo archivo...');
      }
    }, 3000);
    
    const readFile = workbook.xlsx.readFile(plantillaPath);
    
    await Promise.race([readFile, timeout]);
    
    clearInterval(progressInterval);
    
    console.log(`   ✅ Archivo leído (${workbook.worksheets.length} hojas)`);
    console.log('');
    
    console.log('💾 Paso 2: Guardando como .xlsx (sin macros)...');
    console.log(`   Archivo: ${archivoSalida}`);
    
    await workbook.xlsx.writeFile(rutaSalida);
    
    const tamañoSalida = fs.statSync(rutaSalida).size;
    
    console.log(`   ✅ Archivo guardado (${(tamañoSalida / 1024).toFixed(2)} KB)`);
    console.log('');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CONVERSIÓN EXITOSA');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`📄 Archivo original: ${plantillaFile}`);
    console.log(`📄 Archivo nuevo:    ${archivoSalida}`);
    console.log(`📁 Ubicación:        ${plantillasDir}`);
    console.log('');
    console.log('✨ La plantilla .xlsx está lista para usar');
    console.log('   (Sin macros, más rápida y compatible)');
    console.log('');
    console.log('⏭️  Siguiente paso: Llenar la plantilla');
    console.log(`   node llenar-plantilla-seller.js ${sellerId}`);
    console.log('');
    
  } catch (error) {
    console.error('');
    
    if (error.message === 'TIMEOUT') {
      console.error('❌ TIMEOUT: El archivo tardó más de 15 segundos en abrirse');
      console.error('');
      console.error('📌 PROBLEMA: ExcelJS no puede leer archivos .xlsm con macros complejas');
      console.error('');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('💡 SOLUCIÓN MANUAL (2 minutos):');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('');
      console.error('1️⃣  Abre Excel y carga el archivo:');
      console.error(`   ${plantillaPath}`);
      console.error('');
      console.error('2️⃣  En Excel: Archivo → Guardar como');
      console.error('');
      console.error('3️⃣  Selecciona formato: "Libro de Excel (*.xlsx)"');
      console.error('    (NO selecciones "Libro de Excel habilitado para macros")');
      console.error('');
      console.error('4️⃣  Guárdalo en la misma carpeta con nombre:');
      console.error(`   ${archivoSalida}`);
      console.error('');
      console.error('5️⃣  Una vez guardado, ejecuta:');
      console.error(`   node llenar-plantilla-seller.js ${sellerId}`);
      console.error('');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('');
      console.error('📝 NOTA: Las macros NO son necesarias para llenar la plantilla.');
      console.error('   El archivo .xlsx funcionará perfectamente.');
      console.error('');
    } else {
      console.error('❌ Error durante la conversión:', error.message);
      console.error('');
      console.error('Detalles técnicos:');
      console.error(error);
      console.error('');
    }
    
    process.exit(1);
  }
}

// Ejecutar conversión
convertirPlantilla();
