const fs = require('fs');
const path = require('path');

const VENDOR_ID = 'A3Q5ASRA7J8Y5E';
const VENDOR_DIR = path.join(__dirname, 'data', 'vendors', VENDOR_ID);

console.log('🧪 === PRUEBA MODALIDAD 3 (FUNCIÓN DIRECTA) ===\n');

/**
 * Función simplificada para testing de generación de oportunidades consolidadas
 */
async function testGenerarOportunidadesConsolidadas(sellerId) {
  const { parse } = require('json2csv');
  
  console.log('🔄 Iniciando generación de oportunidades consolidadas...');
  
  const baseDir = path.join(__dirname, 'data', 'vendors', sellerId);
  
  // Leer archivo consolidado completo
  const archivoConsolidado = path.join(baseDir, 'all-products-consolidated.json');
  
  if (!fs.existsSync(archivoConsolidado)) {
    console.log('❌ No existe archivo all-products-consolidated.json');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(archivoConsolidado, 'utf8'));
  const productos = data.all_products || data.products || [];
  
  console.log(`📊 Total productos: ${productos.length}`);
  
  // Aplicar filtros (lógica EXACTA de los scripts originales)
  console.log('🔍 Aplicando filtros...');
  
  // PASO 1: Filtrar productos con datos completos
  const productosFiltrados = productos.filter(producto => {
    return producto.precio_actual_mx && 
           producto.precio_actual_usd && 
           producto.price;
  });
  
  console.log(`✅ Productos filtrados: ${productosFiltrados.length}`);
  
  // PASO 2: Calcular precio sugerido
  const productosConPrecioSugerido = [];
  
  for (const producto of productosFiltrados) {
    let nuevo = { ...producto };
    
    // Cálculo EXACTO de precio_sugerido
    let precio_usd = parseFloat(producto.precio_actual_usd);
    if (!isNaN(precio_usd)) {
      nuevo.precio_sugerido = (precio_usd * 41.79 + 314.81).toFixed(2);
    } else {
      nuevo.precio_sugerido = '';
    }
    
    productosConPrecioSugerido.push(nuevo);
  }
  
  // PASO 3: Aplicar filtros de oportunidades
  
  // Función ajustarCompetitivo EXACTA
  function ajustarCompetitivo(precio_actual_mx, competitivo) {
    if (precio_actual_mx <= 2500) {
      const limite = precio_actual_mx - 100;
      return competitivo < limite ? limite : competitivo;
    } else {
      const limite = precio_actual_mx - 200;
      return competitivo < limite ? limite : competitivo;
    }
  }
  
  let usados = new Set();
  let oportunidades = [];
  let oportunidades_menos_50 = [];
  let oportunidades_menos_100 = [];
  
  const PRECIO_MAXIMO = 7000;
  let excluidos_por_precio = 0;
  
  // 1. Primer filtro: precio_sugerido < precio_actual_mx
  productosConPrecioSugerido.forEach(row => {
    const sugerido = parseFloat(row.precio_sugerido);
    const actual = parseFloat(row.precio_actual_mx);
    
    if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
      excluidos_por_precio++;
      return;
    }
    
    if (!isNaN(sugerido) && !isNaN(actual) && sugerido < actual) {
      let competitivo = ajustarCompetitivo(actual, sugerido);
      let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
      oportunidades.push(nuevo);
      usados.add(row.asin);
    }
  });
  
  // 2. Segundo filtro: (precio_sugerido - 50) < precio_actual_mx
  productosConPrecioSugerido.forEach(row => {
    if (!usados.has(row.asin)) {
      const sugerido = parseFloat(row.precio_sugerido);
      const actual = parseFloat(row.precio_actual_mx);
      
      if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
        return;
      }
      
      if (!isNaN(sugerido) && !isNaN(actual)) {
        if ((sugerido - 50) < actual && sugerido >= actual) {
          let competitivo = ajustarCompetitivo(actual, sugerido - 50);
          let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
          oportunidades_menos_50.push(nuevo);
          usados.add(row.asin);
        }
      }
    }
  });
  
  // 3. Tercer filtro: (precio_sugerido - 100) < precio_actual_mx
  productosConPrecioSugerido.forEach(row => {
    if (!usados.has(row.asin)) {
      const sugerido = parseFloat(row.precio_sugerido);
      const actual = parseFloat(row.precio_actual_mx);
      
      if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
        return;
      }
      
      if (!isNaN(sugerido) && !isNaN(actual)) {
        if ((sugerido - 100) < actual && (sugerido - 50) >= actual) {
          let competitivo = ajustarCompetitivo(actual, sugerido - 100);
          let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
          oportunidades_menos_100.push(nuevo);
          usados.add(row.asin);
        }
      }
    }
  });
  
  console.log(`📊 Oportunidades principales: ${oportunidades.length}`);
  console.log(`📊 Oportunidades menos $50: ${oportunidades_menos_50.length}`);
  console.log(`📊 Oportunidades menos $100: ${oportunidades_menos_100.length}`);
  
  if (excluidos_por_precio > 0) {
    console.log(`⚠️  Excluidos por precio > $${PRECIO_MAXIMO.toLocaleString()}: ${excluidos_por_precio}`);
  }
  
  // PASO 4: Generar archivos CSV
  console.log('📄 Generando archivos CSV...');
  
  const campos = [
    'asin', 'precio_actual_mx', 'precio_actual_usd', 'price', 'title',
    'precio_sugerido', 'url_usa', 'vendedor_actual_mx', 'vendedor_actual_usa', 'precio_competitivo'
  ];
  
  const archivos = [
    { datos: oportunidades, nombre: 'vendedor-oportunidades.csv' },
    { datos: oportunidades_menos_50, nombre: 'vendedor-oportunidades_menos_50.csv' },
    { datos: oportunidades_menos_100, nombre: 'vendedor-oportunidades_menos_100.csv' }
  ];
  
  let archivosGenerados = 0;
  
  for (const archivo of archivos) {
    if (archivo.datos.length > 0) {
      try {
        const csvData = parse(archivo.datos, { fields: campos });
        const rutaArchivo = path.join(baseDir, archivo.nombre);
        fs.writeFileSync(rutaArchivo, csvData);
        archivosGenerados++;
        console.log(`✅ ${archivo.nombre}: ${archivo.datos.length} productos`);
      } catch (error) {
        console.log(`❌ Error generando ${archivo.nombre}: ${error.message}`);
      }
    } else {
      console.log(`⚠️  ${archivo.nombre}: Sin datos para generar`);
    }
  }
  
  console.log(`\n✅ Generación completada: ${archivosGenerados} archivos generados`);
  return archivosGenerados;
}

