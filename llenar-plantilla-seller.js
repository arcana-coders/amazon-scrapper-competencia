const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const dayjs = require('dayjs');

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  📝 LLENADO DE PLANTILLA - Amazon Seller Central');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// 🧠 Argumento: SELLER_ID
const sellerId = process.argv[2];
if (!sellerId) {
  console.error('❌ Debes proporcionar el SELLER_ID como argumento');
  console.error('');
  console.error('Uso: node llenar-plantilla-seller.js SELLER_ID');
  console.error('Ejemplo: node llenar-plantilla-seller.js A3Q5ASRA7J8Y5E');
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

// 🔍 Buscar plantilla más reciente
const plantillas = fs.readdirSync(plantillasDir)
  .filter(f => f.startsWith('plantilla_') && (f.endsWith('.xlsm') || f.endsWith('.xlsx')))
  .map(f => ({
    archivo: f,
    fecha: fs.statSync(path.join(plantillasDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.fecha - a.fecha);

if (plantillas.length === 0) {
  console.error('❌ No se encontró ninguna plantilla en el directorio');
  console.error(`   ${plantillasDir}`);
  console.error('');
  process.exit(1);
}

const plantillaFile = plantillas[0].archivo;
const plantillaPath = path.join(plantillasDir, plantillaFile);

console.log(`📄 Plantilla encontrada: ${plantillaFile}`);

// 🔍 Determinar qué archivo de oportunidades usar
const projectsPath = path.join(__dirname, 'data', 'projects.json');
let opcionUsada = '1'; // Por defecto oportunidades.csv

if (fs.existsSync(projectsPath)) {
  const projectsData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const project = projectsData.projects?.[sellerId];
  
  if (project?.publication_requests?.oportunidades) {
    opcionUsada = project.publication_requests.oportunidades.option || '1';
  } else if (project?.publication_requests?.menos_50) {
    opcionUsada = '2';
  } else if (project?.publication_requests?.menos_100) {
    opcionUsada = '3';
  }
}

// 📄 Mapear opción a archivo
const archivoOportunidades = {
  '1': 'oportunidades.csv',
  '2': 'oportunidades_menos_50.csv',
  '3': 'oportunidades_menos_100.csv'
}[opcionUsada];

const csvPath = path.join(vendorDir, archivoOportunidades);

if (!fs.existsSync(csvPath)) {
  console.error(`❌ No se encontró el archivo de oportunidades: ${archivoOportunidades}`);
  console.error(`   Ruta: ${csvPath}`);
  console.error('');
  process.exit(1);
}

console.log(`📊 Archivo de oportunidades: ${archivoOportunidades}`);
console.log('');

// 📥 Leer CSV de oportunidades con parser robusto
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const csvContent = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const lines = csvContent.split('\n').filter(l => l.trim() !== '');

if (lines.length < 2) {
  console.error('❌ El archivo CSV está vacío o no tiene datos');
  process.exit(1);
}

// Parsear header
const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

const colASIN = header.findIndex(h => h === 'asin');
const colPrecio = header.findIndex(h => h === 'precio_competitivo');

if (colASIN === -1) {
  console.error('❌ No se encontró la columna "asin" en el CSV');
  console.error(`   Columnas encontradas: ${header.join(', ')}`);
  process.exit(1);
}

if (colPrecio === -1) {
  console.error('❌ No se encontró la columna "precio_competitivo" en el CSV');
  console.error(`   Columnas encontradas: ${header.join(', ')}`);
  process.exit(1);
}

// Crear diccionario de precios
const preciosDict = {};
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const cols = parseCSVLine(line);
  const asin = (cols[colASIN] || '').trim().toUpperCase();
  const precioStr = (cols[colPrecio] || '').replace(/[^0-9.]/g, '');
  const precio = parseFloat(precioStr);
  
  if (asin && !isNaN(precio) && precio > 0) {
    preciosDict[asin] = precio;
  }
}

console.log(`✅ Precios cargados: ${Object.keys(preciosDict).length} productos`);
console.log('');

// 🧾 Leer plantilla Excel
console.log('📖 Leyendo plantilla Excel...');
const workbook = xlsx.readFile(plantillaPath, { cellDates: true });

// Buscar hoja válida (puede ser "Plantilla", "Template", o la primera hoja)
let hoja = workbook.Sheets['Plantilla'] || workbook.Sheets['Template'];
if (!hoja) {
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length > 0) {
    hoja = workbook.Sheets[sheetNames[0]];
    console.log(`   Usando hoja: ${sheetNames[0]}`);
  }
}

if (!hoja) {
  console.error('❌ No se pudo encontrar una hoja válida en la plantilla');
  process.exit(1);
}

// 🔍 Columnas de la plantilla (basado en templates de Amazon)
const COLS = {
  asin: 0,              // A - Product ID (ASIN)
  condicion: 9,         // J - Condition Type
  shipping_class: 13,   // N - Shipping-Template
  fulfillment: 33,      // AH - Fulfillment Channel
  cantidad: 34,         // AI - Quantity
  tiempo_envio: 35,     // AJ - handling-time
  precio_am: 38,        // AM - Price (columna adicional)
  precio: 40,           // AO - Standard Price (CORREGIDO: era 36/AK, ahora 40/AO)
  envio_gratis: 63      // BL - Envio Gratis
};

// 🔍 Buscar ASINs en plantilla (comenzar desde fila 6, típico en templates Amazon)
const ref = xlsx.utils.decode_range(hoja['!ref']);
const asinsEnPlantilla = {};

console.log('🔍 Buscando ASINs en plantilla...');
for (let row = 6; row <= ref.e.r; row++) {
  const cell = hoja[xlsx.utils.encode_cell({ c: COLS.asin, r: row })];
  const asin = cell?.v?.toString().trim().toUpperCase();
  if (asin && asin.length === 10 && asin.startsWith('B')) { // Validar formato ASIN
    asinsEnPlantilla[asin] = row;
  }
}

console.log(`   Encontrados: ${Object.keys(asinsEnPlantilla).length} ASINs`);
console.log('');

if (Object.keys(asinsEnPlantilla).length === 0) {
  console.error('❌ No se encontraron ASINs válidos en la plantilla');
  console.error('   La plantilla puede tener un formato diferente al esperado.');
  process.exit(1);
}

// ✏️ Llenar datos en plantilla
console.log('✏️  Llenando plantilla con precios...');
let actualizados = 0;
let noEncontrados = [];

for (const asin in asinsEnPlantilla) {
  if (preciosDict[asin]) {
    const r = asinsEnPlantilla[asin];

    // Llenar campos requeridos
    hoja[xlsx.utils.encode_cell({ c: COLS.condicion, r })] = { t: 's', v: 'Nuevo' };
    hoja[xlsx.utils.encode_cell({ c: COLS.shipping_class, r })] = { t: 's', v: '3' };
    hoja[xlsx.utils.encode_cell({ c: COLS.fulfillment, r })] = { t: 's', v: 'DEFAULT' };
    hoja[xlsx.utils.encode_cell({ c: COLS.cantidad, r })] = { t: 'n', v: 10 };
    hoja[xlsx.utils.encode_cell({ c: COLS.tiempo_envio, r })] = { t: 'n', v: 8 };
    hoja[xlsx.utils.encode_cell({ c: COLS.precio_am, r })] = { t: 'n', v: preciosDict[asin] };
    hoja[xlsx.utils.encode_cell({ c: COLS.precio, r })] = { t: 'n', v: preciosDict[asin] };
    hoja[xlsx.utils.encode_cell({ c: COLS.envio_gratis, r })] = { t: 's', v: 'Envio Gratis' };

    actualizados++;
  } else {
    noEncontrados.push(asin);
  }
}

console.log(`   ✅ Actualizados: ${actualizados} productos`);
if (noEncontrados.length > 0) {
  console.log(`   ⚠️  Sin precio en CSV: ${noEncontrados.length} productos`);
}
console.log('');

// 💾 Guardar plantilla completada
const fecha = dayjs().format('YYYY-MM-DD_HH-mm');
const salidaFile = `listo_para_subir_${sellerId}_${fecha}.xlsx`;
const salidaPath = path.join(plantillasDir, salidaFile);

console.log('💾 Guardando plantilla completada...');
xlsx.writeFile(workbook, salidaPath);

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('✅ PLANTILLA COMPLETADA EXITOSAMENTE');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log(`📄 Archivo: ${salidaFile}`);
console.log(`📁 Ubicación: ${salidaPath}`);
console.log(`📦 Vendedor: ${sellerId}`);
console.log(`📊 Productos actualizados: ${actualizados}`);
console.log('');
console.log('⏭️  Siguiente paso: Subir la plantilla a Seller Central');
console.log(`   node subir-plantilla-seller.js ${sellerId}`);
console.log('');
