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
  console.log('   node buscando_productos_csv.js SELLER_ID           # Vendedor pequeño');
  console.log('   node buscando_productos_csv.js SELLER_ID BATCH_NUM # Vendedor con batches');
  console.log('');
  console.log('📝 Ejemplos:');
  console.log('   node buscando_productos_csv.js A3Q5ASRA7J8Y5E');
  console.log('   node buscando_productos_csv.js A3Q5ASRA7J8Y5E 1');
  process.exit(1);
}

// Define rutas usando el seller_id y batch_number
const baseDir = path.join(__dirname, 'data', 'vendors', seller_id);

let INPUT, OUTPUT1, OUTPUT2, OUTPUT3;
if (batch_number) {
  // Vendedor con batches
  INPUT = path.join(baseDir, `batch-${batch_number}-productos-filtrados-sugeridos.csv`);
  OUTPUT1 = path.join(baseDir, `batch-${batch_number}-oportunidades.csv`);
  OUTPUT2 = path.join(baseDir, `batch-${batch_number}-oportunidades_menos_50.csv`);
  OUTPUT3 = path.join(baseDir, `batch-${batch_number}-oportunidades_menos_100.csv`);
  console.log(`📦 Generando oportunidades para BATCH ${batch_number} del vendedor ${seller_id}`);
} else {
  // Vendedor pequeño
  INPUT = path.join(baseDir, 'productos-filtrados-sugeridos.csv');
  OUTPUT1 = path.join(baseDir, 'oportunidades.csv');
  OUTPUT2 = path.join(baseDir, 'oportunidades_menos_50.csv');
  OUTPUT3 = path.join(baseDir, 'oportunidades_menos_100.csv');
  console.log(`📦 Generando oportunidades para vendedor pequeño ${seller_id}`);
}

// Validar que existe el archivo de entrada
if (!fs.existsSync(INPUT)) {
  console.error(`❌ No existe el archivo: ${INPUT}`);
  console.log('💡 Asegúrate de haber ejecutado prepare_business_csv.js primero.');
  process.exit(1);
}

function ajustarCompetitivo(precio_actual_mx, competitivo) {
  if (precio_actual_mx <= 2500) {
    const limite = precio_actual_mx - 100;
    return competitivo < limite ? limite : competitivo;
  } else {
    const limite = precio_actual_mx - 200;
    return competitivo < limite ? limite : competitivo;
  }
}

let productos = [];
let total = 0;
let excluidos_por_precio = 0;

// Límites de precio para oportunidades
const PRECIO_MAXIMO = 7000;          // excluir > 7000 en todos los filtros
const PRECIO_MIN_PRINCIPAL = 699;    // incluir solo >= 699 en oportunidad directa
const PRECIO_MIN_OTROS = 1000;       // incluir solo >= 1000 en -50 y -100