// Verificar archivos generados
function checkGeneratedFiles() {
  console.log('\n🔍 === VERIFICANDO ARCHIVOS GENERADOS ===');
  
  const expectedFiles = [
    'vendedor-oportunidades.csv',
    'vendedor-oportunidades_menos_50.csv',
    'vendedor-oportunidades_menos_100.csv'
  ];
  
  expectedFiles.forEach(filename => {
    const filePath = path.join(VENDOR_DIR, filename);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${filename}: EXISTE`);
      
      // Verificar si tiene precio_competitivo
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const hasPrecioCompetitivo = content.includes('precio_competitivo');
        console.log(`   📊 precio_competitivo: ${hasPrecioCompetitivo ? '✅ SÍ' : '❌ NO'}`);
        
        // Contar líneas (productos)
        const lines = content.split('\n').filter(line => line.trim());
        const productCount = lines.length > 1 ? lines.length - 1 : 0; // -1 por header
        console.log(`   📦 Productos: ${productCount}`);
        
      } catch (err) {
        console.log(`   ❌ Error leyendo archivo: ${err.message}`);
      }
    } else {
      console.log(`❌ ${filename}: NO EXISTE`);
    }
  });
}

// Ejecutar prueba
async function runTest() {
  try {
    await testGenerarOportunidadesConsolidadas(VENDOR_ID);
    checkGeneratedFiles();
    
    console.log('\n🏁 === PRUEBA COMPLETADA ===');
    
  } catch (error) {
    console.log('❌ Error durante la prueba:', error.message);
    console.log('Stack:', error.stack);
  }
}

// Ejecutar
runTest().catch(console.error);