const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { parse } = require('json2csv');

// Recibe seller_id como argumento
const seller_id = process.argv[2];
if (!seller_id) {
  console.error('Debes proporcionar el seller_id como argumento. Ejemplo: node prepare-business-csv.js A3Q5ASRA7J8Y5E');
  process.exit(1);
}

// Define rutas usando el seller_id
const baseDir = path.join(__dirname, 'data', 'vendors', seller_id);
const INPUT = path.join(baseDir, 'all-products-consolidated.csv');
const OUTPUT = path.join(baseDir, 'productos-filtrados-sugeridos.csv');

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
    const output = parse(resultado, { fields: [...campos, 'precio_sugerido'] });
    fs.writeFileSync(OUTPUT, output, 'utf8');
    console.log(`¡Listo! Archivo generado: ${OUTPUT}`);
  });
