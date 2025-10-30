const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { parse } = require('json2csv');

// Recibe seller_id y opcionalmente batch_number como argumentos
const seller_id = process.argv[2];
const batch_number = process.argv[3]; // Opcional

if (!seller_id) {
  console.error('❌ Debes proporcionar el seller_id como argumento.');
  console.log('📖 Uso:');
  console.log('   node prepare_business_csv.js SELLER_ID           # Vendedor pequeño (all-products-consolidated.csv)');
  console.log('   node prepare_business_csv.js SELLER_ID BATCH_NUM # Vendedor con batches (batch-N-consolidated.csv)');
  console.log('');
  console.log('📝 Ejemplos:');
  console.log('   node prepare_business_csv.js A3Q5ASRA7J8Y5E');
  console.log('   node prepare_business_csv.js A3Q5ASRA7J8Y5E 1');
  process.exit(1);
}

// Define rutas usando el seller_id y batch_number
const baseDir = path.join(__dirname, 'data', 'vendors', seller_id);

let INPUT, OUTPUT;
if (batch_number) {
  // Vendedor con batches: lee batch-N-consolidated.csv
  INPUT = path.join(baseDir, `batch-${batch_number}-consolidated.csv`);
  OUTPUT = path.join(baseDir, `batch-${batch_number}-productos-filtrados-sugeridos.csv`);
  console.log(`📦 Procesando BATCH ${batch_number} del vendedor ${seller_id}`);
} else {
  // Vendedor pequeño: lee all-products-consolidated.csv
  INPUT = path.join(baseDir, 'all-products-consolidated.csv');
  OUTPUT = path.join(baseDir, 'productos-filtrados-sugeridos.csv');
  console.log(`📦 Procesando vendedor pequeño ${seller_id} (consolidado completo)`);
}

// Validar que existe el archivo de entrada
if (!fs.existsSync(INPUT)) {
  console.error(`❌ No existe el archivo: ${INPUT}`);
  console.log('💡 Asegúrate de haber consolidado los productos primero.');
  process.exit(1);
}

const campos = [
  'asin',
  'precio_actual_mx',
  'precio_actual_usd',
  'price',
  'title',
  'vendedor_actual_mx',
  'vendedor_actual_usa'
];

let resultado = [];

fs.createReadStream(INPUT)
  .pipe(csv())
  .on('data', (row) => {
    // Validamos existencia de los tres campos necesarios
    if (
      row['precio_actual_mx'] &&
      row['precio_actual_usd'] &&
      row['price']
    ) {
      let nuevo = {};
      campos.forEach(campo => nuevo[campo] = row[campo] || '');
      // Cálculo de precio_sugerido
      let precio_usd = parseFloat(row['precio_actual_usd']);
      if (!isNaN(precio_usd)) {
        nuevo['precio_sugerido'] = (precio_usd * 41.79 + 314.81).toFixed(2);
      } else {
        nuevo['precio_sugerido'] = '';
      }
      resultado.push(nuevo);
    }
  })
  .on('end', () => {
    if (resultado.length === 0) {
      console.log('⚠️  No se encontraron productos con los tres campos necesarios (precio_actual_mx, precio_actual_usd, price)');
      process.exit(0);
    }
    
    const output = parse(resultado, { fields: [...campos, 'precio_sugerido'] });
    fs.writeFileSync(OUTPUT, output, 'utf8');
    
    console.log('');
    console.log('✅ ¡Proceso completado!');
    console.log(`📄 Archivo generado: ${OUTPUT}`);
    console.log(`📊 Total de productos filtrados: ${resultado.length}`);
    console.log('');
    console.log('📌 Siguiente paso: Ejecutar buscando_productos_csv.js para generar archivos de oportunidades');
  });