fs.createReadStream(INPUT)
  .pipe(csv())
  .on('data', (row) => {
    total++;
    productos.push(row);
  })
  .on('end', () => {
  let usados = new Set();
  let oportunidades = [];
  let oportunidades_menos_50 = [];
  let oportunidades_menos_100 = [];
  let excluidos_por_min_principal = 0;
  let excluidos_por_min_otros = 0;

    // 1. Primer filtro: precio_sugerido < precio_actual_mx
    productos.forEach(row => {
      const sugerido = parseFloat(row['precio_sugerido']);
      const actual = parseFloat(row['precio_actual_mx']);
      
      // Excluir por rango para principal: < 699 o > 7000
      if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
        excluidos_por_precio++;
        return;
      }
      if (!isNaN(actual) && actual < PRECIO_MIN_PRINCIPAL) {
        excluidos_por_min_principal++;
        return;
      }
      
      if (!isNaN(sugerido) && !isNaN(actual) && sugerido < actual) {
        let competitivo = ajustarCompetitivo(actual, sugerido);
        let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
        oportunidades.push(nuevo);
        usados.add(row['asin']);
      }
    });

    // 2. Segundo filtro: (precio_sugerido - 50) < precio_actual_mx,
    // pero solo si no está en oportunidades y sugerido >= actual
    productos.forEach(row => {
      if (!usados.has(row['asin'])) {
        const sugerido = parseFloat(row['precio_sugerido']);
        const actual = parseFloat(row['precio_actual_mx']);
        
        // Excluir por rango para -50: < 1000 o > 7000
        if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
          return;
        }
        if (!isNaN(actual) && actual < PRECIO_MIN_OTROS) {
          excluidos_por_min_otros++;
          return;
        }
        
        if (!isNaN(sugerido) && !isNaN(actual)) {
          if ((sugerido - 50) < actual && sugerido >= actual) {
            let competitivo = ajustarCompetitivo(actual, sugerido - 50);
            let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
            oportunidades_menos_50.push(nuevo);
            usados.add(row['asin']);
          }
        }
      }
    });

    // 3. Tercer filtro: (precio_sugerido - 100) < precio_actual_mx,
    // pero solo si no está en anteriores
    productos.forEach(row => {
      if (!usados.has(row['asin'])) {
        const sugerido = parseFloat(row['precio_sugerido']);
        const actual = parseFloat(row['precio_actual_mx']);
        
        // Excluir por rango para -100: < 1000 o > 7000
        if (!isNaN(actual) && actual > PRECIO_MAXIMO) {
          return;
        }
        if (!isNaN(actual) && actual < PRECIO_MIN_OTROS) {
          excluidos_por_min_otros++;
          return;
        }
        
        if (!isNaN(sugerido) && !isNaN(actual)) {
          if ((sugerido - 100) < actual && (sugerido - 50) >= actual) {
            let competitivo = ajustarCompetitivo(actual, sugerido - 100);
            let nuevo = { ...row, precio_competitivo: competitivo.toFixed(2) };
            oportunidades_menos_100.push(nuevo);
            usados.add(row['asin']);
          }
        }
      }
    });

    // Guarda archivos
    const campos = Object.keys(productos[0] || {});
    const camposFinales = [...campos, 'precio_competitivo'];
    const informe = [];

    // 1 archivo oportunidades
    if (oportunidades.length > 0) {
      fs.writeFileSync(OUTPUT1, parse(oportunidades, { fields: camposFinales }), 'utf8');
      informe.push(`Se encontraron ${oportunidades.length} oportunidades directas (archivo '${OUTPUT1}')`);
    } else {
      informe.push('No se encontraron oportunidades directas.');
    }

    // 2 archivo menos_50
    if (oportunidades_menos_50.length > 0) {
      fs.writeFileSync(OUTPUT2, parse(oportunidades_menos_50, { fields: camposFinales }), 'utf8');
      informe.push(`Se encontraron ${oportunidades_menos_50.length} oportunidades al bajar $50 (archivo '${OUTPUT2}')`);
    } else {
      informe.push('No se encontraron oportunidades al bajar $50.');
    }

    // 3 archivo menos_100
    if (oportunidades_menos_100.length > 0) {
      fs.writeFileSync(OUTPUT3, parse(oportunidades_menos_100, { fields: camposFinales }), 'utf8');
      informe.push(`Se encontraron ${oportunidades_menos_100.length} oportunidades al bajar $100 (archivo '${OUTPUT3}')`);
    } else {
      informe.push('No se encontraron oportunidades al bajar $100.');
    }

    // Mensaje resumen
    console.log('');
    console.log('✅ ¡Proceso finalizado!');
    console.log(`📊 Se analizaron ${total} productos`);
    if (excluidos_por_precio > 0) {
      console.log(`⚠️  Se excluyeron ${excluidos_por_precio} productos con precio > $${PRECIO_MAXIMO.toLocaleString()}`);
    }
    if (excluidos_por_min_principal > 0) {
      console.log(`⚠️  Se excluyeron ${excluidos_por_min_principal} productos con precio < $${PRECIO_MIN_PRINCIPAL} para oportunidad directa`);
    }
    if (excluidos_por_min_otros > 0) {
      console.log(`⚠️  Se excluyeron ${excluidos_por_min_otros} productos con precio < $${PRECIO_MIN_OTROS} para oportunidades -50/-100`);
    }
    console.log('');
    console.log('📈 Resumen de oportunidades:');
    informe.forEach(msg => console.log(`   ${msg}`));
    console.log('');
    
    if (batch_number) {
      console.log(`📌 Archivos generados para BATCH ${batch_number}`);
    } else {
      console.log('📌 Archivos generados para vendedor completo');
    }
    console.log('');
    console.log('🎯 Siguiente paso: Usar el menú de PLANTILLAS para generar templates con estos archivos');
  });
